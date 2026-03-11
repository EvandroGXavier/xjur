import { Injectable } from "@nestjs/common";
import axios from "axios";
import { PrismaService } from "../prisma.service";

type DrxSkill = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  triggerKeywords: string[];
  enabled: boolean;
};

type DrxClawConfig = {
  enabled: boolean;
  assistantName: string;
  companyLabel: string;
  provider: string;
  maxIterations: number;
  systemPrompt: string;
  telegramWhitelist: string[];
  local: {
    baseUrl: string;
    model: string;
    apiKey: string;
  };
  openaiCompatible: {
    baseUrl: string;
    model: string;
    apiKey: string;
  };
  apiKeys: {
    openai: string;
    gemini: string;
    deepseek: string;
    claude: string;
    groq: string;
  };
  playground: {
    temperature: number;
    maxTokens: number;
    lastPrompt: string;
    lastResponse: string;
    lastRunAt: string | null;
  };
  skills: DrxSkill[];
};

const DEFAULT_SKILLS: DrxSkill[] = [
  {
    id: "triagem-juridica",
    name: "Triagem Juridica",
    description:
      "Qualifica pedidos iniciais e organiza contexto antes de acionar equipes.",
    instructions:
      "Identifique demanda, urgencia, documentos faltantes e proximo passo recomendado.",
    triggerKeywords: [
      "triagem",
      "novo cliente",
      "analise inicial",
      "qualificar",
    ],
    enabled: true,
  },
  {
    id: "financeiro-cobranca",
    name: "Financeiro e Cobranca",
    description:
      "Ajuda em cobrancas, lembretes de vencimento e negociacao de parcelas.",
    instructions:
      "Responda com tom objetivo, valores claros e proximo passo de cobranca.",
    triggerKeywords: [
      "boleto",
      "vencimento",
      "cobranca",
      "pagamento",
      "financeiro",
    ],
    enabled: true,
  },
  {
    id: "agenda-followup",
    name: "Agenda e Follow-up",
    description: "Propõe retornos, follow-ups e organização de compromissos.",
    instructions:
      "Sugira agenda, retorno, prazo e resumo executivo do atendimento.",
    triggerKeywords: ["agenda", "retorno", "follow-up", "lembrete", "prazo"],
    enabled: true,
  },
];

const DEFAULT_CONFIG: DrxClawConfig = {
  enabled: true,
  assistantName: "DrX-Claw",
  companyLabel: "",
  provider: "LOCAL",
  maxIterations: 5,
  systemPrompt:
    "Você é o DrX-Claw da empresa. Responda com clareza, contexto de negócio e proponha próximo passo acionável.",
  telegramWhitelist: [],
  local: {
    baseUrl: "http://127.0.0.1:1234/v1",
    model: "qwen/qwen3-4b-thinking-2507",
    apiKey: "",
  },
  openaiCompatible: {
    baseUrl: "",
    model: "",
    apiKey: "",
  },
  apiKeys: {
    openai: "",
    gemini: "",
    deepseek: "",
    claude: "",
    groq: "",
  },
  playground: {
    temperature: 0.4,
    maxTokens: 800,
    lastPrompt: "",
    lastResponse: "",
    lastRunAt: null,
  },
  skills: DEFAULT_SKILLS,
};

@Injectable()
export class DrxClawService {
  constructor(private readonly prisma: PrismaService) {}

  private async getConnection(tenantId: string) {
    return this.prisma.connection.findFirst({
      where: {
        tenantId,
        type: "DRX_CLAW",
      },
      orderBy: { createdAt: "asc" },
    });
  }

  private mergeConfig(input: any, tenantName?: string): DrxClawConfig {
    const config = input && typeof input === "object" ? input : {};

    return {
      ...DEFAULT_CONFIG,
      ...config,
      companyLabel:
        config.companyLabel || tenantName || DEFAULT_CONFIG.companyLabel,
      telegramWhitelist: Array.isArray(config.telegramWhitelist)
        ? config.telegramWhitelist
            .map((item: any) => String(item).trim())
            .filter(Boolean)
        : DEFAULT_CONFIG.telegramWhitelist,
      local: {
        ...DEFAULT_CONFIG.local,
        ...(config.local || {}),
      },
      openaiCompatible: {
        ...DEFAULT_CONFIG.openaiCompatible,
        ...(config.openaiCompatible || {}),
      },
      apiKeys: {
        ...DEFAULT_CONFIG.apiKeys,
        ...(config.apiKeys || {}),
      },
      playground: {
        ...DEFAULT_CONFIG.playground,
        ...(config.playground || {}),
      },
      skills:
        Array.isArray(config.skills) && config.skills.length > 0
          ? config.skills
          : DEFAULT_SKILLS,
    };
  }

