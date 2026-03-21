import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  FilePlus2,
  FileSearch,
  HelpCircle,
  Landmark,
  Layout,
  Loader2,
  RefreshCcw,
  Save,
  Settings,
  ShieldCheck,
  Tags,
  Users,
  Workflow,
  Zap,
  Database,
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";
import { api } from "../../services/api";
import { HelpModal, useHelpModal } from "../../components/HelpModal";
import {
  applyImportedPartyClassification,
  buildImportedPartyReview,
  ProcessImportPartyReview,
  type ImportedPartyClassification,
} from "../../components/processos/ProcessImportPartyReview";
import { helpProcesses } from "../../data/helpManuals";
import { masks } from "../../utils/masks";

type ViewMode = "cards" | "bulk" | "integrations";

interface ConfigCard {
  id: string;
  title: string;
  description: string;
  gradient: string;
  icon: ReactNode;
  badge?: string;
  action: () => void;
}

interface TribunalOption {
  code: string;
  label: string;
  alias: string;
  system: string;
  recommended?: boolean;
}

interface IntegrationConfig {
  enabled: boolean;
  provider: "DATAJUD" | "MANUAL";
  autoImportStrategy: "REVIEW_BEFORE_SAVE" | "AUTO_SAVE";
  syncMode: "MANUAL" | "ON_DEMAND";
  notes: string;
  datajud: {
    enabled: boolean;
    apiKey: string;
    tribunalCode: string;
    tribunalAlias: string;
    tribunalLabel: string;
    baseUrl: string;
    timeoutMs: number;
    maxMovements: number;
  };
  eprocMg: {
    requestStatus:
      | "NAO_SOLICITADO"
      | "EM_ANALISE"
      | "HOMOLOGACAO"
      | "LIBERADO";
    institutionName: string;
    accessLogin: string;
    accessPassword: string;
    endpointUrl: string;
    notes: string;
  };
}

const emptyConfig: IntegrationConfig = {
  enabled: false,
  provider: "DATAJUD",
  autoImportStrategy: "REVIEW_BEFORE_SAVE",
  syncMode: "ON_DEMAND",
  notes: "",
  datajud: {
    enabled: true,
    apiKey: "",
    tribunalCode: "TJMG",
    tribunalAlias: "api_publica_tjmg",
    tribunalLabel: "Tribunal de Justica de Minas Gerais",
    baseUrl: "https://api-publica.datajud.cnj.jus.br",
    timeoutMs: 15000,
    maxMovements: 12,
  },
  eprocMg: {
    requestStatus: "NAO_SOLICITADO",
    institutionName: "",
    accessLogin: "",
    accessPassword: "",
    endpointUrl: "",
    notes: "",
  },
};

