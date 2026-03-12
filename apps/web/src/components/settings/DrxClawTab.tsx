import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  KeyRound,
  MessageSquareText,
  PlayCircle,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../services/api";

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
  customModels: Record<string, string[]>;
  playground: {
    temperature: number;
    maxTokens: number;
    lastPrompt: string;
    lastResponse: string;
    lastRunAt: string | null;
  };
  skills: DrxSkill[];
};

type PlaygroundResponse = {
  mode: string;
  provider: string;
  model: string;
  matchedSkills: Array<DrxSkill & { score?: number }>;
  answer: string;
  error?: string | null;
  systemPrompt: string;
};

type ProviderModelOption = {
  id: string;
  label: string;
  source: "live" | "fallback" | "custom" | "selected";
  status: "stable" | "preview" | "alias" | "custom";
};

type ProviderCatalogEntry = {
  provider: string;
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

type ProviderValidation = {
  ok: boolean;
  provider: string;
  label: string;
  model: string;
  latencyMs?: number;
  message: string;
};

const EMPTY_CONFIG: DrxClawConfig = {
  enabled: true,
  assistantName: "DrX-Claw",
  companyLabel: "",
  provider: "LOCAL",
  maxIterations: 5,
  systemPrompt:
    "Você é o DrX-Claw da empresa. Responda com clareza, contexto de negócio e próximo passo acionável.",
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
  customModels: {
    OPENAI: [],
    GEMINI: [],
    CLAUDE: [],
    GROQ: [],
    DEEPSEEK: [],
    OPENAI_COMPATIBLE: [],
    LOCAL: [],
  },
  playground: {
    temperature: 0.4,
    maxTokens: 800,
    lastPrompt: "",
    lastResponse: "",
    lastRunAt: null,
  },
  skills: [],
};

const QUICK_SKILLS: Array<Omit<DrxSkill, "id">> = [
  {
    name: "Atendimento Inicial",
    description: "Recebe a demanda, qualifica urgência e define próximo passo.",
    instructions:
      "Faça triagem objetiva, identifique urgência, documentos faltantes e a ação recomendada.",
    triggerKeywords: ["triagem", "atendimento", "novo cliente", "qualificação"],
    enabled: true,
  },
  {
    name: "Cobrança Inteligente",
    description: "Organiza cobrança com tom profissional e amigável.",
    instructions:
      "Considere vencimento, valor, proposta de negociação e encaminhe uma mensagem clara.",
    triggerKeywords: ["cobrança", "boleto", "financeiro", "pagamento"],
    enabled: true,
  },
  {
    name: "Agenda e Retorno",
    description: "Transforma mensagens em lembretes, agenda e follow-ups.",
    instructions:
      "Resuma o caso, proponha data de retorno, horário e responsável sugerido.",
    triggerKeywords: ["agenda", "retorno", "follow-up", "prazo"],
    enabled: true,
  },
];

const PLAYGROUND_PRESETS = [
  {
    label: "Cobrança vencida",
    scenario: "Financeiro",
    prompt:
      "Quero enviar uma mensagem para um cliente avisando que a parcela venceu nesta semana e oferecer uma opção de negociação.",
  },
  {
    label: "Triagem inicial",
    scenario: "Atendimento",
    prompt:
      "Novo cliente relatou problema contratual e enviará documentos amanhã. Como o DrX-Claw deve responder?",
  },
  {
    label: "Follow-up",
    scenario: "Relacionamento",
    prompt:
      "Preciso retomar um atendimento parado há 7 dias e sugerir os próximos passos com tom consultivo.",
  },
];

const generateSkillId = (name: string) =>
  `${name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

const getProviderModel = (config: DrxClawConfig) => {
  const provider = String(config.provider || "LOCAL").toUpperCase();

  if (
    provider === "LOCAL" ||
    provider === "OLLAMA" ||
    provider === "LMSTUDIO"
  ) {
    return config.local.model;
  }

  if (provider === "OPENAI") {
    return config.openaiCompatible.model || "gpt-4o-mini";
  }

  if (provider === "GROQ") {
    return config.openaiCompatible.model || "llama-3.3-70b-versatile";
  }

  if (provider === "DEEPSEEK") {
    return config.openaiCompatible.model || "deepseek-chat";
  }

  if (provider === "GEMINI") {
    return config.openaiCompatible.model || "gemini-2.5-flash";
  }

  if (provider === "CLAUDE") {
    return config.openaiCompatible.model || "claude-sonnet-4-20250514";
  }

  return config.openaiCompatible.model;
};

const usesFixedRemoteEndpoint = (providerInput: string) =>
  ["OPENAI", "GROQ", "DEEPSEEK", "GEMINI", "CLAUDE"].includes(
    String(providerInput || "").toUpperCase(),
  );

const getProviderLabel = (providerInput: string) => {
  const provider = String(providerInput || "").toUpperCase();

  if (provider === "OPENAI") return "OpenAI";
  if (provider === "GEMINI") return "Gemini";
  if (provider === "CLAUDE") return "Claude";
  if (provider === "GROQ") return "Groq";
  if (provider === "DEEPSEEK") return "DeepSeek";
  if (provider === "OPENAI_COMPATIBLE") return "OpenAI Compatible";
  if (provider === "LOCAL") return "IA Local";
  if (provider === "OLLAMA") return "Ollama";
  if (provider === "LMSTUDIO") return "LM Studio";
  return provider || "Provider";
};

const getRemoteModelLabel = (providerInput: string) => {
  const provider = String(providerInput || "").toUpperCase();

  if (provider === "OPENAI") return "Modelo OpenAI";
  if (provider === "GEMINI") return "Modelo Gemini";
  if (provider === "CLAUDE") return "Modelo Claude";
  if (provider === "GROQ") return "Modelo Groq";
  if (provider === "DEEPSEEK") return "Modelo DeepSeek";
  return "Modelo";
};

const getRemoteModelHint = (providerInput: string) => {
  const provider = String(providerInput || "").toUpperCase();

  if (provider === "OPENAI") {
    return "Se deixar vazio, o sistema usa gpt-4o-mini.";
  }

  if (provider === "GEMINI") {
    return "Se deixar vazio, o sistema usa gemini-2.5-flash.";
  }

  if (provider === "CLAUDE") {
    return "Se deixar vazio, o sistema usa claude-sonnet-4-20250514.";
  }

  if (provider === "GROQ") {
    return "Se deixar vazio, o sistema usa llama-3.3-70b-versatile.";
  }

  if (provider === "DEEPSEEK") {
    return "Se deixar vazio, o sistema usa deepseek-chat.";
  }

  return undefined;
};

const SUB_TABS = [
  { id: "operacao", label: "Operacao" },
  { id: "modelos", label: "Modelos" },
  { id: "skills", label: "Skills" },
  { id: "playground", label: "Playground" },
] as const;

const Field = ({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) => (
  <label className="space-y-2">
    <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
      {label}
    </span>
    {children}
    {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
  </label>
);

export function DrxClawTab() {
  const [config, setConfig] = useState<DrxClawConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [activeSubTab, setActiveSubTab] =
    useState<(typeof SUB_TABS)[number]["id"]>("operacao");
  const [playgroundPrompt, setPlaygroundPrompt] = useState("");
  const [playgroundScenario, setPlaygroundScenario] = useState("Livre");
  const [playgroundResponse, setPlaygroundResponse] =
    useState<PlaygroundResponse | null>(null);
  const [providerCatalog, setProviderCatalog] = useState<ProviderCatalogEntry[]>(
    [],
  );
  const [providerValidation, setProviderValidation] =
    useState<ProviderValidation | null>(null);
  const [customModelInput, setCustomModelInput] = useState("");
  const [newSkill, setNewSkill] = useState({
    name: "",
    description: "",
    instructions: "",
    triggerKeywords: "",
  });

  const enabledSkills = useMemo(
    () => config.skills.filter((skill) => skill.enabled),
    [config.skills],
  );

  const selectedCatalog = useMemo(
    () =>
      providerCatalog.find(
        (entry) =>
          entry.provider === String(config.provider || "").toUpperCase(),
      ) || null,
    [config.provider, providerCatalog],
  );

  const readiness = useMemo(() => {
    let score = 0;

    if (config.enabled) score += 20;
    if (config.systemPrompt.trim()) score += 15;
    if (config.telegramWhitelist.length > 0) score += 15;
    if (enabledSkills.length > 0) score += 15;
    if (
      config.provider === "LOCAL"
        ? config.local.baseUrl.trim() && config.local.model.trim()
        : config.provider === "OPENAI"
          ? config.apiKeys.openai.trim()
          : config.provider === "GROQ"
            ? config.apiKeys.groq.trim()
            : config.provider === "DEEPSEEK"
              ? config.apiKeys.deepseek.trim()
              : config.provider === "GEMINI"
                ? config.apiKeys.gemini.trim()
                : config.provider === "CLAUDE"
                  ? config.apiKeys.claude.trim()
              : config.openaiCompatible.baseUrl.trim() &&
                config.openaiCompatible.model.trim()
    ) {
      score += 35;
    }

    return Math.min(score, 100);
  }, [config, enabledSkills.length]);

  const loadCatalog = async (draftConfig: DrxClawConfig) => {
    try {
      setCatalogLoading(true);
      const response = await api.post("/drx-claw/catalog", {
        config: draftConfig,
      });
      setProviderCatalog(response.data?.providers || []);
    } catch (error) {
      console.error("Erro ao carregar catalogo do DrX-Claw:", error);
      toast.error("Nao foi possivel carregar o catalogo dos providers");
    } finally {
      setCatalogLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get("/drx-claw/config");
      const loadedConfig = response.data?.config || EMPTY_CONFIG;

      setConfig(loadedConfig);
      setProviderValidation(null);
      setPlaygroundPrompt(
        loadedConfig.playground?.lastPrompt || PLAYGROUND_PRESETS[0].prompt,
      );
      setPlaygroundResponse(
        loadedConfig.playground?.lastResponse
          ? {
              mode: "history",
              provider: loadedConfig.provider,
              model: getProviderModel(loadedConfig),
              matchedSkills: [],
              answer: loadedConfig.playground.lastResponse,
              systemPrompt: loadedConfig.systemPrompt,
            }
          : null,
      );
      await loadCatalog(loadedConfig);
    } catch (error) {
      console.error("Erro ao carregar DrX-Claw:", error);
      toast.error("Não foi possível carregar a configuração do DrX-Claw");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const updateConfig = (patch: Partial<DrxClawConfig>) => {
    setConfig((current) => ({ ...current, ...patch }));
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      await api.post("/drx-claw/config", config);
      await loadCatalog(config);
      toast.success("DrX-Claw salvo com sucesso");
    } catch (error) {
      console.error("Erro ao salvar DrX-Claw:", error);
      toast.error("Não foi possível salvar o DrX-Claw");
    } finally {
      setSaving(false);
    }
  };

  const validateCurrentProvider = async () => {
    try {
      setValidating(true);
      const response = await api.post("/drx-claw/validate", {
        provider: config.provider,
        config,
      });
      setProviderValidation(response.data);
      if (response.data?.ok) {
        toast.success("Provider validado com resposta ao vivo");
      } else {
        toast.error(response.data?.message || "Falha ao validar provider");
      }
    } catch (error) {
      console.error("Erro ao validar provider:", error);
      toast.error("Não foi possível validar o provider atual");
    } finally {
      setValidating(false);
    }
  };

  const selectModel = (modelId: string) => {
    setProviderCatalog((current) =>
      current.map((entry) =>
        entry.provider === String(config.provider || "").toUpperCase()
          ? { ...entry, selectedModel: modelId }
          : entry,
      ),
    );

    if (
      config.provider === "LOCAL" ||
      config.provider === "OLLAMA" ||
      config.provider === "LMSTUDIO"
    ) {
      updateConfig({
        local: { ...config.local, model: modelId },
      });
      return;
    }

    updateConfig({
      openaiCompatible: {
        ...config.openaiCompatible,
        model: modelId,
      },
    });
  };

  const addCustomModel = () => {
    const model = customModelInput.trim();
    const providerKey = String(config.provider || "LOCAL").toUpperCase();

    if (!model) {
      toast.error("Informe o nome do modelo para incluir");
      return;
    }

    if ((config.customModels?.[providerKey] || []).includes(model)) {
      toast.message("Esse modelo já está na lista manual");
      return;
    }

    updateConfig({
      customModels: {
        ...config.customModels,
        [providerKey]: [...(config.customModels?.[providerKey] || []), model],
      },
    });
    setProviderCatalog((current) =>
      current.map((entry) =>
        entry.provider === providerKey
          ? {
              ...entry,
              models: [
                ...entry.models,
                {
                  id: model,
                  label: model,
                  source: "custom",
                  status: "custom",
                },
              ],
            }
          : entry,
      ),
    );
    setCustomModelInput("");
  };

  const removeCustomModel = (modelId: string) => {
    const providerKey = String(config.provider || "LOCAL").toUpperCase();
    updateConfig({
      customModels: {
        ...config.customModels,
        [providerKey]: (config.customModels?.[providerKey] || []).filter(
          (item) => item !== modelId,
        ),
      },
    });
    setProviderCatalog((current) =>
      current.map((entry) =>
        entry.provider === providerKey
          ? {
              ...entry,
              models: entry.models.filter(
                (item) =>
                  !(
                    item.source === "custom" &&
                    item.id.toLowerCase() === modelId.toLowerCase()
                  ),
              ),
            }
          : entry,
      ),
    );
  };

  const addSkill = () => {
    if (!newSkill.name.trim() || !newSkill.description.trim()) {
      toast.error("Informe pelo menos nome e descrição da skill");
      return;
    }

    setConfig((current) => ({
      ...current,
      skills: [
        ...current.skills,
        {
          id: generateSkillId(newSkill.name),
          name: newSkill.name.trim(),
          description: newSkill.description.trim(),
          instructions: newSkill.instructions.trim(),
          triggerKeywords: newSkill.triggerKeywords
            .split(",")
            .map((keyword) => keyword.trim())
            .filter(Boolean),
          enabled: true,
        },
      ],
    }));

    setNewSkill({
      name: "",
      description: "",
      instructions: "",
      triggerKeywords: "",
    });
  };

  const addQuickSkill = (skill: Omit<DrxSkill, "id">) => {
    if (config.skills.some((item) => item.name === skill.name)) {
      toast.message("Essa skill já está na lista");
      return;
    }

    setConfig((current) => ({
      ...current,
      skills: [
        ...current.skills,
        { ...skill, id: generateSkillId(skill.name) },
      ],
    }));
  };

  const removeSkill = (skillId: string) => {
    setConfig((current) => ({
      ...current,
      skills: current.skills.filter((skill) => skill.id !== skillId),
    }));
  };

  const runPlayground = async () => {
    try {
      setTesting(true);
      const response = await api.post("/drx-claw/playground", {
        scenario: playgroundScenario,
        prompt: playgroundPrompt,
        config,
      });
      setPlaygroundResponse(response.data);
      updateConfig({
        playground: {
          ...config.playground,
          lastPrompt: playgroundPrompt,
          lastResponse: response.data.answer,
          lastRunAt: new Date().toISOString(),
        },
      });
      toast.success(
        response.data.mode === "live"
          ? "Playground respondeu ao vivo"
          : "Playground gerou prévia assistida",
      );
    } catch (error) {
      console.error("Erro no playground:", error);
      toast.error("Não foi possível executar o playground");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-slate-400">
        Carregando painel do DrX-Claw...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-3 duration-500">
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 text-xs font-medium mb-4">
              <Bot size={14} />
              Painel Operacional do DrX-Claw
            </div>
            <h3 className="text-2xl font-semibold text-white">
              Configuração por empresa, com teste na mesma tela
            </h3>
            <p className="text-slate-400 mt-2 max-w-3xl">
              Configure provider, segurança, skills e um playground para o admin
              validar o comportamento antes de colocar o agente em produção.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadConfig}
              className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Recarregar
            </button>
            <button
              onClick={saveConfig}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? "Salvando..." : "Salvar configuração"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">
              Prontidão
            </p>
            <div className="flex items-end justify-between gap-3">
              <span className="text-3xl font-semibold text-white">
                {readiness}%
              </span>
              <span className="text-sm text-slate-400">
                {config.enabled ? "ativo" : "pausado"}
              </span>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">
              Skills ativas
            </p>
            <div className="flex items-end justify-between gap-3">
              <span className="text-3xl font-semibold text-white">
                {enabledSkills.length}
              </span>
              <span className="text-sm text-slate-400">
                {config.skills.length} cadastradas
              </span>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">
              Provider atual
            </p>
            <div className="text-lg font-semibold text-white">
              {config.provider}
            </div>
            <div className="text-sm text-slate-400 mt-1">
              {getProviderModel(config) || "Defina um modelo"}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">
              Whitelist Telegram
            </p>
            <div className="text-3xl font-semibold text-white">
              {config.telegramWhitelist.length}
            </div>
            <div className="text-sm text-slate-400 mt-1">IDs autorizados</div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
              activeSubTab === tab.id
                ? "border-indigo-500 bg-indigo-500/15 text-indigo-100"
                : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-6">
        <div className="space-y-6">
          <div
            className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 ${
              activeSubTab === "operacao" ? "" : "hidden"
            }`}
          >
            <div className="flex items-center gap-3 mb-5">
              <Settings2 className="text-indigo-300" size={20} />
              <h4 className="text-lg font-semibold text-white">
                Setup principal
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nome do assistente">
                <input
                  value={config.assistantName}
                  onChange={(e) =>
                    updateConfig({ assistantName: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </Field>
              <Field label="Empresa vinculada">
                <input
                  value={config.companyLabel}
                  onChange={(e) =>
                    updateConfig({ companyLabel: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </Field>
              <Field label="Provider principal">
                <select
                  value={config.provider}
                  onChange={(e) => updateConfig({ provider: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="LOCAL">IA Local (Ollama / LM Studio)</option>
                  <option value="OPENAI">OpenAI</option>
                  <option value="GROQ">Groq</option>
                  <option value="DEEPSEEK">DeepSeek</option>
                  <option value="OPENAI_COMPATIBLE">OpenAI Compatible</option>
                  <option value="GEMINI">Gemini</option>
                  <option value="CLAUDE">Claude</option>
                </select>
              </Field>
              <Field label="Max iterations">
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={config.maxIterations}
                  onChange={(e) =>
                    updateConfig({ maxIterations: Number(e.target.value) || 1 })
                  }
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 mt-4">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800">
                <input
                  id="drx-claw-enabled"
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => updateConfig({ enabled: e.target.checked })}
                  className="rounded border-slate-600 bg-slate-900 text-indigo-500"
                />
                <label
                  htmlFor="drx-claw-enabled"
                  className="text-sm text-slate-200"
                >
                  DrX-Claw habilitado para esta empresa
                </label>
              </div>
              <Field
                label="Whitelist Telegram (IDs)"
                hint="Separe por vírgula. Ex.: 12345678, 87654321"
              >
                <input
                  value={config.telegramWhitelist.join(", ")}
                  onChange={(e) =>
                    updateConfig({
                      telegramWhitelist: e.target.value
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </Field>
            </div>

            <Field
              label="Prompt-base do agente"
              hint="Define personalidade, regras de negócio e saída esperada do DrX-Claw."
            >
              <textarea
                value={config.systemPrompt}
                onChange={(e) => updateConfig({ systemPrompt: e.target.value })}
                className="w-full min-h-[140px] px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </Field>
          </div>

          <div
            className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 ${
              activeSubTab === "operacao" || activeSubTab === "modelos"
                ? ""
                : "hidden"
            }`}
          >
            <div className="flex items-center gap-3 mb-5">
              <KeyRound className="text-emerald-300" size={20} />
              <h4 className="text-lg font-semibold text-white">
                Providers e credenciais
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="API OpenAI">
                <input
                  value={config.apiKeys.openai}
                  onChange={(e) =>
                    updateConfig({
                      apiKeys: { ...config.apiKeys, openai: e.target.value },
                    })
                  }
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </Field>
              <Field label="API Groq">
                <input
                  value={config.apiKeys.groq}
                  onChange={(e) =>
                    updateConfig({
                      apiKeys: { ...config.apiKeys, groq: e.target.value },
                    })
                  }
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </Field>
              <Field label="API DeepSeek">
                <input
                  value={config.apiKeys.deepseek}
                  onChange={(e) =>
                    updateConfig({
                      apiKeys: { ...config.apiKeys, deepseek: e.target.value },
                    })
                  }
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </Field>
              <Field label="API Gemini">
                <input
                  value={config.apiKeys.gemini}
                  onChange={(e) =>
                    updateConfig({
                      apiKeys: { ...config.apiKeys, gemini: e.target.value },
                    })
                  }
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </Field>
              <Field label="API Claude">
                <input
                  value={config.apiKeys.claude}
                  onChange={(e) =>
                    updateConfig({
                      apiKeys: { ...config.apiKeys, claude: e.target.value },
                    })
                  }
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-6">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-slate-200 font-medium">
                  <BrainCircuit size={18} className="text-indigo-300" />
                  IA Local / LM Studio / Ollama
                </div>
                <Field label="Base URL">
                  <input
                    value={config.local.baseUrl}
                    onChange={(e) =>
                      updateConfig({
                        local: { ...config.local, baseUrl: e.target.value },
                      })
                    }
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </Field>
                <Field label="Modelo local">
                  <input
                    value={config.local.model}
                    onChange={(e) =>
                      updateConfig({
                        local: { ...config.local, model: e.target.value },
                      })
                    }
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </Field>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-slate-200 font-medium">
                  <Sparkles size={18} className="text-emerald-300" />
                  Modelo do provider remoto
                </div>
                {usesFixedRemoteEndpoint(config.provider) ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    Este provider usa endpoint oficial fixo. Basta informar a
                    chave da API e, se quiser, sobrescrever o modelo padrao.
                  </div>
                ) : (
                  <Field label="Base URL">
                    <input
                      value={config.openaiCompatible.baseUrl}
                      onChange={(e) =>
                        updateConfig({
                          openaiCompatible: {
                            ...config.openaiCompatible,
                            baseUrl: e.target.value,
                          },
                        })
                      }
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </Field>
                )}
                <Field
                  label={getRemoteModelLabel(config.provider)}
                  hint={getRemoteModelHint(config.provider)}
                >
                  <input
                    value={config.openaiCompatible.model}
                    onChange={(e) =>
                      updateConfig({
                        openaiCompatible: {
                          ...config.openaiCompatible,
                          model: e.target.value,
                        },
                      })
                    }
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </Field>
              </div>
            </div>
          </div>

          <div
            className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 ${
              activeSubTab === "modelos" ? "" : "hidden"
            }`}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <BrainCircuit className="text-emerald-300" size={20} />
                  <h4 className="text-lg font-semibold text-white">
                    Catalogo de modelos
                  </h4>
                </div>
                <p className="text-sm text-slate-400 max-w-3xl">
                  Lista operacional por provider com tentativa de consulta ao vivo
                  quando a chave estiver preenchida. O listbox abaixo tambem
                  aceita modelos personalizados para reduzir a margem de erro e
                  acompanhar novos releases.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => loadCatalog(config)}
                  disabled={catalogLoading}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                    className={catalogLoading ? "animate-spin" : ""}
                  />
                  Atualizar catalogo
                </button>
                <button
                  onClick={validateCurrentProvider}
                  disabled={validating}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle2 size={16} />
                  {validating ? "Validando..." : "Validar provider atual"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-6">
              {providerCatalog.map((entry) => (
                <button
                  key={entry.provider}
                  onClick={() => updateConfig({ provider: entry.provider })}
                  className={`text-left rounded-xl border p-4 transition-colors ${
                    String(config.provider || "").toUpperCase() === entry.provider
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-slate-800 bg-slate-950 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-white">
                      {entry.label}
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-[10px] uppercase tracking-[0.16em] ${
                        entry.canValidate
                          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                          : entry.supported
                            ? "bg-amber-500/10 border border-amber-500/20 text-amber-200"
                            : "bg-slate-800 border border-slate-700 text-slate-400"
                      }`}
                    >
                      {entry.canValidate
                        ? "pronto"
                        : entry.supported
                          ? "configurar"
                          : "indisponivel"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    {entry.selectedModel || entry.defaultModel || "Sem modelo"}
                  </div>
                  <div className="text-xs text-slate-400 mt-3 line-clamp-2">
                    {entry.note}
                  </div>
                </button>
              ))}
            </div>

            {selectedCatalog && (
              <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {selectedCatalog.label}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {selectedCatalog.note}
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <div>
                          {selectedCatalog.fetchedLiveModels
                            ? "catalogo ao vivo"
                            : "fallback oficial"}
                        </div>
                        <div className="mt-1">
                          {selectedCatalog.models.length} modelo(s)
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h5 className="text-white font-medium">ListBox de modelos</h5>
                        <p className="text-xs text-slate-500 mt-1">
                          Toque em um item para definir o modelo do provider atual.
                        </p>
                      </div>
                      <div className="text-xs text-slate-500">
                        selecionado: {selectedCatalog.selectedModel || selectedCatalog.defaultModel}
                      </div>
                    </div>

                    <div
                      role="listbox"
                      aria-label={`Modelos de ${selectedCatalog.label}`}
                      className="mt-4 max-h-[420px] overflow-y-auto space-y-2 pr-1"
                    >
                      {selectedCatalog.models.map((model) => {
                        const active =
                          getProviderModel(config).trim().toLowerCase() ===
                          model.id.trim().toLowerCase();
                        const isCustom = model.source === "custom";

                        return (
                          <div
                            key={`${selectedCatalog.provider}-${model.id}`}
                            className={`rounded-xl border px-3 py-3 transition-colors ${
                              active
                                ? "border-indigo-500 bg-indigo-500/10"
                                : "border-slate-800 bg-slate-950"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <button
                                onClick={() => selectModel(model.id)}
                                className="min-w-0 flex-1 text-left"
                              >
                                <div className="truncate text-sm font-medium text-white">
                                  {model.label}
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2 text-[10px] uppercase tracking-[0.16em]">
                                  <span className="rounded-full border border-slate-700 px-2 py-1 text-slate-300">
                                    {model.source}
                                  </span>
                                  <span className="rounded-full border border-slate-700 px-2 py-1 text-slate-400">
                                    {model.status}
                                  </span>
                                </div>
                              </button>

                              {isCustom && (
                                <button
                                  onClick={() => removeCustomModel(model.id)}
                                  className="p-2 rounded-lg border border-red-500/20 text-red-300 hover:bg-red-500/10 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                    <h5 className="text-white font-medium">Incluir novo modelo</h5>
                    <p className="text-xs text-slate-500 mt-1">
                      Use quando o provider liberar um modelo novo antes do
                      catalogo oficial aparecer aqui.
                    </p>
                    <div className="mt-4 flex gap-3">
                      <input
                        value={customModelInput}
                        onChange={(e) => setCustomModelInput(e.target.value)}
                        placeholder="Ex: gpt-4.1-mini"
                        className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        onClick={addCustomModel}
                        className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-2"
                      >
                        <Plus size={16} />
                        Incluir
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
                    <h5 className="text-white font-medium">Prontidao do provider</h5>
                    <div className="text-sm text-slate-300">
                      {selectedCatalog.canValidate
                        ? `${selectedCatalog.label} esta pronto para validacao ao vivo.`
                        : selectedCatalog.note}
                    </div>
                    {providerValidation &&
                      providerValidation.provider === selectedCatalog.provider && (
                        <div
                          className={`rounded-xl border px-4 py-3 text-sm ${
                            providerValidation.ok
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                              : "border-amber-500/20 bg-amber-500/10 text-amber-100"
                          }`}
                        >
                          <div className="font-medium">
                            {providerValidation.ok
                              ? "Validacao concluida"
                              : "Validacao pendente"}
                          </div>
                          <div className="mt-2 text-xs">
                            {providerValidation.model}
                            {providerValidation.latencyMs
                              ? ` • ${providerValidation.latencyMs} ms`
                              : ""}
                          </div>
                          <div className="mt-2 whitespace-pre-wrap">
                            {providerValidation.message}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
            className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 ${
              activeSubTab === "skills" ? "" : "hidden"
            }`}
          >
            <div className="flex items-center gap-3 mb-5">
              <Wand2 className="text-purple-300" size={20} />
              <h4 className="text-lg font-semibold text-white">
                Skills operacionais
              </h4>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_0.8fr] gap-6">
              <div className="space-y-4">
                {config.skills.length === 0 && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-dashed border-slate-700 text-sm text-slate-400">
                    Nenhuma skill cadastrada ainda. Use os presets ao lado ou
                    crie a primeira manualmente.
                  </div>
                )}

                {config.skills.map((skill) => (
                  <div
                    key={skill.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h5 className="text-white font-medium">
                            {skill.name}
                          </h5>
                          {skill.enabled ? (
                            <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                              ativa
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                              pausada
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400">
                          {skill.description}
                        </p>
                        <p className="text-xs text-slate-500">
                          {skill.instructions}
                        </p>
                        {skill.triggerKeywords.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {skill.triggerKeywords.map((keyword) => (
                              <span
                                key={`${skill.id}-${keyword}`}
                                className="px-2 py-1 rounded-full text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-200"
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setConfig((current) => ({
                              ...current,
                              skills: current.skills.map((item) =>
                                item.id === skill.id
                                  ? { ...item, enabled: !item.enabled }
                                  : item,
                              ),
                            }))
                          }
                          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                            skill.enabled
                              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                              : "bg-slate-800 border border-slate-700 text-slate-300"
                          }`}
                        >
                          {skill.enabled ? "Desativar" : "Ativar"}
                        </button>
                        <button
                          onClick={() => removeSkill(skill.id)}
                          className="p-2 rounded-lg border border-red-500/20 text-red-300 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                  <h5 className="text-white font-medium">
                    Adicionar nova skill
                  </h5>
                  <Field label="Nome">
                    <input
                      value={newSkill.name}
                      onChange={(e) =>
                        setNewSkill((current) => ({
                          ...current,
                          name: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </Field>
                  <Field label="Descrição">
                    <input
                      value={newSkill.description}
                      onChange={(e) =>
                        setNewSkill((current) => ({
                          ...current,
                          description: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </Field>
                  <Field label="Instruções">
                    <textarea
                      value={newSkill.instructions}
                      onChange={(e) =>
                        setNewSkill((current) => ({
                          ...current,
                          instructions: e.target.value,
                        }))
                      }
                      className="w-full min-h-[100px] px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </Field>
                  <Field label="Palavras-chave">
                    <input
                      value={newSkill.triggerKeywords}
                      onChange={(e) =>
                        setNewSkill((current) => ({
                          ...current,
                          triggerKeywords: e.target.value,
                        }))
                      }
                      placeholder="financeiro, cobrança, vencimento"
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </Field>
                  <button
                    onClick={addSkill}
                    className="w-full px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    Incluir skill
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <h5 className="text-white font-medium">Pacotes rápidos</h5>
                  {QUICK_SKILLS.map((skill) => (
                    <button
                      key={skill.name}
                      onClick={() => addQuickSkill(skill)}
                      className="w-full text-left p-3 rounded-xl border border-slate-800 hover:border-indigo-500/30 hover:bg-slate-900 transition-colors"
                    >
                      <div className="text-sm text-white font-medium">
                        {skill.name}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {skill.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div
            className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 ${
              activeSubTab === "playground" ? "" : "hidden"
            }`}
          >
            <div className="flex items-center gap-3 mb-5">
              <PlayCircle className="text-amber-300" size={20} />
              <h4 className="text-lg font-semibold text-white">
                Playground do Admin
              </h4>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2">
                {PLAYGROUND_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setPlaygroundScenario(preset.scenario);
                      setPlaygroundPrompt(preset.prompt);
                    }}
                    className="text-left p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/30 hover:bg-slate-900 transition-colors"
                  >
                    <div className="text-sm text-white font-medium">
                      {preset.label}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {preset.prompt}
                    </div>
                  </button>
                ))}
              </div>

              <Field label="Cenário de teste">
                <input
                  value={playgroundScenario}
                  onChange={(e) => setPlaygroundScenario(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </Field>

              <Field label="Prompt do playground">
                <textarea
                  value={playgroundPrompt}
                  onChange={(e) => setPlaygroundPrompt(e.target.value)}
                  className="w-full min-h-[180px] px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Temperatura">
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step="0.1"
                    value={config.playground.temperature}
                    onChange={(e) =>
                      updateConfig({
                        playground: {
                          ...config.playground,
                          temperature: Number(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </Field>
                <Field label="Max tokens">
                  <input
                    type="number"
                    min={64}
                    step={64}
                    value={config.playground.maxTokens}
                    onChange={(e) =>
                      updateConfig({
                        playground: {
                          ...config.playground,
                          maxTokens: Number(e.target.value) || 256,
                        },
                      })
                    }
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </Field>
              </div>

              <button
                onClick={runPlayground}
                disabled={testing}
                className="w-full px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <PlayCircle size={18} />
                {testing ? "Executando teste..." : "Executar playground"}
              </button>
            </div>
          </div>

          <div
            className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 ${
              activeSubTab === "operacao" || activeSubTab === "modelos"
                ? ""
                : "hidden"
            }`}
          >
            <div className="flex items-center gap-3">
              <ClipboardList className="text-sky-300" size={20} />
              <h4 className="text-lg font-semibold text-white">
                Diagnóstico rápido
              </h4>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <ShieldCheck size={16} className="text-emerald-300" />
                  Segurança operacional
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {config.telegramWhitelist.length > 0
                    ? "Whitelist preenchida. O admin já consegue limitar quem testa via Telegram."
                    : "Defina a whitelist antes dos testes externos para evitar acesso indevido."}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <CheckCircle2 size={16} className="text-indigo-300" />
                  Skills disponíveis
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {enabledSkills.length > 0
                    ? `${enabledSkills.length} skill(s) ativas prontas para roteamento automático.`
                    : "Ative pelo menos uma skill para testar um fluxo mais realista."}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <MessageSquareText size={16} className="text-amber-300" />
                  Último teste
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {config.playground.lastRunAt
                    ? `Executado em ${new Date(config.playground.lastRunAt).toLocaleString("pt-BR")}.`
                    : "Nenhum teste registrado ainda."}
                </p>
              </div>
            </div>
          </div>

          {playgroundResponse && activeSubTab === "playground" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-white">
                    Resposta do playground
                  </h4>
                  <p className="text-sm text-slate-400">
                    {playgroundResponse.provider}
                    {playgroundResponse.model
                      ? ` / ${playgroundResponse.model}`
                      : ""}
                    {playgroundResponse.mode
                      ? ` • modo ${playgroundResponse.mode}`
                      : ""}
                  </p>
                </div>
              </div>

              {playgroundResponse.matchedSkills?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {playgroundResponse.matchedSkills.map((skill) => (
                    <span
                      key={skill.id}
                      className="px-2 py-1 rounded-full text-[11px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-200"
                    >
                      {skill.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">
                  Resposta
                </p>
                <pre className="whitespace-pre-wrap text-sm text-slate-200 font-sans">
                  {playgroundResponse.answer}
                </pre>
              </div>

              <details className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <summary className="cursor-pointer text-sm text-slate-300 flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-300" />
                  Ver contexto efetivo do teste
                </summary>
                <pre className="whitespace-pre-wrap text-xs text-slate-400 font-sans mt-3">
                  {playgroundResponse.systemPrompt}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