  private getMatchScore(prompt: string, skill: DrxSkill) {
    const normalizedPrompt = prompt.toLowerCase();
    const haystack = [
      skill.name,
      skill.description,
      ...(skill.triggerKeywords || []),
    ]
      .join(" ")
      .toLowerCase();

    return (skill.triggerKeywords || []).reduce(
      (score, keyword) => {
        return normalizedPrompt.includes(keyword.toLowerCase())
          ? score + 2
          : score;
      },
      normalizedPrompt.includes(skill.name.toLowerCase())
        ? 3
        : haystack.includes(normalizedPrompt)
          ? 1
          : 0,
    );
  }

  private matchSkills(prompt: string, skills: DrxSkill[]) {
    return skills
      .filter((skill) => skill.enabled)
      .map((skill) => ({
        ...skill,
        score: this.getMatchScore(prompt, skill),
      }))
      .filter((skill) => skill.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }

  private buildSystemPrompt(
    config: DrxClawConfig,
    matchedSkills: Array<DrxSkill & { score: number }>,
  ) {
    const skillsBlock =
      matchedSkills.length === 0
        ? "Nenhuma skill foi ativada automaticamente para este teste."
        : matchedSkills
            .map(
              (skill) =>
                `- ${skill.name}: ${skill.description}. Instruções: ${skill.instructions}`,
            )
            .join("\n");

    return [
      `Assistente: ${config.assistantName}`,
      `Empresa: ${config.companyLabel || "Tenant atual"}`,
      `Max iterations: ${config.maxIterations}`,
      config.systemPrompt,
      "Skills relevantes para este teste:",
      skillsBlock,
      "Responda em português do Brasil, com objetividade, contexto e próximo passo sugerido.",
    ].join("\n\n");
  }

  private resolveRuntime(config: DrxClawConfig) {
    const provider = (config.provider || "LOCAL").toUpperCase();

    if (provider === "OPENAI") {
      return {
        supported: true,
        label: "OpenAI",
        url: "https://api.openai.com/v1/chat/completions",
        apiKey: config.apiKeys.openai,
        model: config.openaiCompatible.model || "gpt-4o-mini",
      };
    }

    if (provider === "GROQ") {
      return {
        supported: true,
        label: "Groq",
        url: "https://api.groq.com/openai/v1/chat/completions",
        apiKey: config.apiKeys.groq,
        model: config.openaiCompatible.model || "llama-3.3-70b-versatile",
      };
    }

    if (provider === "DEEPSEEK") {
      return {
        supported: true,
        label: "DeepSeek",
        url: "https://api.deepseek.com/chat/completions",
        apiKey: config.apiKeys.deepseek,
        model: config.openaiCompatible.model || "deepseek-chat",
      };
    }

    if (
      provider === "LOCAL" ||
      provider === "OLLAMA" ||
      provider === "LMSTUDIO"
    ) {
      return {
        supported: true,
        label: "IA Local",
        url: `${String(config.local.baseUrl || "").replace(/\/$/, "")}/chat/completions`,
        apiKey: config.local.apiKey,
        model: config.local.model,
      };
    }

    if (provider === "OPENAI_COMPATIBLE") {
      return {
        supported: true,
        label: "OpenAI Compatible",
        url: `${String(config.openaiCompatible.baseUrl || "").replace(/\/$/, "")}/chat/completions`,
        apiKey: config.openaiCompatible.apiKey,
        model: config.openaiCompatible.model,
      };
    }

    return {
      supported: false,
      label: provider,
      url: "",
      apiKey: "",
      model: "",
    };
  }

  private async ensureConfigRecord(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    const existing = await this.getConnection(tenantId);

    if (existing) {
      return {
        record: existing,
        config: this.mergeConfig(existing.config, tenant?.name),
      };
    }

    const created = await this.prisma.connection.create({
      data: {
        tenantId,
        name: "DrX-Claw",
        type: "DRX_CLAW",
        status: "READY",
        config: this.mergeConfig({}, tenant?.name),
      },
    });

    return {
      record: created,
      config: this.mergeConfig(created.config, tenant?.name),
    };
  }

  async getConfig(tenantId: string) {
    const { record, config } = await this.ensureConfigRecord(tenantId);

    return {
      id: record.id,
      status: record.status,
      config,
      summary: {
        enabledSkills: config.skills.filter((skill) => skill.enabled).length,
        whitelistCount: config.telegramWhitelist.length,
        provider: config.provider,
        model:
          config.provider === "LOCAL" ||
          config.provider === "OLLAMA" ||
          config.provider === "LMSTUDIO"
            ? config.local.model
            : config.openaiCompatible.model,
      },
    };
  }

  async saveConfig(tenantId: string, payload: any) {
    const { record } = await this.ensureConfigRecord(tenantId);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    const merged = this.mergeConfig(payload, tenant?.name);

    const updated = await this.prisma.connection.update({
      where: { id: record.id },
      data: {
        name: merged.assistantName || "DrX-Claw",
        status: merged.enabled ? "READY" : "PAUSED",
        config: merged,
      },
    });

    return {
      success: true,
      id: updated.id,
      config: this.mergeConfig(updated.config, tenant?.name),
    };
  }

  async runPlayground(tenantId: string, payload: any) {
    const prompt = String(payload?.prompt || "").trim();
    const scenario = String(payload?.scenario || "Livre");

    const { record, config: storedConfig } =
      await this.ensureConfigRecord(tenantId);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    const config = this.mergeConfig(
      payload?.config || storedConfig,
      tenant?.name,
    );
    const matchedSkills = this.matchSkills(prompt, config.skills);
    const runtime = this.resolveRuntime(config);
    const systemPrompt = this.buildSystemPrompt(config, matchedSkills);

    if (!prompt) {
      return {
        mode: "preview",
        provider: runtime.label,
        model: runtime.model,
        matchedSkills,
        answer: "Digite um prompt para testar o DrX-Claw.",
        systemPrompt,
      };
    }

    let answer = "";
    let mode = "preview";
    let error: string | null = null;

    if (runtime.supported && runtime.url && runtime.model) {
      try {
        const response = await axios.post(
          runtime.url,
          {
            model: runtime.model,
            temperature: Number(config.playground.temperature || 0.4),
            max_tokens: Number(config.playground.maxTokens || 800),
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `[Cenário: ${scenario}]\n${prompt}` },
            ],
          },
          {
            headers: {
              "Content-Type": "application/json",
              ...(runtime.apiKey
                ? { Authorization: `Bearer ${runtime.apiKey}` }
                : {}),
            },
            timeout: 45000,
          },
        );

        answer =
          response.data?.choices?.[0]?.message?.content ||
          response.data?.message ||
          "O provider respondeu sem conteúdo textual.";
        mode = "live";
      } catch (err: any) {
        error =
          err.response?.data?.error?.message ||
          err.message ||
          "Falha ao consultar o provider.";
      }
    }

