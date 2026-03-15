import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../services/api";

type DrxSkillScope = "SYSTEM" | "CUSTOM";

type DrxSkill = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  triggerKeywords: string[];
  enabled: boolean;
  scope?: DrxSkillScope;
  usageContexts?: string[];
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

const SYSTEM_SKILL_PRESETS: DrxSkill[] = [
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
    scope: "SYSTEM",
    usageContexts: ["ATENDIMENTO", "PLAYGROUND"],
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
    scope: "SYSTEM",
    usageContexts: ["FINANCEIRO", "PLAYGROUND"],
  },
  {
    id: "agenda-followup",
    name: "Agenda e Follow-up",
    description: "Propoe retornos, follow-ups e organizacao de compromissos.",
    instructions:
      "Sugira agenda, retorno, prazo e resumo executivo do atendimento.",
    triggerKeywords: ["agenda", "retorno", "follow-up", "lembrete", "prazo"],
    enabled: true,
    scope: "SYSTEM",
    usageContexts: ["AGENDA", "PLAYGROUND"],
  },
  {
    id: "processo-eletronico-pje-eproc",
    name: "Leitor Juridico de Processos Eletronicos",
    description:
      "Analisa PDF de autos do PJe ou eproc, identifica partes, procuradores, pecas, fase, prazos e pendencias.",
    instructions:
      "Ao receber texto ou PDF de processo eletronico, primeiro detecte o sistema e extraia os fatos. Depois organize processo, polos, clientes, contrarios, procuradores, pecas, eventos e prazos. Separe claramente o que veio do documento do que e inferencia. Nunca trate peticao como decisao judicial, nao invente dados ausentes e destaque pendencias, riscos e proximos passos com alerta de validacao humana.",
    triggerKeywords: [
      "pdf do processo",
      "autos",
      "pje",
      "eproc",
      "andamentos",
      "partes",
      "procuradores",
      "prazo processual",
      "resumo do processo",
    ],
    enabled: true,
    scope: "SYSTEM",
    usageContexts: ["PROCESSO_PDF", "PLAYGROUND", "ANALISE_PROCESSUAL"],
  },
];

const QUICK_SKILLS: Array<Omit<DrxSkill, "id">> = [
  {
    name: "Atendimento Inicial",
    description: "Recebe a demanda, qualifica urgencia e define proximo passo.",
    instructions:
      "Faca triagem objetiva, identifique urgencia, documentos faltantes e a acao recomendada.",
    triggerKeywords: [
      "triagem",
      "atendimento",
      "novo cliente",
      "qualificacao",
    ],
    enabled: true,
    scope: "CUSTOM",
    usageContexts: ["ATENDIMENTO"],
  },
  {
    name: "Cobranca Inteligente",
    description: "Organiza cobranca com tom profissional e amigavel.",
    instructions:
      "Considere vencimento, valor, proposta de negociacao e encaminhe uma mensagem clara.",
    triggerKeywords: ["cobranca", "boleto", "financeiro", "pagamento"],
    enabled: true,
    scope: "CUSTOM",
    usageContexts: ["FINANCEIRO"],
  },
  {
    name: "Agenda e Retorno",
    description: "Transforma mensagens em lembretes, agenda e follow-ups.",
    instructions:
      "Resuma o caso, proponha data de retorno, horario e responsavel sugerido.",
    triggerKeywords: ["agenda", "retorno", "follow-up", "prazo"],
    enabled: true,
    scope: "CUSTOM",
    usageContexts: ["AGENDA"],
  },
];

const USAGE_CONTEXT_LABELS: Record<string, string> = {
  ATENDIMENTO: "Atendimento",
  FINANCEIRO: "Financeiro",
  AGENDA: "Agenda",
  PLAYGROUND: "Playground",
  PROCESSO_PDF: "Importacao PDF do processo",
  ANALISE_PROCESSUAL: "Analise processual",
};

const SYSTEM_SKILL_MAP = new Map(
  SYSTEM_SKILL_PRESETS.map((skill) => [skill.id, skill]),
);

const buildSkillId = (name: string) =>
  `${name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "skill"}-${Date.now()}`;

const EMPTY_EDITOR: DrxSkill = {
  id: "",
  name: "",
  description: "",
  instructions: "",
  triggerKeywords: [],
  enabled: true,
  scope: "CUSTOM",
  usageContexts: [],
};

