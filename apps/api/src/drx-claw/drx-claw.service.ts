import { Injectable, Logger, forwardRef, Inject } from "@nestjs/common";
import axios from "axios";
import { CommunicationsService } from "../communications/communications.service";
import { PrismaService } from "../prisma.service";
import { TicketsService } from "../tickets/tickets.service";
import {
  DEFAULT_SKILLS,
  DrxSkill,
  mergeDrxSkills,
  PROCESS_PDF_SKILL_ID,
} from "./drx-skill.constants";
import {
  DrxClawConfig,
  ProviderId,
  ProviderModelOption,
} from "./drx-claw.types";
import * as fs from 'fs';
import { WhisperTranscription } from '../telegram/utils/whisper.util';
import { PdfExtractor } from '../telegram/utils/pdf.util';
import { TelegramService } from '../telegram/telegram.service';
import { TriagemService } from "./triagem.service";
import { WhatsappService } from "../whatsapp/whatsapp.service";
import { InboxService } from "../inbox/inbox.service";

type ProviderCatalogEntry = {
  provider: ProviderId;
  label: string;
  supported: boolean;
  ready: boolean;
  canValidate: boolean;
  usesFixedBaseUrl: boolean;
  selectedModel: string;
  defaultModel: string;
  baseUrl: string;
  missing: string[];
  note: string;
  models: ProviderModelOption[];
  fetchedLiveModels: boolean;
  liveLookupError: string | null;
};

const PROVIDER_ORDER: ProviderId[] = [
  "OPENAI",
  "GEMINI",
  "CLAUDE",
  "GROQ",
  "DEEPSEEK",
  "OPENAI_COMPATIBLE",
  "LOCAL",
];

const PROVIDER_LABELS: Record<ProviderId, string> = {
  LOCAL: "IA Local",
  OLLAMA: "Ollama",
  LMSTUDIO: "LM Studio",
  OPENAI: "OpenAI",
  GEMINI: "Gemini",
  CLAUDE: "Claude",
  GROQ: "Groq",
  DEEPSEEK: "DeepSeek",
  OPENAI_COMPATIBLE: "OpenAI Compatible",
};

const DEFAULT_CUSTOM_MODELS: Record<string, string[]> = {
  OPENAI: [],
  GEMINI: [],
  CLAUDE: [],
  GROQ: [],
  DEEPSEEK: [],
  OPENAI_COMPATIBLE: [],
  LOCAL: [],
};