    if (!answer) {
      const skillList =
        matchedSkills.length > 0
          ? matchedSkills.map((skill) => skill.name).join(", ")
          : "nenhuma skill combinada automaticamente";

      answer = [
        `Playground em modo assistido para ${config.assistantName}.`,
        `Provider selecionado: ${runtime.label}${runtime.model ? ` / ${runtime.model}` : ""}.`,
        `Skills acionadas: ${skillList}.`,
        "",
        "Prévia de comportamento esperada:",
        `- Interpretar a solicitação: ${prompt}`,
        "- Aplicar o prompt-base da empresa e as skills habilitadas.",
        "- Responder com contexto, decisão e próximo passo.",
        error
          ? `- Observação: ${error}`
          : "- Observação: provider ainda não configurado para execução real.",
      ].join("\n");
    }

    const updatedConfig = {
      ...config,
      playground: {
        ...config.playground,
        lastPrompt: prompt,
        lastResponse: answer,
        lastRunAt: new Date().toISOString(),
      },
    };

    await this.prisma.connection.update({
      where: { id: record.id },
      data: {
        config: updatedConfig,
        status: config.enabled ? "READY" : "PAUSED",
      },
    });

    return {
      mode,
      provider: runtime.label,
      model: runtime.model,
      matchedSkills,
      answer,
      error,
      systemPrompt,
    };
  }
}