const formatUsageContexts = (skill: DrxSkill) =>
  (skill.usageContexts || []).map(
    (item) => USAGE_CONTEXT_LABELS[item] || item,
  );

export function SkillsTab() {
  const [config, setConfig] = useState<DrxClawConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string>("new");
  const [editor, setEditor] = useState<DrxSkill>(EMPTY_EDITOR);
  const [keywordInput, setKeywordInput] = useState("");

  const systemSkillCount = useMemo(
    () =>
      config.skills.filter(
        (skill) => (skill.scope || "CUSTOM") === "SYSTEM",
      ).length,
    [config.skills],
  );

  const customSkillCount = useMemo(
    () =>
      config.skills.filter(
        (skill) => (skill.scope || "CUSTOM") !== "SYSTEM",
      ).length,
    [config.skills],
  );

  const activeSkillCount = useMemo(
    () => config.skills.filter((skill) => skill.enabled).length,
    [config.skills],
  );

  const selectedSkill = useMemo(
    () => config.skills.find((skill) => skill.id === selectedSkillId) || null,
    [config.skills, selectedSkillId],
  );

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get("/drx-claw/config");
      const loadedConfig = response.data?.config || EMPTY_CONFIG;
      setConfig(loadedConfig);
    } catch (error) {
      console.error("Erro ao carregar skills do DrX:", error);
      toast.error("Nao foi possivel carregar as skills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig();
  }, []);

  useEffect(() => {
    if (selectedSkillId === "new") {
      setEditor(EMPTY_EDITOR);
      setKeywordInput("");
      return;
    }

    if (!selectedSkill) {
      setSelectedSkillId(config.skills[0]?.id || "new");
      return;
    }

    setEditor({
      ...selectedSkill,
      scope: selectedSkill.scope || "CUSTOM",
      usageContexts: selectedSkill.usageContexts || [],
      triggerKeywords: selectedSkill.triggerKeywords || [],
    });
    setKeywordInput((selectedSkill.triggerKeywords || []).join(", "));
  }, [config.skills, selectedSkill, selectedSkillId]);

  const saveConfig = async () => {
    try {
      setSaving(true);
      await api.post("/drx-claw/config", config);
      toast.success("Skills salvas com sucesso");
      await loadConfig();
    } catch (error) {
      console.error("Erro ao salvar skills:", error);
      toast.error("Nao foi possivel salvar as skills");
    } finally {
      setSaving(false);
    }
  };

  const upsertEditorSkill = () => {
    if (!editor.name.trim() || !editor.description.trim()) {
      toast.error("Informe pelo menos nome e descricao da skill");
      return;
    }

    const normalizedSkill: DrxSkill = {
      ...editor,
      id: editor.id || buildSkillId(editor.name),
      name: editor.name.trim(),
      description: editor.description.trim(),
      instructions: editor.instructions.trim(),
      triggerKeywords: keywordInput
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      scope: editor.scope || "CUSTOM",
      usageContexts: editor.usageContexts || [],
    };

    setConfig((current) => {
      const exists = current.skills.some((skill) => skill.id === normalizedSkill.id);
      return {
        ...current,
        skills: exists
          ? current.skills.map((skill) =>
              skill.id === normalizedSkill.id ? normalizedSkill : skill,
            )
          : [...current.skills, normalizedSkill],
      };
    });
    setSelectedSkillId(normalizedSkill.id);
    toast.success(
      selectedSkillId === "new"
        ? "Skill adicionada ao rascunho"
        : "Skill atualizada no rascunho",
    );
  };

  const toggleSkill = (skillId: string) => {
    setConfig((current) => ({
      ...current,
      skills: current.skills.map((skill) =>
        skill.id === skillId ? { ...skill, enabled: !skill.enabled } : skill,
      ),
    }));
  };

  const removeSkill = (skill: DrxSkill) => {
    if ((skill.scope || "CUSTOM") === "SYSTEM") {
      toast.error(
        "Skills do sistema nao devem ser excluidas. Use pausar ou restaurar o padrao.",
      );
      return;
    }

    setConfig((current) => ({
      ...current,
      skills: current.skills.filter((item) => item.id !== skill.id),
    }));
    setSelectedSkillId("new");
    toast.success("Skill removida do rascunho");
  };

  const restoreSkill = (skillId: string) => {
    const preset = SYSTEM_SKILL_MAP.get(skillId);
    if (!preset) {
      toast.error("Nao ha padrao de sistema para esta skill");
      return;
    }

    setConfig((current) => ({
      ...current,
      skills: current.skills.map((skill) =>
        skill.id === skillId ? { ...preset } : skill,
      ),
    }));
    setSelectedSkillId(skillId);
    toast.success("Skill restaurada para o padrao do sistema");
  };

  const addQuickSkill = (skill: Omit<DrxSkill, "id">) => {
    const existing = config.skills.find((item) => item.name === skill.name);
    if (existing) {
      setSelectedSkillId(existing.id);
      toast.message("Essa skill ja existe. Abri a configuracao dela.");
      return;
    }

    const newSkill: DrxSkill = {
      ...skill,
      id: buildSkillId(skill.name),
      scope: "CUSTOM",
    };

    setConfig((current) => ({
      ...current,
      skills: [...current.skills, newSkill],
    }));
    setSelectedSkillId(newSkill.id);
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-slate-400">
        Carregando painel de skills...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-3 duration-500">
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 rounded-2xl p-4 md:p-6">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-200 text-xs font-medium mb-4">
              <Wand2 size={14} />
              Skills do DrX
            </div>
            <h3 className="text-xl md:text-2xl font-semibold text-white">
              Documento vivo e manutencao das skills por empresa
            </h3>
            <p className="text-sm md:text-base text-slate-400 mt-2 max-w-3xl">
              Use esta aba para identificar skills do sistema, ajustar
              instrucoes, corrigir gatilhos e manter as skills customizadas da
              empresa sem mexer no restante da configuracao do DrX-Claw.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 md:gap-3 w-full xl:w-auto">
            <button
              onClick={() => void loadConfig()}
              disabled={loading}
              className="w-full sm:w-auto justify-center px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={16} />
              Recarregar
            </button>
            <button
              onClick={() => setSelectedSkillId("new")}
              className="w-full sm:w-auto justify-center px-4 py-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20 transition-colors flex items-center gap-2"
            >
              <Plus size={16} />
              Nova skill
            </button>
            <button
              onClick={() => void saveConfig()}
              disabled={saving}
              className="w-full sm:w-auto justify-center px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors flex items-center gap-2 disabled:opacity-50 font-medium"
            >
              <Save size={16} />
              {saving ? "Salvando..." : "Salvar skills"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mt-5 md:mt-6">
          <div className="p-3 md:p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">
              Skills ativas
            </p>
            <span className="text-2xl md:text-3xl font-semibold text-white">
              {activeSkillCount}
            </span>
          </div>
          <div className="p-3 md:p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">
              Skills do sistema
            </p>
            <span className="text-2xl md:text-3xl font-semibold text-white">
              {systemSkillCount}
            </span>
          </div>
          <div className="p-3 md:p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">
              Skills customizadas
            </p>
            <span className="text-2xl md:text-3xl font-semibold text-white">
              {customSkillCount}
            </span>
          </div>
          <div className="p-3 md:p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">
              Documento base
            </p>
            <div className="text-sm md:text-base font-medium text-white">
              DRX_SKILLS.md
            </div>
            <div className="text-xs md:text-sm text-slate-400 mt-1">
              Catalogo funcional das skills do produto
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_0.9fr] gap-6">
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6">
            <div className="flex items-center gap-3 mb-5">
              <FileText className="text-cyan-300" size={20} />
              <h4 className="text-lg font-semibold text-white">
                Mapa de uso das skills
              </h4>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  1. Documento
                </p>
                <p className="mt-2 text-sm text-slate-200">
                  O arquivo <span className="font-mono">DRX_SKILLS.md</span>{" "}
                  identifica as skills do produto e seus pontos de uso.
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  2. Skills do sistema
                </p>
                <p className="mt-2 text-sm text-slate-200">
                  Podem ser corrigidas por empresa nesta tela sem perder a
                  identificacao de origem.
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  3. Fluxos integrados
                </p>
                <p className="mt-2 text-sm text-slate-200">
                  A skill de leitura processual e usada no PDF integral do
                  processo e tambem pode ser acionada no playground do DrX.
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  4. Governanca
                </p>
                <p className="mt-2 text-sm text-slate-200">
                  Para remover o efeito de uma skill do sistema, prefira pausar.
                  Excluir fica reservado para skills customizadas.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6">
            <div className="flex items-center gap-3 mb-5">
              <ShieldCheck className="text-emerald-300" size={20} />
              <h4 className="text-lg font-semibold text-white">
                Skills cadastradas
              </h4>
            </div>

            <div className="space-y-3">
              {config.skills.map((skill) => {
                const usageLabels = formatUsageContexts(skill);
                const isSelected = selectedSkillId === skill.id;
                const isSystem = (skill.scope || "CUSTOM") === "SYSTEM";

                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => setSelectedSkillId(skill.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-colors ${
                      isSelected
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "border-slate-800 bg-slate-950 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h5 className="text-white font-medium">
                            {skill.name}
                          </h5>
                          <span
                            className={`px-2 py-0.5 text-[10px] rounded-full border ${
                              isSystem
                                ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-200"
                                : "border-slate-700 bg-slate-800 text-slate-300"
                            }`}
                          >
                            {isSystem ? "sistema" : "custom"}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[10px] rounded-full border ${
                              skill.enabled
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                                : "border-slate-700 bg-slate-800 text-slate-400"
                            }`}
                          >
                            {skill.enabled ? "ativa" : "pausada"}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400">
                          {skill.description}
                        </p>
                        {usageLabels.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {usageLabels.map((label) => (
                              <span
                                key={`${skill.id}-${label}`}
                                className="px-2 py-1 rounded-full text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-200"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleSkill(skill.id);
                          }}
                          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                            skill.enabled
                              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                              : "bg-slate-800 border border-slate-700 text-slate-300"
                          }`}
                        >
                          {skill.enabled ? "Pausar" : "Ativar"}
                        </button>
                        {isSystem ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              restoreSkill(skill.id);
                            }}
                            className="p-2 rounded-lg border border-amber-500/20 text-amber-300 hover:bg-amber-500/10 transition-colors"
                            title="Restaurar padrao"
                          >
                            <RotateCcw size={16} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeSkill(skill);
                            }}
                            className="p-2 rounded-lg border border-red-500/20 text-red-300 hover:bg-red-500/10 transition-colors"
                            title="Excluir skill customizada"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6">
            <div className="flex items-center gap-3 mb-5">
              <Sparkles className="text-purple-300" size={20} />
              <h4 className="text-lg font-semibold text-white">
                Editor de skill
              </h4>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">
                  Modo atual
                </p>
                <p className="text-sm text-slate-200">
                  {selectedSkillId === "new"
                    ? "Criando uma nova skill customizada."
                    : (editor.scope || "CUSTOM") === "SYSTEM"
                      ? "Editando uma skill do sistema. As alteracoes ficam salvas para esta empresa."
                      : "Editando uma skill customizada desta empresa."}
                </p>
              </div>

              <label className="space-y-2 block">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Nome
                </span>
                <input
                  value={editor.name}
                  onChange={(event) =>
                    setEditor((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </label>

              <label className="space-y-2 block">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Descricao
                </span>
                <input
                  value={editor.description}
                  onChange={(event) =>
                    setEditor((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </label>

              <label className="space-y-2 block">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Instrucoes
                </span>
                <textarea
                  value={editor.instructions}
                  onChange={(event) =>
                    setEditor((current) => ({
                      ...current,
                      instructions: event.target.value,
                    }))
                  }
                  className="w-full min-h-[180px] px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </label>

              <label className="space-y-2 block">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Palavras-chave
                </span>
                <input
                  value={keywordInput}
                  onChange={(event) => setKeywordInput(event.target.value)}
                  placeholder="pdf do processo, pje, eproc, prazo"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </label>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={upsertEditorSkill}
                  className="flex-1 px-4 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <Save size={16} />
                  {selectedSkillId === "new"
                    ? "Adicionar ao rascunho"
                    : "Atualizar rascunho"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSkillId("new")}
                  className="px-4 py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Limpar editor
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6">
            <div className="flex items-center gap-3 mb-5">
              <Plus className="text-emerald-300" size={20} />
              <h4 className="text-lg font-semibold text-white">
                Pacotes rapidos
              </h4>
            </div>

            <div className="space-y-3">
              {QUICK_SKILLS.map((skill) => (
                <button
                  key={skill.name}
                  type="button"
                  onClick={() => addQuickSkill(skill)}
                  className="w-full text-left p-4 rounded-xl border border-slate-800 bg-slate-950 hover:border-emerald-500/30 hover:bg-slate-900 transition-colors"
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
  );
}