const FALLBACK_MODELS: Record<ProviderId, ProviderModelOption[]> = {
  OPENAI: [
    { id: "gpt-4o", label: "gpt-4o", source: "fallback", status: "stable" },
    { id: "gpt-4o-mini", label: "gpt-4o-mini", source: "fallback", status: "stable" },
    { id: "gpt-4.1", label: "gpt-4.1", source: "fallback", status: "stable" },
    { id: "gpt-4.1-mini", label: "gpt-4.1-mini", source: "fallback", status: "stable" },
    { id: "gpt-4.1-nano", label: "gpt-4.1-nano", source: "fallback", status: "stable" },
    { id: "o3-mini", label: "o3-mini", source: "fallback", status: "stable" },
    { id: "o1", label: "o1", source: "fallback", status: "alias" },
    { id: "o1-mini", label: "o1-mini", source: "fallback", status: "alias" },
  ],
  GEMINI: [
    { id: "gemini-2.5-pro", label: "gemini-2.5-pro", source: "fallback", status: "stable" },
    { id: "gemini-2.5-flash", label: "gemini-2.5-flash", source: "fallback", status: "stable" },
    { id: "gemini-2.5-flash-lite", label: "gemini-2.5-flash-lite", source: "fallback", status: "stable" },
    { id: "gemini-2.0-flash", label: "gemini-2.0-flash", source: "fallback", status: "stable" },
    { id: "gemini-2.0-flash-lite", label: "gemini-2.0-flash-lite", source: "fallback", status: "alias" },
    { id: "gemini-3-flash-preview", label: "gemini-3-flash-preview", source: "fallback", status: "preview" },
  ],
  CLAUDE: [
    { id: "claude-opus-4-1-20250805", label: "claude-opus-4-1-20250805", source: "fallback", status: "stable" },
    { id: "claude-opus-4-20250514", label: "claude-opus-4-20250514", source: "fallback", status: "stable" },
    { id: "claude-sonnet-4-20250514", label: "claude-sonnet-4-20250514", source: "fallback", status: "stable" },
    { id: "claude-3-7-sonnet-20250219", label: "claude-3-7-sonnet-20250219", source: "fallback", status: "stable" },
    { id: "claude-3-5-sonnet-20241022", label: "claude-3-5-sonnet-20241022", source: "fallback", status: "stable" },
    { id: "claude-3-5-haiku-20241022", label: "claude-3-5-haiku-20241022", source: "fallback", status: "stable" },
    { id: "claude-3-haiku-20240307", label: "claude-3-haiku-20240307", source: "fallback", status: "stable" },
  ],
  GROQ: [
    { id: "llama-3.3-70b-versatile", label: "llama-3.3-70b-versatile", source: "fallback", status: "stable" },
    { id: "llama-3.3-70b-specdec", label: "llama-3.3-70b-specdec", source: "fallback", status: "stable" },
    { id: "llama-3.1-8b-instant", label: "llama-3.1-8b-instant", source: "fallback", status: "stable" },
    { id: "qwen/qwen3-32b", label: "qwen/qwen3-32b", source: "fallback", status: "preview" },
    { id: "moonshotai/kimi-k2-instruct", label: "moonshotai/kimi-k2-instruct", source: "fallback", status: "stable" },
    { id: "deepseek-r1-distill-llama-70b", label: "deepseek-r1-distill-llama-70b", source: "fallback", status: "stable" },
  ],
  DEEPSEEK: [
    { id: "deepseek-chat", label: "deepseek-chat", source: "fallback", status: "stable" },
    { id: "deepseek-reasoner", label: "deepseek-reasoner", source: "fallback", status: "stable" },
  ],
  OPENAI_COMPATIBLE: [],
  LOCAL: [
    { id: "qwen/qwen3-4b-thinking-2507", label: "qwen/qwen3-4b-thinking-2507", source: "fallback", status: "custom" },
  ],
  OLLAMA: [],
  LMSTUDIO: [],
};

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
  customModels: DEFAULT_CUSTOM_MODELS,
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
  private readonly logger = new Logger(DrxClawService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationsService: CommunicationsService,
    private readonly ticketsService: TicketsService,
    private readonly triagemService: TriagemService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
    @Inject(forwardRef(() => InboxService))
    private readonly inboxService: InboxService,
  ) {}

  private normalizeProvider(providerInput?: string): ProviderId {
    const provider = String(providerInput || "LOCAL").toUpperCase();

    if (
      provider === "LOCAL" ||
      provider === "OLLAMA" ||
      provider === "LMSTUDIO" ||
      provider === "OPENAI" ||
      provider === "GEMINI" ||
      provider === "CLAUDE" ||
      provider === "GROQ" ||
      provider === "DEEPSEEK" ||
      provider === "OPENAI_COMPATIBLE"
    ) {
      return provider;
    }

    return "LOCAL";
  }

  private trimTrailingSlash(value: string) {
    return String(value || "").replace(/\/+$/, "");
  }

  private getProviderDefaultModel(providerInput?: string) {
    const provider = this.normalizeProvider(providerInput);

    if (
      provider === "LOCAL" ||
      provider === "OLLAMA" ||
      provider === "LMSTUDIO"
    ) {
      return DEFAULT_CONFIG.local.model;
    }

    if (provider === "OPENAI") return "gpt-4o-mini";
    if (provider === "GEMINI") return "gemini-2.5-flash";
    if (provider === "CLAUDE") return "claude-sonnet-4-20250514";
    if (provider === "GROQ") return "llama-3.3-70b-versatile";
    if (provider === "DEEPSEEK") return "deepseek-chat";

    return "";
  }

  private getProviderModel(config: DrxClawConfig, providerInput?: string) {
    const provider = this.normalizeProvider(providerInput || config.provider);

    if (
      provider === "LOCAL" ||
      provider === "OLLAMA" ||
      provider === "LMSTUDIO"
    ) {
      return config.local.model || this.getProviderDefaultModel(provider);
    }

    if (provider === "OPENAI_COMPATIBLE") {
      return config.openaiCompatible.model;
    }

    return (
      config.openaiCompatible.model || this.getProviderDefaultModel(provider)
    );
  }

  private getProviderLabel(providerInput?: string) {
    return PROVIDER_LABELS[this.normalizeProvider(providerInput)] || "Provider";
  }

  private getProviderBaseUrl(config: DrxClawConfig, providerInput?: string) {
    const provider = this.normalizeProvider(providerInput || config.provider);

    if (provider === "OPENAI") return "https://api.openai.com/v1";
    if (provider === "GROQ") return "https://api.groq.com/openai/v1";
    if (provider === "DEEPSEEK") return "https://api.deepseek.com";
    if (provider === "GEMINI") {
      return "https://generativelanguage.googleapis.com/v1beta/openai";
    }
    if (provider === "CLAUDE") return "https://api.anthropic.com/v1";
    if (
      provider === "LOCAL" ||
      provider === "OLLAMA" ||
      provider === "LMSTUDIO"
    ) {
      return this.trimTrailingSlash(config.local.baseUrl);
    }
    if (provider === "OPENAI_COMPATIBLE") {
      return this.trimTrailingSlash(config.openaiCompatible.baseUrl);
    }

    return "";
  }

  private getProviderApiKey(config: DrxClawConfig, providerInput?: string) {
    const provider = this.normalizeProvider(providerInput || config.provider);

    if (provider === "OPENAI") return config.apiKeys.openai;
    if (provider === "GEMINI") return config.apiKeys.gemini;
    if (provider === "CLAUDE") return config.apiKeys.claude;
    if (provider === "GROQ") return config.apiKeys.groq;
    if (provider === "DEEPSEEK") return config.apiKeys.deepseek;
    if (
      provider === "LOCAL" ||
      provider === "OLLAMA" ||
      provider === "LMSTUDIO"
    ) {
      return config.local.apiKey;
    }
    if (provider === "OPENAI_COMPATIBLE") {
      return config.openaiCompatible.apiKey;
    }

    return "";
  }

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
    const rawCustomModels =
      config.customModels && typeof config.customModels === "object"
        ? config.customModels
        : {};
    const customModels = Object.fromEntries(
      Object.keys(DEFAULT_CUSTOM_MODELS).map((provider) => [
        provider,
        Array.isArray(rawCustomModels[provider])
          ? rawCustomModels[provider]
              .map((item: any) => String(item || "").trim())
              .filter(Boolean)
          : [],
      ]),
    );

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
      customModels,
      playground: {
        ...DEFAULT_CONFIG.playground,
        ...(config.playground || {}),
      },
      skills: mergeDrxSkills(config.skills),
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

  private sanitizeSkillIds(value: any) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  private resolveMatchedSkills(
    prompt: string,
    skills: DrxSkill[],
    forcedSkillIds: string[] = [],
  ) {
    const forcedIds = new Set(this.sanitizeSkillIds(forcedSkillIds));
    const forcedSkills = skills
      .filter((skill) => skill.enabled && forcedIds.has(skill.id))
      .map((skill) => ({
        ...skill,
        score: 100,
      }));

    const automaticSkills = prompt
      ? this.matchSkills(prompt, skills).filter(
          (skill) => !forcedIds.has(skill.id),
        )
      : [];

    return [...forcedSkills, ...automaticSkills].slice(0, 4);
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

  private resolveRuntime(config: DrxClawConfig, providerInput?: string) {
    const provider = this.normalizeProvider(providerInput || config.provider);
    const baseUrl = this.getProviderBaseUrl(config, provider);
    const apiKey = this.getProviderApiKey(config, provider);
    const model = this.getProviderModel(config, provider);

    if (provider === "OPENAI") {
      return {
        provider,
        supported: true,
        label: this.getProviderLabel(provider),
        kind: "openai" as const,
        url: "https://api.openai.com/v1/chat/completions",
        apiKey,
        model,
        baseUrl,
        usesFixedBaseUrl: true,
        requires: { apiKey: true, baseUrl: false, model: true },
      };
    }

    if (provider === "GEMINI") {
      return {
        provider,
        supported: true,
        label: this.getProviderLabel(provider),
        kind: "openai" as const,
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        apiKey,
        model,
        baseUrl,
        usesFixedBaseUrl: true,
        requires: { apiKey: true, baseUrl: false, model: true },
      };
    }

    if (provider === "GROQ") {
      return {
        provider,
        supported: true,
        label: this.getProviderLabel(provider),
        kind: "openai" as const,
        url: "https://api.groq.com/openai/v1/chat/completions",
        apiKey,
        model,
        baseUrl,
        usesFixedBaseUrl: true,
        requires: { apiKey: true, baseUrl: false, model: true },
      };
    }

    if (provider === "DEEPSEEK") {
      return {
        provider,
        supported: true,
        label: this.getProviderLabel(provider),
        kind: "openai" as const,
        url: "https://api.deepseek.com/chat/completions",
        apiKey,
        model,
        baseUrl,
        usesFixedBaseUrl: true,
        requires: { apiKey: true, baseUrl: false, model: true },
      };
    }

    if (provider === "CLAUDE") {
      return {
        provider,
        supported: true,
        label: this.getProviderLabel(provider),
        kind: "anthropic" as const,
        url: "https://api.anthropic.com/v1/messages",
        apiKey,
        model,
        baseUrl,
        usesFixedBaseUrl: true,
        requires: { apiKey: true, baseUrl: false, model: true },
      };
    }

    if (
      provider === "LOCAL" ||
      provider === "OLLAMA" ||
      provider === "LMSTUDIO"
    ) {
      return {
        provider,
        supported: true,
        label: this.getProviderLabel(provider),
        kind: "openai" as const,
        url: `${baseUrl}/chat/completions`,
        apiKey,
        model,
        baseUrl,
        usesFixedBaseUrl: false,
        requires: { apiKey: false, baseUrl: true, model: true },
      };
    }

    if (provider === "OPENAI_COMPATIBLE") {
      return {
        provider,
        supported: true,
        label: this.getProviderLabel(provider),
        kind: "openai" as const,
        url: `${baseUrl}/chat/completions`,
        apiKey,
        model,
        baseUrl,
        usesFixedBaseUrl: false,
        requires: { apiKey: false, baseUrl: true, model: true },
      };
    }

    return {
      provider,
      supported: false,
      label: this.getProviderLabel(provider),
      kind: "openai" as const,
      url: "",
      apiKey: "",
      model: "",
      baseUrl: "",
      usesFixedBaseUrl: false,
      requires: { apiKey: false, baseUrl: false, model: false },
    };
  }

  private getRuntimeReadiness(runtime: ReturnType<typeof this.resolveRuntime>) {
    const missing: string[] = [];

    if (!runtime.supported) missing.push("provider_nao_implementado");
    if (runtime.requires.apiKey && !runtime.apiKey.trim()) missing.push("api_key");
    if (runtime.requires.baseUrl && !runtime.baseUrl.trim()) missing.push("base_url");
    if (runtime.requires.model && !runtime.model.trim()) missing.push("model");

    return {
      ready: missing.length === 0,
      missing,
    };
  }

  private describeMissingRequirements(
    runtime: ReturnType<typeof this.resolveRuntime>,
    missing: string[],
  ) {
    if (!runtime.supported) {
      return `${runtime.label} ainda nao esta implementado para execucao real.`;
    }

    if (missing.length === 0) {
      return "";
    }

    const labels = missing.map((item) => {
      if (item === "api_key") return "API key";
      if (item === "base_url") return "Base URL";
      if (item === "model") return "modelo";
      return item;
    });

    return `Configuracao incompleta para ${runtime.label}: falta ${labels.join(", ")}.`;
  }

  private normalizeOpenAiMessageContent(content: any) {
    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (typeof item === "string") return item;
          if (item?.type === "text") return item.text || "";
          if (item?.text?.value) return item.text.value;
          return "";
        })
        .join("")
        .trim();
    }

    return "";
  }

  private normalizeAnthropicContent(content: any) {
    if (!Array.isArray(content)) {
      return "";
    }

    return content
      .map((item) => (item?.type === "text" ? item.text || "" : ""))
      .join("")
      .trim();
  }

  private async executeRuntimeRequest(
    runtime: ReturnType<typeof this.resolveRuntime>,
    systemPrompt: string,
    userPrompt: string,
    config: DrxClawConfig,
  ) {
    const readiness = this.getRuntimeReadiness(runtime);

    if (!runtime.supported || !readiness.ready) {
      return {
        answer: "",
        mode: "preview" as const,
        error: this.describeMissingRequirements(runtime, readiness.missing),
      };
    }

    try {
      if (runtime.kind === "anthropic") {
        const response = await axios.post(
          runtime.url,
          {
            model: runtime.model,
            max_tokens: Number(config.playground.maxTokens || 800),
            temperature: Number(config.playground.temperature || 0.4),
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
          },
          {
            headers: {
              "Content-Type": "application/json",
              "x-api-key": runtime.apiKey,
              "anthropic-version": "2023-06-01",
            },
            timeout: 45000,
          },
        );

        return {
          answer:
            this.normalizeAnthropicContent(response.data?.content) ||
            "O provider respondeu sem conteudo textual.",
          mode: "live" as const,
          error: null,
        };
      }

      const response = await axios.post(
        runtime.url,
        {
          model: runtime.model,
          temperature: Number(config.playground.temperature || 0.4),
          max_tokens: Number(config.playground.maxTokens || 800),
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
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

      return {
        answer:
          this.normalizeOpenAiMessageContent(
            response.data?.choices?.[0]?.message?.content,
          ) ||
          response.data?.message ||
          "O provider respondeu sem conteudo textual.",
        mode: "live" as const,
        error: null,
      };
    } catch (err: any) {
      return {
        answer: "",
        mode: "preview" as const,
        error:
          err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Falha ao consultar o provider.",
      };
    }
  }

  private buildPreviewAnswer(
    config: DrxClawConfig,
    runtime: ReturnType<typeof this.resolveRuntime>,
    prompt: string,
    matchedSkills: Array<DrxSkill & { score: number }>,
    error: string | null,
  ) {
    const skillList =
      matchedSkills.length > 0
        ? matchedSkills.map((skill) => skill.name).join(", ")
        : "nenhuma skill combinada automaticamente";

    return [
      `Playground em modo assistido para ${config.assistantName}.`,
      `Provider selecionado: ${runtime.label}${runtime.model ? ` / ${runtime.model}` : ""}.`,
      `Skills acionadas: ${skillList}.`,
      "",
      "Previa de comportamento esperada:",
      `- Interpretar a solicitacao: ${prompt}`,
      "- Aplicar o prompt-base da empresa e as skills habilitadas.",
      "- Responder com contexto, decisao e proximo passo.",
      error
        ? `- Observacao: ${error}`
        : "- Observacao: provider ainda nao configurado para execucao real.",
    ].join("\n");
  }

  private getCustomModels(config: DrxClawConfig, providerInput?: string) {
    const provider = this.normalizeProvider(providerInput || config.provider);
    const source = config.customModels?.[provider];

    if (!Array.isArray(source)) {
      return [];
    }

    return source
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  private detectModelStatus(modelId: string): ProviderModelOption["status"] {
    const normalized = String(modelId || "").toLowerCase();

    if (normalized.includes("preview") || normalized.includes("exp")) {
      return "preview";
    }

    if (normalized.includes("latest") || normalized.endsWith("-0")) {
      return "alias";
    }

    return "stable";
  }

  private isTextModelId(providerInput: ProviderId, modelId: string) {
    const provider = this.normalizeProvider(providerInput);
    const normalized = String(modelId || "").toLowerCase();

    if (!normalized) return false;

    const blockedTokens = [
      "embedding",
      "moderation",
      "whisper",
      "transcribe",
      "tts",
      "speech",
      "realtime",
      "image",
      "imagen",
      "veo",
      "audio",
      "video",
      "aqa",
      "search",
      "computer-use",
    ];

    if (blockedTokens.some((token) => normalized.includes(token))) {
      return false;
    }

    if (provider === "GEMINI") {
      return normalized.startsWith("gemini-");
    }

    if (provider === "CLAUDE") {
      return normalized.startsWith("claude");
    }

    if (provider === "DEEPSEEK") {
      return normalized.startsWith("deepseek");
    }

    return true;
  }

  private uniqueModelOptions(models: ProviderModelOption[]) {
    const seen = new Set<string>();

    return models.filter((model) => {
      const key = model.id.trim().toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private async fetchLiveModels(
    config: DrxClawConfig,
    providerInput: ProviderId,
  ) {
    const provider = this.normalizeProvider(providerInput);
    const runtime = this.resolveRuntime(config, provider);
    const readiness = this.getRuntimeReadiness(runtime);

    if (!runtime.supported) {
      return { models: [] as ProviderModelOption[], fetched: false, error: null };
    }

    if (runtime.requires.apiKey && !runtime.apiKey.trim()) {
      return { models: [] as ProviderModelOption[], fetched: false, error: "API key ausente" };
    }

    if (runtime.requires.baseUrl && !runtime.baseUrl.trim()) {
      return { models: [] as ProviderModelOption[], fetched: false, error: "Base URL ausente" };
    }

    if (!readiness.ready && !runtime.model.trim()) {
      return { models: [] as ProviderModelOption[], fetched: false, error: "Configuracao incompleta" };
    }

    try {
      if (provider === "GEMINI") {
        const response = await axios.get(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(runtime.apiKey)}`,
          { timeout: 15000 },
        );

        const models = (response.data?.models || [])
          .map((item: any) => String(item?.name || "").replace(/^models\//, ""))
          .filter((item: string) => this.isTextModelId(provider, item))
          .map((id: string) => ({
            id,
            label: id,
            source: "live" as const,
            status: this.detectModelStatus(id),
          }));

        return { models: this.uniqueModelOptions(models), fetched: true, error: null };
      }

      if (provider === "CLAUDE") {
        const response = await axios.get("https://api.anthropic.com/v1/models", {
          headers: {
            "x-api-key": runtime.apiKey,
            "anthropic-version": "2023-06-01",
          },
          timeout: 15000,
        });

        const models = (response.data?.data || response.data?.models || [])
          .map((item: any) => String(item?.id || item?.name || "").trim())
          .filter((item: string) => this.isTextModelId(provider, item))
          .map((id: string) => ({
            id,
            label: id,
            source: "live" as const,
            status: this.detectModelStatus(id),
          }));

        return { models: this.uniqueModelOptions(models), fetched: true, error: null };
      }

      let modelsUrl = "";
      if (provider === "OPENAI") modelsUrl = "https://api.openai.com/v1/models";
      if (provider === "GROQ") modelsUrl = "https://api.groq.com/openai/v1/models";
      if (provider === "DEEPSEEK") modelsUrl = "https://api.deepseek.com/models";
      if (
        provider === "LOCAL" ||
        provider === "OLLAMA" ||
        provider === "LMSTUDIO" ||
        provider === "OPENAI_COMPATIBLE"
      ) {
        modelsUrl = `${runtime.baseUrl}/models`;
      }

      if (!modelsUrl) {
        return { models: [] as ProviderModelOption[], fetched: false, error: null };
      }

      const response = await axios.get(modelsUrl, {
        headers: runtime.apiKey
          ? { Authorization: `Bearer ${runtime.apiKey}` }
          : undefined,
        timeout: 15000,
      });

      const models = (response.data?.data || [])
        .map((item: any) => String(item?.id || item?.name || "").trim())
        .filter((item: string) => this.isTextModelId(provider, item))
        .map((id: string) => ({
          id,
          label: id,
          source: "live" as const,
          status: this.detectModelStatus(id),
        }));

      return { models: this.uniqueModelOptions(models), fetched: true, error: null };
    } catch (error: any) {
      return {
        models: [] as ProviderModelOption[],
        fetched: false,
        error:
          error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          "Falha ao consultar catalogo do provider.",
      };
    }
  }

  private async buildProviderCatalog(config: DrxClawConfig) {
    return Promise.all(
      PROVIDER_ORDER.map(async (provider) => {
        const runtime = this.resolveRuntime(config, provider);
        const readiness = this.getRuntimeReadiness(runtime);
        const liveLookup = await this.fetchLiveModels(config, provider);
        const customModels = this.getCustomModels(config, provider).map((id) => ({
          id,
          label: id,
          source: "custom" as const,
          status: "custom" as const,
        }));
        const selectedModel = this.getProviderModel(config, provider);

        const models = this.uniqueModelOptions([
          ...liveLookup.models,
          ...(FALLBACK_MODELS[provider] || []),
          ...customModels,
          ...(selectedModel
            ? [
                {
                  id: selectedModel,
                  label: selectedModel,
                  source: "selected" as const,
                  status: this.detectModelStatus(selectedModel),
                },
              ]
            : []),
        ]).sort((left, right) => left.label.localeCompare(right.label));

        const note = !runtime.supported
          ? "Provider ainda nao implementado para execucao real."
          : readiness.ready
            ? liveLookup.fetched
              ? "Catalogo ao vivo carregado a partir do provider."
              : liveLookup.error
                ? `Usando fallback oficial. ${liveLookup.error}`
                : "Configuracao pronta para teste."
            : this.describeMissingRequirements(runtime, readiness.missing);

        return {
          provider,
          label: this.getProviderLabel(provider),
          supported: runtime.supported,
          ready: readiness.ready,
          canValidate: runtime.supported && readiness.ready,
          usesFixedBaseUrl: runtime.usesFixedBaseUrl,
          selectedModel,
          defaultModel: this.getProviderDefaultModel(provider),
          baseUrl: runtime.baseUrl,
          missing: readiness.missing,
          note,
          models,
          fetchedLiveModels: liveLookup.fetched,
          liveLookupError: liveLookup.error,
        } as ProviderCatalogEntry;
      }),
    );
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

  private extractJsonObject(payload: string) {
    const text = String(payload || '').trim();
    if (!text) return null;

    const direct = text.match(/\{[\s\S]*\}/);
    if (!direct) return null;

    try {
      return JSON.parse(direct[0]);
    } catch (_error) {
      return null;
    }
  }

  private buildTelegramDisplayName(message: any) {
    const parts = [
      String(message?.from?.first_name || '').trim(),
      String(message?.from?.last_name || '').trim(),
    ].filter(Boolean);

    return (
      parts.join(' ') ||
      String(message?.from?.username || '').trim() ||
      String(message?.chat?.title || '').trim() ||
      `Telegram ${String(message?.from?.id || message?.chat?.id || '').trim()}`
    );
  }

  private sanitizeTelegramText(input: any) {
    return String(input || '').trim();
  }

  private async buildTelegramActionPlan(input: {
    config: DrxClawConfig;
    runtime: ReturnType<typeof this.resolveRuntime>;
    prompt: string;
    context: Record<string, any>;
    allowActions: boolean;
  }) {
    const systemPrompt = [
      `Assistente: ${input.config.assistantName}`,
      input.config.systemPrompt,
      'Canal: Telegram.',
      'Retorne APENAS JSON valido.',
      'Formato: {"reply":"texto","actions":[{"type":"SEARCH_CONTACT","query":"..." }]}',
      'Use "actions" apenas quando realmente precisar consultar ou atualizar o sistema.',
      input.allowActions
        ? 'Acoes permitidas: SEARCH_CONTACT(query), LIST_OPEN_TICKETS(limit,status), GET_PROCESS_SUMMARY(query), UPDATE_TICKET_STATUS(ticketCodeOrId,status), ADD_TICKET_NOTE(content).'
        : 'Acoes desabilitadas para esta conversa. Responda apenas com "reply".',
      'Nunca invente IDs, codigos, contatos ou processos.',
      'A resposta em "reply" deve ser curta, clara e em portugues do Brasil.',
    ].join('\n\n');

    const result = await this.executeRuntimeRequest(
      input.runtime,
      systemPrompt,
      JSON.stringify(
        {
          prompt: input.prompt,
          context: input.context,
          allowActions: input.allowActions,
        },
        null,
        2,
      ),
      input.config,
    );

    const parsed = this.extractJsonObject(result.answer);
    return {
      raw: result.answer,
      error: result.error,
      reply:
        this.sanitizeTelegramText(parsed?.reply) ||
        this.sanitizeTelegramText(result.answer),
      actions: Array.isArray(parsed?.actions) ? parsed.actions : [],
    };
  }

  private async executeTelegramActions(input: {
    tenantId: string;
    currentTicketId: string;
    allowActions: boolean;
    actions: any[];
  }) {
    if (!input.allowActions || input.actions.length === 0) {
      return [];
    }

    const results: Array<Record<string, any>> = [];

    for (const action of input.actions.slice(0, 4)) {
      const type = String(action?.type || '').trim().toUpperCase();

      try {
        if (type === 'SEARCH_CONTACT') {
          const query = String(action?.query || '').trim();
          if (!query) continue;

          const contacts = await this.prisma.contact.findMany({
            where: {
              tenantId: input.tenantId,
              OR: [
                { name: { contains: query, mode: 'insensitive' as any } },
                { email: { contains: query, mode: 'insensitive' as any } },
                { phone: { contains: query } },
                { whatsapp: { contains: query } },
              ],
            },
            take: 5,
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              whatsapp: true,
              category: true,
            },
          });

          results.push({ type, query, contacts });
          continue;
        }

        if (type === 'LIST_OPEN_TICKETS') {
          const limit = Math.min(Math.max(Number(action?.limit || 5), 1), 10);
          const status = String(action?.status || '').trim().toUpperCase();
          const tickets = await this.prisma.ticket.findMany({
            where: {
              tenantId: input.tenantId,
              status: status || { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] },
            } as any,
            take: limit,
            orderBy: { updatedAt: 'desc' },
            include: {
              contact: { select: { name: true, phone: true, email: true } },
            },
          });

          results.push({
            type,
            tickets: tickets.map((ticket) => ({
              id: ticket.id,
              code: ticket.code,
              title: ticket.title,
              status: ticket.status,
              channel: ticket.channel,
              contact: ticket.contact?.name || null,
            })),
          });
          continue;
        }

        if (type === 'GET_PROCESS_SUMMARY') {
          const query = String(action?.query || '').trim();
          if (!query) continue;

          const processes = await this.prisma.process.findMany({
            where: {
              tenantId: input.tenantId,
              OR: [
                { cnj: { contains: query, mode: 'insensitive' as any } },
                { code: { contains: query, mode: 'insensitive' as any } },
                { title: { contains: query, mode: 'insensitive' as any } },
              ],
            },
            take: 3,
            orderBy: { updatedAt: 'desc' },
            include: {
              processParties: {
                where: { isClient: true },
                select: { contact: { select: { name: true } } },
                take: 1,
              },
            },
          });

          results.push({
            type,
            query,
            processes: processes.map((process) => ({
              id: process.id,
              cnj: process.cnj,
              code: process.code,
              title: process.title,
              status: process.status,
              contact: process.processParties?.[0]?.contact?.name || null,
            })),
          });
          continue;
        }

        if (type === 'UPDATE_TICKET_STATUS') {
          const ticketCodeOrId = String(action?.ticketCodeOrId || '').trim();
          const status = String(action?.status || '').trim().toUpperCase();
          if (!ticketCodeOrId || !status) continue;

          const ticket = await this.prisma.ticket.findFirst({
            where: {
              tenantId: input.tenantId,
              OR: [
                { id: ticketCodeOrId },
                ...(Number.isFinite(Number(ticketCodeOrId))
                  ? [{ code: Number(ticketCodeOrId) }]
                  : []),
              ],
            },
          });

          if (!ticket) {
            results.push({ type, ticketCodeOrId, error: 'Ticket nao encontrado' });
            continue;
          }

          await this.ticketsService.updateTicket(
            ticket.id,
            { status },
            input.tenantId,
          );
          results.push({
            type,
            ticketId: ticket.id,
            code: ticket.code,
            status,
          });
          continue;
        }

        if (type === 'ADD_TICKET_NOTE') {
          const content = String(action?.content || '').trim();
          if (!content) continue;

          const note = await this.ticketsService.createSystemMessage(
            input.currentTicketId,
            input.tenantId,
            {
              content: `[Nota DrX-Claw] ${content}`,
              metadata: {
                internal: true,
                generatedBy: 'DRX_CLAW',
              },
            },
          );

          results.push({ type, ticketMessageId: note.id });
        }
      } catch (error: any) {
        results.push({
          type,
          error: error?.message || 'Falha ao executar acao.',
        });
      }
    }

    return results;
  }

  private async synthesizeTelegramReply(input: {
    config: DrxClawConfig;
    runtime: ReturnType<typeof this.resolveRuntime>;
    prompt: string;
    baseReply: string;
    actionResults: any[];
  }) {
    if (input.actionResults.length === 0) {
      return input.baseReply;
    }

    const result = await this.executeRuntimeRequest(
      input.runtime,
      [
        `Assistente: ${input.config.assistantName}`,
        input.config.systemPrompt,
        'Canal: Telegram.',
        'Responda em portugues do Brasil.',
        'Considere os resultados das acoes executadas e entregue uma resposta final curta e objetiva.',
      ].join('\n\n'),
      JSON.stringify(
        {
          prompt: input.prompt,
          respostaBase: input.baseReply,
          resultadosDasAcoes: input.actionResults,
        },
        null,
        2,
      ),
      input.config,
    );

    return this.sanitizeTelegramText(result.answer) || input.baseReply;
  }

  private async buildWhatsappActionPlan(input: {
    config: DrxClawConfig;
    runtime: ReturnType<typeof this.resolveRuntime>;
    prompt: string;
    context: Record<string, any>;
    allowActions: boolean;
  }) {
    const systemPrompt = [
      `Assistente: ${input.config.assistantName}`,
      input.config.systemPrompt,
      'Canal: WhatsApp.',
      'Retorne APENAS JSON valido.',
      'Formato: {"reply":"texto","actions":[{"type":"SEARCH_CONTACT","query":"..." }]}',
      input.allowActions
        ? 'Acoes permitidas: SEARCH_CONTACT(query), LIST_OPEN_TICKETS(limit,status), GET_PROCESS_SUMMARY(query), UPDATE_TICKET_STATUS(ticketCodeOrId,status), ADD_TICKET_NOTE(content).'
        : 'Acoes desabilitadas. Responda apenas com "reply".',
      'A resposta em "reply" deve ser curta, clara e em portugues do Brasil.',
    ].join('\n\n');

    const result = await this.executeRuntimeRequest(
      input.runtime,
      systemPrompt,
      JSON.stringify({
        prompt: input.prompt,
        context: input.context,
      }),
      input.config,
    );

    const parsed = this.extractJsonObject(result.answer);
    return {
      reply: parsed?.reply || result.answer,
      actions: Array.isArray(parsed?.actions) ? parsed.actions : [],
    };
  }

  private async synthesizeWhatsappReply(input: {
    config: DrxClawConfig;
    runtime: ReturnType<typeof this.resolveRuntime>;
    prompt: string;
    baseReply: string;
    actionResults: any[];
  }) {
    if (input.actionResults.length === 0) return input.baseReply;

    const result = await this.executeRuntimeRequest(
      input.runtime,
      [
        `Assistente: ${input.config.assistantName}`,
        input.config.systemPrompt,
        'Canal: WhatsApp.',
        'Resuma os resultados das acoes e responda ao cliente.',
      ].join('\n\n'),
      JSON.stringify({
        prompt: input.prompt,
        respostaBase: input.baseReply,
        resultadosDasAcoes: input.actionResults,
      }),
      input.config,
    );

    return result.answer || input.baseReply;
  }

  async handleIncomingMessage(tenantId: string, conversationId: string, messageId: string) {
    this.logger.debug(`Dr.X Claw handling incoming message ${messageId} for conversation ${conversationId}`);
    
    const message = await this.prisma.agentMessage.findUnique({
      where: { id: messageId },
      include: { conversation: true }
    });

    if (!message || message.direction !== 'INBOUND') {
      return { ignored: true, reason: 'NOT_INBOUND_OR_UNDEFINED' };
    }

    const { conversation } = message;

    // Delegate to channel-specific handling
    if (conversation.channel === 'WHATSAPP') {
       const result = await this.handleWhatsappInbound(
         tenantId,
         message.connectionId || '',
         conversationId,
         message.senderAddress || '',
         message.content || '',
         message.mediaUrl || undefined
       );

       if (result && result.reply) {
         await this.inboxService.sendMessage(tenantId, null, {
           conversationId,
           content: result.reply,
           contentType: 'TEXT'
         });
       }
       return result;
    }

    return { ignored: true, reason: 'UNSUPPORTED_CHANNEL' };
  }

  async handleWhatsappInbound(tenantId: string, connectionId: string, conversationId: string, phone: string, prompt: string, mediaUrl?: string) {
    const { config } = await this.ensureConfigRecord(tenantId);
    if (!config.enabled) return { ignored: true, reason: 'DRX_DISABLED' };

    const triage = await this.triagemService.triageMessage(tenantId, phone, prompt, mediaUrl);
    
    if (triage.action === 'ONBOARDING') {
      return { reply: triage.reply, ticketId: null };
    }

    // Busca o TicketId vinculado à conversa para permitir ações (notas, status)
    const conversation = await this.prisma.agentConversation.findUnique({
      where: { id: conversationId },
      select: { ticketId: true }
    });

    const runtime = this.resolveRuntime(config);
    const context = {
      tenantId,
      phone,
      triage: {
        category: triage.category,
        suggestion: triage.suggestion,
      },
      skills: this.matchSkills(prompt, config.skills),
    };

    const plan = await this.buildWhatsappActionPlan({
      config,
      runtime,
      prompt,
      context,
      allowActions: true,
    });

    const actionResults = await this.executeTelegramActions({
      tenantId,
      currentTicketId: conversation?.ticketId || '', 
      allowActions: true,
      actions: plan.actions,
    });

    const finalReply = await this.synthesizeWhatsappReply({
      config,
      runtime,
      prompt,
      baseReply: plan.reply,
      actionResults,
    });

    return { reply: finalReply, contactId: triage.contact?.id, ticketId: conversation?.ticketId };
  }

  async handleTelegramInbound(connectionId: string, update: any) {
    const connection = await this.prisma.connection.findFirst({
      where: { id: connectionId, type: 'TELEGRAM' },
    });

    if (!connection || connection.status === 'DISCONNECTED') {
      return { ignored: true };
    }

    const message = update?.message || update?.edited_message;
    if (!message || message?.from?.is_bot) {
      return { ignored: true };
    }

    const chatId = String(message?.chat?.id || '').trim();
    const userId = String(message?.from?.id || '').trim();
    let prompt = this.sanitizeTelegramText(message?.text || message?.caption);
    const forcedSkillIds: string[] = [];

    // PDF / Audio Handling
    if (message?.voice || message?.audio || message?.document) {
      try {
        if (message.voice || message.audio) {
          await this.telegramService.sendChatAction(connectionId, chatId, 'record_voice');
          const fileId = (message.voice || message.audio).file_id;
          const localPath = await this.telegramService.downloadTelegramFile(connectionId, fileId);
          const { config: latestConfig } = await this.ensureConfigRecord(connection.tenantId);
          const transcript = await WhisperTranscription.transcribe(localPath, latestConfig);
          if (transcript) {
            prompt = prompt ? `${prompt}\n\n[Transcrição do áudio]: ${transcript}` : transcript;
          }
          if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
        } else if (message.document && (message.document.mime_type === 'application/pdf' || message.document.file_name?.endsWith('.pdf'))) {
          await this.telegramService.sendChatAction(connectionId, chatId, 'upload_document');
          const fileId = message.document.file_id;
          const localPath = await this.telegramService.downloadTelegramFile(connectionId, fileId);
          const pdfText = await PdfExtractor.extract(localPath);
          if (pdfText) {
            prompt = prompt ? `${prompt}\n\n[Conteúdo do PDF]: ${pdfText}` : `[Arquivo: ${message.document.file_name}]\n\n${pdfText}`;
            forcedSkillIds.push(PROCESS_PDF_SKILL_ID);
          }
          if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
        }
      } catch (err: any) {
        this.logger.error(`Error processing media in telegram: ${err.message}`);
      }
    }

    if (!chatId) {
      return { ignored: true };
    }

    const { config } = await this.ensureConfigRecord(connection.tenantId);

    if (!config.enabled) {
      return {
        tenantId: connection.tenantId,
        ticketId: null,
        chatId,
        reply: 'O DrX-Claw esta desativado para esta empresa no momento.',
        replyToMessageId: Number(message?.message_id) || undefined,
      };
    }

    const whitelist = (config.telegramWhitelist || []).map((item) =>
      String(item).trim(),
    );
    const authorized =
      whitelist.length === 0 ||
      whitelist.includes(chatId) ||
      whitelist.includes(userId);
    const allowActions =
      whitelist.length > 0 &&
      (whitelist.includes(chatId) || whitelist.includes(userId));

    if (!authorized) {
      return {
        tenantId: connection.tenantId,
        ticketId: null,
        chatId,
        reply: 'Acesso nao autorizado para este bot.',
        replyToMessageId: Number(message?.message_id) || undefined,
      };
    }

    if (!prompt) {
      return {
        ignored: true,
        reason: 'NO_TEXT_CONTENT',
      };
    }

    const inbound = await this.communicationsService.processIncoming({
      tenantId: connection.tenantId,
      channel: 'TELEGRAM',
      from: userId,
      name: this.buildTelegramDisplayName(message),
      content: prompt,
      connectionId,
      externalThreadId: chatId,
      externalMessageId: `${chatId}:${message?.message_id}`,
      contentType: 'TEXT',
      metadata: {
        telegramChatId: chatId,
        telegramUserId: userId,
        telegramUsername: message?.from?.username || null,
        telegramChatType: message?.chat?.type || null,
        telegramMessageId: message?.message_id || null,
        telegramMessageDate: message?.date || null,
      },
    } as any);

    if (inbound?.created === false) {
      return {
        ignored: true,
        reason: 'DUPLICATE_UPDATE',
        tenantId: connection.tenantId,
        ticketId: inbound?.ticketId || null,
        chatId,
      };
    }

    const ticketId = String(inbound?.ticketId || '').trim();
    if (!ticketId) {
      return { ignored: true };
    }

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId: connection.tenantId },
      include: {
        contact: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 8,
        },
      },
    });

    if (!ticket) {
      return { ignored: true };
    }

    const runtime = this.resolveRuntime(config);
    const context = {
      tenantId: connection.tenantId,
      ticket: {
        id: ticket.id,
        code: ticket.code,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        queue: ticket.queue,
        channel: ticket.channel,
      },
      contact: ticket.contact
        ? {
            id: ticket.contact.id,
            name: ticket.contact.name,
            email: ticket.contact.email,
            phone: ticket.contact.phone,
            whatsapp: ticket.contact.whatsapp,
            category: ticket.contact.category,
          }
        : null,
      recentMessages: ticket.messages
        .slice()
        .reverse()
        .map((item) => ({
          senderType: item.senderType,
          content: item.content,
          createdAt: item.createdAt,
        })),
    };

    const plan = await this.buildTelegramActionPlan({
      config,
      runtime,
      prompt,
      context,
      allowActions,
    });

    const actionResults = await this.executeTelegramActions({
      tenantId: connection.tenantId,
      currentTicketId: ticket.id,
      allowActions,
      actions: plan.actions,
    });

    const reply = await this.synthesizeTelegramReply({
      config,
      runtime,
      prompt,
      baseReply:
        plan.reply ||
        'Recebi sua mensagem e estou processando os proximos passos no sistema.',
      actionResults,
    });

    return {
      tenantId: connection.tenantId,
      ticketId: ticket.id,
      chatId,
      reply,
      replyToMessageId: Number(message?.message_id) || undefined,
      actionResults,
    };
  }

  async registerTelegramOutbound(input: {
    tenantId: string;
    ticketId: string;
    connectionId: string;
    chatId: string;
    content: string;
    externalMessageId?: string | null;
    replyToMessageId?: number;
  }) {
    return this.ticketsService.createSystemMessage(input.ticketId, input.tenantId, {
      content: input.content,
      externalId: input.externalMessageId || null,
      metadata: {
        connectionId: input.connectionId,
        externalThreadId: input.chatId,
        senderAddress: input.chatId,
        channel: 'TELEGRAM',
        replyToMessageId: input.replyToMessageId || null,
      },
    });
  }

  async getConfig(tenantId: string) {
    const { record, config } = await this.ensureConfigRecord(tenantId);

    return {
      id: record.id,
      status: record.status,
      config,
      summary: {
        enabledSkills: config.skills.filter((skill) => skill.enabled).length,
        systemSkills: config.skills.filter((skill) => skill.scope === "SYSTEM")
          .length,
        customSkills: config.skills.filter((skill) => skill.scope !== "SYSTEM")
          .length,
        whitelistCount: config.telegramWhitelist.length,
        provider: config.provider,
        model: this.getProviderModel(config),
      },
    };
  }

  async getCatalog(tenantId: string, payload?: any) {
    const { config: storedConfig } = await this.ensureConfigRecord(tenantId);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    const config = this.mergeConfig(payload?.config || storedConfig, tenant?.name);
    const providers = await this.buildProviderCatalog(config);

    return {
      generatedAt: new Date().toISOString(),
      activeProvider: this.normalizeProvider(config.provider),
      providers,
    };
  }

  async validateProvider(tenantId: string, payload?: any) {
    const { config: storedConfig } = await this.ensureConfigRecord(tenantId);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    const config = this.mergeConfig(payload?.config || storedConfig, tenant?.name);
    const provider = this.normalizeProvider(payload?.provider || config.provider);
    const runtime = this.resolveRuntime(config, provider);
    const readiness = this.getRuntimeReadiness(runtime);

    if (!runtime.supported || !readiness.ready) {
      return {
        ok: false,
        provider,
        label: runtime.label,
        model: runtime.model,
        message: this.describeMissingRequirements(runtime, readiness.missing),
      };
    }

    const startedAt = Date.now();
    const result = await this.executeRuntimeRequest(
      runtime,
      "Responda de forma direta. Se estiver tudo certo, responda apenas OK.",
      "Responda apenas OK.",
      {
        ...config,
        playground: {
          ...config.playground,
          maxTokens: Math.min(Number(config.playground.maxTokens || 128), 128),
          temperature: 0,
        },
      },
    );

    return {
      ok: result.mode === "live" && !result.error,
      provider,
      label: runtime.label,
      model: runtime.model,
      latencyMs: Date.now() - startedAt,
      message:
        result.mode === "live" && !result.error
          ? result.answer
          : result.error || "Falha ao validar provider.",
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
    const forcedSkillIds = this.sanitizeSkillIds(
      payload?.forceSkillIds || payload?.skillIds,
    );

    const { record, config: storedConfig } =
      await this.ensureConfigRecord(tenantId);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    const config = this.mergeConfig(
      payload?.config || storedConfig,
      tenant?.name,
    );
    const matchedSkills = this.resolveMatchedSkills(
      prompt,
      config.skills,
      forcedSkillIds,
    );
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

    const result = await this.executeRuntimeRequest(
      runtime,
      systemPrompt,
      `[Cenario: ${scenario}]\n${prompt}`,
      config,
    );

    const answer =
      result.answer ||
      this.buildPreviewAnswer(
        config,
        runtime,
        prompt,
        matchedSkills,
        result.error,
      );

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
      mode: result.mode,
      provider: runtime.label,
      model: runtime.model,
      matchedSkills,
      answer,
      error: result.error,
      systemPrompt,
    };
  }
}