export function ProcessConfig() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isHelpOpen, setIsHelpOpen } = useHelpModal();
  const incomingFilters = location.state?.filters;

  const [view, setView] = useState<ViewMode>("cards");
  const [loadingAction, setLoadingAction] = useState(false);
  const [tags, setTags] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedLawyer, setSelectedLawyer] = useState("");
  const [targetStatus, setTargetStatus] = useState("");

  const [config, setConfig] = useState<IntegrationConfig>(emptyConfig);
  const [tribunals, setTribunals] = useState<TribunalOption[]>([]);
  const [docs, setDocs] = useState<Array<{ label: string; url: string }>>([]);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingConfig, setTestingConfig] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewCnj, setPreviewCnj] = useState("");
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [partyClassification, setPartyClassification] = useState<Record<string, ImportedPartyClassification>>({});
  const [testResult, setTestResult] = useState<any | null>(null);
  const partyReview = useMemo(
    () => buildImportedPartyReview(Array.isArray(previewData?.parties) ? previewData.parties : []),
    [previewData?.parties],
  );

  useEffect(() => {
    if (view === "bulk") {
      void fetchTags();
      void fetchUsers();
    }
    if (view === "integrations" && tribunals.length === 0) {
      void fetchIntegration();
    }
  }, [view]);

  useEffect(() => {
    setPartyClassification((current) => {
      const next: Record<string, ImportedPartyClassification> = {};
      partyReview.principalParties.forEach((party) => {
        if (current[party.reviewKey]) {
          next[party.reviewKey] = current[party.reviewKey];
          return;
        }
        if (party.isClient) {
          next[party.reviewKey] = "CLIENT";
          return;
        }
        if (party.isOpposing) {
          next[party.reviewKey] = "OPPOSING";
          return;
        }
        next[party.reviewKey] = "";
      });
      return next;
    });
  }, [partyReview]);

  const ready = useMemo(
    () => config.enabled && config.provider === "DATAJUD" && !!config.datajud.apiKey,
    [config],
  );

  const updateConfig = (next: Partial<IntegrationConfig>) =>
    setConfig((current) => ({ ...current, ...next }));

  const updateTribunal = (tribunalCode: string) => {
    const tribunal = tribunals.find((item) => item.code === tribunalCode);
    if (!tribunal) return;
    setConfig((current) => ({
      ...current,
      datajud: {
        ...current.datajud,
        tribunalCode: tribunal.code,
        tribunalAlias: tribunal.alias,
        tribunalLabel: tribunal.label,
      },
    }));
  };

  const fetchTags = async () => {
    try {
      const { data } = await api.get("/tags?scope=PROCESS");
      setTags(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data } = await api.get("/users");
      setUsers(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchIntegration = async () => {
    try {
      setLoadingConfig(true);
      const { data } = await api.get("/processes/config/integrations");
      setConfig(data.config || emptyConfig);
      setTribunals(data.supportedTribunals || []);
      setDocs(data.officialDocs || []);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar a configuracao geral de processos");
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleBatchAction = async (action: string) => {
    const filterDesc = incomingFilters
      ? "os processos filtrados na tela anterior"
      : "TODOS os processos da base";
    if (!window.confirm(`Deseja aplicar esta acao a ${filterDesc}?`)) return;

    try {
      setLoadingAction(true);
      const payload: any = { action, ...incomingFilters };
      if (action.includes("TAG")) payload.tagId = selectedTag;
      if (action === "UPDATE_STATUS") payload.status = targetStatus;
      if (action === "UPDATE_LAWYER") payload.lawyerName = selectedLawyer;
      const { data } = await api.post("/processes/bulk-action", payload);
      toast.success(`Acao concluida. Itens afetados: ${data.updatedCount}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const saveIntegration = async () => {
    try {
      setSavingConfig(true);
      const { data } = await api.post("/processes/config/integrations", config);
      setConfig(data.config || config);
      setTribunals(data.supportedTribunals || tribunals);
      setDocs(data.officialDocs || docs);
      toast.success("Configuracao geral de processos salva");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao salvar configuracao");
    } finally {
      setSavingConfig(false);
    }
  };

  const testIntegration = async () => {
    try {
      setTestingConfig(true);
      const { data } = await api.post("/processes/config/integrations/test", {
        config,
        cnj: previewCnj || undefined,
      });
      setTestResult(data);
      if (data.success) toast.success(data.message || "Teste concluido");
      else toast.error(data.message || "Falha na integracao");
    } catch (error: any) {
      const message = error.response?.data?.message || "Erro ao testar integracao";
      setTestResult({ success: false, message });
      toast.error(message);
    } finally {
      setTestingConfig(false);
    }
  };

  const consultByCnj = async () => {
    if (!previewCnj.trim()) {
      toast.warning("Informe o CNJ para consultar");
      return;
    }
    try {
      setPreviewLoading(true);
      const { data } = await api.post("/processes/config/integrations/import-cnj", {
        cnj: previewCnj,
      });
      setPreviewData(data);
      toast.success("Consulta por CNJ executada");
    } catch (error: any) {
      setPreviewData(null);
      toast.error(error.response?.data?.message || "Erro ao consultar CNJ");
    } finally {
      setPreviewLoading(false);
    }
  };

  const importPreview = async () => {
    if (!previewData) return;

    const unresolvedParties = partyReview.principalParties.filter((party) => !partyClassification[party.reviewKey]);
    if (unresolvedParties.length > 0) {
      toast.warning("Classifique todas as partes principais como cliente ou contrário antes de cadastrar.");
      return;
    }

    const clientCount = partyReview.principalParties.filter((party) => partyClassification[party.reviewKey] === "CLIENT").length;
    if (clientCount === 0) {
      toast.warning("Marque ao menos uma parte principal como cliente antes de cadastrar.");
      return;
    }

    try {
      setPreviewLoading(true);
      const { data } = await api.post("/processes", {
        ...previewData,
        category: "JUDICIAL",
        parties: applyImportedPartyClassification(partyReview, partyClassification),
      });
      toast.success("Processo cadastrado com sucesso com capa e partes sincronizadas");
      navigate(`/processes/${data.id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao cadastrar processo");
    } finally {
      setPreviewLoading(false);
    }
  };

  const applyDefaultClassification = () => {
    const next: Record<string, ImportedPartyClassification> = {};
    partyReview.activeParties.forEach((party) => {
      next[party.reviewKey] = "CLIENT";
    });
    partyReview.passiveParties.forEach((party) => {
      next[party.reviewKey] = "OPPOSING";
    });
    setPartyClassification(next);
  };

  const clearClassification = () => {
    const next: Record<string, ImportedPartyClassification> = {};
    partyReview.principalParties.forEach((party) => {
      next[party.reviewKey] = "";
    });
    setPartyClassification(next);
  };

  const cards: ConfigCard[] = [
    {
      id: "integrations",
      title: "Consulta Processual Oficial",
      description:
        "Credenciais, teste DataJud, preparo do Eproc MG e importacao por CNJ.",
      gradient: "from-cyan-500 to-blue-600",
      icon: <Landmark className="w-6 h-6" />,
      action: () => setView("integrations"),
    },
    {
      id: "bulk",
      title: "Acoes em Massa",
      description: "Status, etiquetas e responsavel em lote.",
      gradient: "from-indigo-500 to-blue-600",
      icon: <Zap className="w-6 h-6" />,
      action: () => setView("bulk"),
    },
    {
      id: "workflows",
      title: "Esteiras de Trabalho",
      description: "Gerencie fluxos, andamentos automáticos e SLAs.",
      gradient: "from-emerald-500 to-teal-600",
      icon: <Workflow className="w-6 h-6" />,
      action: () => navigate("/settings", { state: { tab: "workflows" } }),
    },
    {
      id: "fields",
      title: "Campos do Processo",
      description: "Customizacao dos metadados do modulo.",
      gradient: "from-amber-500 to-orange-600",
      icon: <Database className="w-6 h-6" />,
      action: () => undefined,
      badge: "Em breve",
    },
  ];

  return (
    <div className="min-h-screen p-6 md:p-8 animate-in fade-in duration-500 text-slate-200">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => (view === "cards" ? navigate("/processes") : setView("cards"))}
            className="p-2.5 hover:bg-slate-800 rounded-xl transition-all border border-slate-800 group"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-blue-500/20 rounded-xl border border-indigo-500/20">
                <Settings className="text-indigo-400 w-6 h-6" />
              </div>
              {view === "bulk"
                ? "Acoes em Massa (Processos)"
                : view === "integrations"
                  ? "Configuracao Geral de Processos"
                  : "Configuracoes de Processos"}
            </h1>
            <p className="text-slate-400 mt-1 ml-14">
              {view === "integrations"
                ? "Painel central da consulta processual oficial e do preparo do Eproc MG."
                : "Gerencie organizacao, integracoes e operacao do modulo."}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsHelpOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800 transition"
        >
          <HelpCircle className="h-4 w-4" />
          Ajuda
        </button>
      </div>

      {view === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {cards.map((card) => {
            const disabled = !!card.badge;
            return (
              <button
                key={card.id}
                onClick={card.action}
                disabled={disabled}
                className={clsx(
                  "group relative text-left rounded-xl border transition-all duration-300 overflow-hidden",
                  disabled
                    ? "bg-slate-900/50 border-slate-800/50 cursor-not-allowed opacity-60"
                    : "bg-slate-900 border-slate-800 hover:border-slate-600 hover:shadow-xl hover:-translate-y-0.5",
                )}
              >
                <div className={`h-1 w-full bg-gradient-to-r ${card.gradient}`} />
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${card.gradient}`}>
                      <span className="text-white">{card.icon}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {card.badge && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full border border-slate-700">
                          {card.badge}
                        </span>
                      )}
                      {!disabled && <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all duration-300" />}
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-white">{card.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{card.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {view === "bulk" && (
        <div className="space-y-6 max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-3"><Tags className="text-indigo-400" size={20} /><h3 className="text-lg font-semibold text-white">Etiquetas</h3></div>
              <select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white">
                <option value="">Selecione etiqueta...</option>
                {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleBatchAction("ADD_TAG")} disabled={loadingAction || !selectedTag} className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm disabled:opacity-30">Atribuir</button>
                <button onClick={() => handleBatchAction("REMOVE_TAG")} disabled={loadingAction || !selectedTag} className="bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white py-2 rounded-lg text-sm disabled:opacity-30">Remover</button>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-3"><Users className="text-blue-400" size={20} /><h3 className="text-lg font-semibold text-white">Responsavel</h3></div>
              <select value={selectedLawyer} onChange={(e) => setSelectedLawyer(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white">
                <option value="">Selecione o advogado...</option>
                {users.map((user) => <option key={user.id} value={user.name}>{user.name}</option>)}
              </select>
              <button onClick={() => handleBatchAction("UPDATE_LAWYER")} disabled={loadingAction || !selectedLawyer} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm disabled:opacity-30">Atribuir em massa</button>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-3"><Zap className="text-amber-400" size={20} /><h3 className="text-lg font-semibold text-white">Status</h3></div>
              <select value={targetStatus} onChange={(e) => setTargetStatus(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white">
                <option value="">Selecione status...</option>
                <option value="ATIVO">Ativo</option>
                <option value="SUSPENSO">Suspenso</option>
                <option value="ARQUIVADO">Arquivado</option>
                <option value="OPORTUNIDADE">Oportunidade</option>
              </select>
              <button onClick={() => handleBatchAction("UPDATE_STATUS")} disabled={loadingAction || !targetStatus} className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg text-sm disabled:opacity-30">Confirmar mudanca</button>
            </div>
          </div>
          {incomingFilters && <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-sm text-slate-300">A acao sera aplicada apenas aos processos filtrados na grade anterior.</div>}
        </div>
      )}

      {view === "integrations" && (
        <div className="space-y-6">
          {loadingConfig ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 flex items-center justify-center gap-3 text-slate-300">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
              Carregando configuracao...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-cyan-300" /><div><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Provider</p><p className="text-white font-semibold">{config.provider === "DATAJUD" ? "DataJud / CNJ" : "Manual"}</p></div></div></div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-center gap-3"><Workflow className="h-5 w-5 text-indigo-300" /><div><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Tribunal inicial</p><p className="text-white font-semibold">{config.datajud.tribunalLabel}</p></div></div></div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-center gap-3">{ready ? <ShieldCheck className="h-5 w-5 text-emerald-300" /> : <AlertTriangle className="h-5 w-5 text-amber-300" />}<div><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Prontidao</p><p className="text-white font-semibold">{ready ? "DataJud pronto para consulta" : "Falta completar credenciais"}</p></div></div></div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.9fr] gap-6">
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-white">Estrategia Geral</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4"><input type="checkbox" checked={config.enabled} onChange={(e) => updateConfig({ enabled: e.target.checked })} className="rounded border-slate-700 bg-slate-900 text-cyan-500" /><span className="text-sm text-white">Ativar integracao processual</span></label>
                      <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4"><input type="checkbox" checked={config.datajud.enabled} onChange={(e) => setConfig((current) => ({ ...current, datajud: { ...current.datajud, enabled: e.target.checked } }))} className="rounded border-slate-700 bg-slate-900 text-cyan-500" /><span className="text-sm text-white">Usar DataJud como fonte oficial</span></label>
                      <select value={config.provider} onChange={(e) => updateConfig({ provider: e.target.value as "DATAJUD" | "MANUAL" })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white"><option value="DATAJUD">DataJud / CNJ</option><option value="MANUAL">Manual</option></select>
                      <select value={config.datajud.tribunalCode} onChange={(e) => updateTribunal(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white">{tribunals.map((tribunal) => <option key={tribunal.code} value={tribunal.code}>{tribunal.label}{tribunal.recommended ? " (Recomendado)" : ""}</option>)}</select>
                    </div>
                    <textarea value={config.notes} onChange={(e) => updateConfig({ notes: e.target.value })} rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white resize-y" placeholder="Observacoes operacionais do modulo, regras internas e fluxo recomendado." />
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-white">DataJud / CNJ</h2>
                    <input type="password" value={config.datajud.apiKey} onChange={(e) => setConfig((current) => ({ ...current, datajud: { ...current.datajud, apiKey: e.target.value } }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white" placeholder="API Key publica vigente do CNJ / DataJud" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input value={config.datajud.tribunalAlias} onChange={(e) => setConfig((current) => ({ ...current, datajud: { ...current.datajud, tribunalAlias: e.target.value } }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white" placeholder="Alias oficial" />
                      <input value={config.datajud.baseUrl} onChange={(e) => setConfig((current) => ({ ...current, datajud: { ...current.datajud, baseUrl: e.target.value } }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white" placeholder="Base URL" />
                      <input type="number" min={3000} max={60000} value={config.datajud.timeoutMs} onChange={(e) => setConfig((current) => ({ ...current, datajud: { ...current.datajud, timeoutMs: Number(e.target.value || 15000) } }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white" placeholder="Timeout" />
                      <input type="number" min={3} max={50} value={config.datajud.maxMovements} onChange={(e) => setConfig((current) => ({ ...current, datajud: { ...current.datajud, maxMovements: Number(e.target.value || 12) } }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white" placeholder="Maximo de movimentos" />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-white">Eproc MG / Prontidao</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <select value={config.eprocMg.requestStatus} onChange={(e) => setConfig((current) => ({ ...current, eprocMg: { ...current.eprocMg, requestStatus: e.target.value as IntegrationConfig["eprocMg"]["requestStatus"] } }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white"><option value="NAO_SOLICITADO">Nao solicitado</option><option value="EM_ANALISE">Em analise</option><option value="HOMOLOGACAO">Homologacao</option><option value="LIBERADO">Liberado</option></select>
                      <input value={config.eprocMg.institutionName} onChange={(e) => setConfig((current) => ({ ...current, eprocMg: { ...current.eprocMg, institutionName: e.target.value } }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white" placeholder="Instituicao / responsavel" />
                      <input value={config.eprocMg.accessLogin} onChange={(e) => setConfig((current) => ({ ...current, eprocMg: { ...current.eprocMg, accessLogin: e.target.value } }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white" placeholder="Login institucional (se houver)" />
                      <input type="password" value={config.eprocMg.accessPassword} onChange={(e) => setConfig((current) => ({ ...current, eprocMg: { ...current.eprocMg, accessPassword: e.target.value } }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white" placeholder="Senha / token (preparacao)" />
                    </div>
                    <input value={config.eprocMg.endpointUrl} onChange={(e) => setConfig((current) => ({ ...current, eprocMg: { ...current.eprocMg, endpointUrl: e.target.value } }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white" placeholder="Endpoint ou referencia tecnica formal" />
                    <textarea value={config.eprocMg.notes} onChange={(e) => setConfig((current) => ({ ...current, eprocMg: { ...current.eprocMg, notes: e.target.value } }))} rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white resize-y" placeholder="Documente contato com o tribunal, MNI, exigencias e proximo passo." />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-white">Teste e Importacao por CNJ</h2>
                    <input value={previewCnj} onChange={(e) => setPreviewCnj(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white" placeholder="0000000-00.0000.0.00.0000" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button onClick={testIntegration} disabled={testingConfig} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 font-medium disabled:opacity-50">{testingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}Testar integracao</button>
                      <button onClick={consultByCnj} disabled={previewLoading} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 font-medium disabled:opacity-50">{previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}Consultar CNJ</button>
                    </div>
                    {testResult && <div className={clsx("rounded-xl border p-4 text-sm", testResult.success ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100" : "border-red-500/20 bg-red-500/10 text-red-100")}>{testResult.message}{testResult.endpoint ? <div className="mt-2 text-xs break-all opacity-80">{testResult.endpoint}</div> : null}</div>}
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-white">Preview do Cadastro</h2>
                    {previewData ? (
                      <>
                        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2 text-sm">
                          <div><span className="text-slate-500">CNJ:</span> <span className="text-white">{previewData.cnj ? masks.cnj(previewData.cnj) : "-"}</span></div>
                          <div><span className="text-slate-500">Tribunal:</span> <span className="text-white">{previewData.court || "-"}</span></div>
                          <div><span className="text-slate-500">Sistema:</span> <span className="text-white">{previewData.courtSystem || "-"}</span></div>
                          <div><span className="text-slate-500">Classe:</span> <span className="text-white">{previewData.class || "-"}</span></div>
                          <div><span className="text-slate-500">Assunto:</span> <span className="text-white">{previewData.subject || previewData.area || "-"}</span></div>
                          <div><span className="text-slate-500">Orgao:</span> <span className="text-white">{previewData.vars || "-"}</span></div>
                          <div><span className="text-slate-500">Partes:</span> <span className="text-white">{Array.isArray(previewData.parties) ? previewData.parties.length : 0}</span></div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={applyDefaultClassification}
                            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-300 transition hover:bg-emerald-500/15"
                          >
                            Ativo = Cliente
                          </button>
                          <button
                            type="button"
                            onClick={clearClassification}
                            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-300 transition hover:border-slate-700 hover:bg-slate-900"
                          >
                            Limpar
                          </button>
                        </div>
                        {partyReview.principalParties.length > 0 ? (
                          <ProcessImportPartyReview
                            review={partyReview}
                            classification={partyClassification}
                            onClassificationChange={(reviewKey, value) =>
                              setPartyClassification((current) => ({
                                ...current,
                                [reviewKey]: value,
                              }))
                            }
                          />
                        ) : (
                          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-500">
                            Nenhuma parte principal foi identificada automaticamente na consulta.
                          </div>
                        )}
                        <button onClick={importPreview} disabled={previewLoading} className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-3 font-medium disabled:opacity-50">{previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}Cadastrar processo no sistema</button>
                      </>
                    ) : <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/50 p-6 text-center text-sm text-slate-400">Consulte um CNJ para ver o retorno antes de cadastrar.</div>}
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-3">
                    <h2 className="text-lg font-semibold text-white">Ajuda Operacional</h2>
                    {docs.map((doc) => <a key={doc.url} href={doc.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-200 hover:border-slate-700 hover:bg-slate-900 transition"><span>{doc.label}</span><ExternalLink className="h-4 w-4 text-slate-500" /></a>)}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <button onClick={() => setView("cards")} className="px-5 py-3 rounded-xl border border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800 transition">Voltar</button>
                <button onClick={saveIntegration} disabled={savingConfig} className="px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-medium transition disabled:opacity-50 flex items-center gap-2 justify-center">{savingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar configuracao geral</button>
              </div>
            </>
          )}
        </div>
      )}

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Processos" sections={helpProcesses} />
    </div>
  );
}
