import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../services/api";
import {
  Settings as SettingsIcon,
  Bot,
  Building2,
  CreditCard,
  HelpCircle,
  Palette,
  Search,
  Plus,
  MoreVertical,
  X,
  Save,
  Trash2,
  Check,
  Mail,
  Zap,
  Tags,
  Database,
  Wand2,
} from "lucide-react";
import { clsx } from "clsx";
import { HelpModal, useHelpModal } from "../components/HelpModal";
import { helpMicrosoft365 } from "../data/helpManuals";
import { useHotkeys } from "../hooks/useHotkeys";
import { DrxClawTab } from "../components/settings/DrxClawTab";
import { BackupTab } from "../components/settings/BackupTab";
import { SkillsTab } from "../components/settings/SkillsTab";
import { WorkflowsTab } from "../components/settings/WorkflowsTab";
import { TagsTab } from "../components/settings/TagsTab";
import { TabButton } from "../components/ui/TabButton";
import { getAuthPersistence, getUser, setUser } from "../auth/authStorage";
import { applyThemePreference, setStoredThemePreference, type ThemePreference } from "../utils/theme";

// --- COMPONENTS ---

const Modal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

const Microsoft365Diagnostics = ({ result }: any) => {
  if (!result) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h5 className="text-sm font-semibold text-white">
            DiagnÃ³stico da IntegraÃ§Ã£o
          </h5>
          <p className="text-xs text-slate-400">
            Resultado do Ãºltimo teste executado com as credenciais atuais.
          </p>
        </div>
        <span
          className={clsx(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] w-fit",
            result.success
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-200",
          )}
        >
          <Check size={14} />
          {result.success ? "IntegraÃ§Ã£o validada" : "RevisÃ£o necessÃ¡ria"}
        </span>
      </div>

      <div className="space-y-2">
        {(result.checks || []).map((check: any) => (
          <div
            key={check.key}
            className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium text-white">{check.label}</p>
              <p className="text-xs text-slate-400">{check.details}</p>
            </div>
            <span
              className={clsx(
                "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                check.status === "success" &&
                  "bg-emerald-500/15 text-emerald-300",
                check.status === "warning" &&
                  "bg-amber-500/15 text-amber-200",
                check.status === "error" && "bg-red-500/15 text-red-300",
              )}
            >
              {check.status === "success"
                ? "OK"
                : check.status === "warning"
                  ? "AtenÃ§Ã£o"
                  : "Erro"}
            </span>
          </div>
        ))}
      </div>

      {result.resolved && (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Drive ID
            </p>
            <p className="mt-1 break-all text-xs text-slate-200">
              {result.resolved.driveId || "-"}
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Pasta Validada
            </p>
            <p className="mt-1 break-all text-xs text-slate-200">
              {result.resolved.folderName || result.resolved.folderId || "-"}
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Origem da ResoluÃ§Ã£o
            </p>
            <p className="mt-1 text-xs text-slate-200">
              {result.resolved.ownerLabel || result.resolved.source || "-"}
            </p>
          </div>
        </div>
      )}

      {!!result.recommendations?.length && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
            RecomendaÃ§Ãµes
          </p>
          <div className="mt-2 space-y-1">
            {result.recommendations.map((item: string, index: number) => (
              <p key={`${item}-${index}`} className="text-xs text-blue-100/90">
                {item}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- BULK ACTIONS TAB ---

const BulkActionsTab = () => {
  const [loading, setLoading] = useState(false);
  const [tags, setTags] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<"contacts" | "processes">(
    "contacts",
  );

  // Action States
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedLawyer, setSelectedLawyer] = useState("");
  const [processCategory, setProcessCategory] = useState("");
  const [processStatus, setProcessStatus] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchTagsForActiveSubTab = async () => {
    try {
      const scope = activeSubTab === "contacts" ? "CONTACT" : "PROCESS";
      const tagsRes = await api.get(`/tags?scope=${scope}`);
      setTags(Array.isArray(tagsRes.data) ? tagsRes.data : []);
    } catch (err) {
      console.error("Erro ao carregar tags para aÃ§Ãµes em massa", err);
      setTags([]);
    }
  };

  useEffect(() => {
    void fetchTagsForActiveSubTab();
  }, [activeSubTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const usersRes = await api.get("/users");
      setUsers(usersRes.data);
      await fetchTagsForActiveSubTab();
    } catch (err) {
      console.error("Erro ao carregar dados para ações em massa", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchAction = async (
    module: "contacts" | "processes",
    action: string,
  ) => {
    const confirmMsg =
      module === "contacts"
        ? `Deseja aplicar esta ação a TODOS os contatos da sua base?`
        : `Deseja aplicar esta ação a todos os processos filtrados?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setLoading(true);
      const endpoint =
        module === "contacts"
          ? "/contacts/bulk-action"
          : "/processes/bulk-action";
      const payload: any = { action };

      if (action.includes("TAG")) payload.tagId = selectedTag;
      if (action === "UPDATE_LAWYER") payload.lawyerName = selectedLawyer;
      if (module === "processes") {
        if (processCategory) payload.category = processCategory;
        if (processStatus) payload.status = processStatus;
      }

      const res = await api.post(endpoint, payload);
      alert(`Ação concluída! Itens afetados: ${res.data.updatedCount}`);
    } catch (err: any) {
      alert(
        "Erro ao executar ação: " +
          (err.response?.data?.message || err.message),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex gap-4 p-1 bg-slate-950 rounded-lg w-fit border border-slate-800">
        <button
          onClick={() => setActiveSubTab("contacts")}
          className={clsx(
            "px-6 py-2 rounded-md font-medium transition-all",
            activeSubTab === "contacts"
              ? "bg-indigo-600 text-white shadow-lg"
              : "text-slate-500 hover:text-slate-300",
          )}
        >
          Contatos
        </button>
        <button
          onClick={() => setActiveSubTab("processes")}
          className={clsx(
            "px-6 py-2 rounded-md font-medium transition-all",
            activeSubTab === "processes"
              ? "bg-indigo-600 text-white shadow-lg"
              : "text-slate-500 hover:text-slate-300",
          )}
        >
          Processos
        </button>
      </div>

      {activeSubTab === "contacts" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* TAGS CONTACTS */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/20">
                <Tags className="text-indigo-400" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-white">
                Etiquetagem Global
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Selecione uma Etiqueta
                </label>
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white outline-none focus:border-indigo-500"
                >
                  <option value="">Selecione...</option>
                  {tags
                    .filter((t) => !t.scope || t.scope.includes("CONTACT"))
                    .map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  disabled={loading || !selectedTag}
                  onClick={() => handleBatchAction("contacts", "ADD_TAG")}
                  className="bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-600/30 font-medium py-3 rounded-lg transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Atribuir a Todos
                </button>
                <button
                  disabled={loading || !selectedTag}
                  onClick={() => handleBatchAction("contacts", "REMOVE_TAG")}
                  className="bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 font-medium py-3 rounded-lg transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} /> Remover de Todos
                </button>
              </div>
            </div>
          </div>

          {/* CATEGORY CONTACTS */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-500/20">
                <Database className="text-emerald-400" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-white">
                Categorização em Massa
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Nova Categoria
                </label>
                <select
                  value={processCategory}
                  onChange={(e) => setProcessCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white outline-none focus:border-emerald-500"
                >
                  <option value="">Selecione...</option>
                  <option value="Cliente">Cliente</option>
                  <option value="Fornecedor">Fornecedor</option>
                  <option value="Parte Contrária">Parte Contrária</option>
                  <option value="Perito">Perito</option>
                  <option value="Funcionário">Funcionário</option>
                </select>
              </div>

              <button
                disabled={loading || !processCategory}
                onClick={() => handleBatchAction("contacts", "UPDATE_CATEGORY")}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save size={18} /> Atualizar Todos os Contatos
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "processes" && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 bg-slate-800/20">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Zap className="text-yellow-500" size={20} />
                Ação em Lote para Processos
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Defina os filtros e a ação que deseja aplicar.
              </p>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* FILTERS */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                  1. Filtros (Opcional)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">
                      Categoria
                    </label>
                    <select
                      value={processCategory}
                      onChange={(e) => setProcessCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500"
                    >
                      <option value="">Todos</option>
                      <option value="JUDICIAL">Judicial</option>
                      <option value="EXTRAJUDICIAL">Extrajudicial</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">
                      Status
                    </label>
                    <select
                      value={processStatus}
                      onChange={(e) => setProcessStatus(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500"
                    >
                      <option value="">Todos</option>
                      <option value="ATIVO">Ativo</option>
                      <option value="SUSPENSO">Suspenso</option>
                      <option value="ARQUIVADO">Arquivado</option>
                      <option value="OPORTUNIDADE">Oportunidade</option>
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 italic">
                  Deixe "Todos" para atingir toda a base.
                </p>
              </div>

              {/* ACTION TO APPLY */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                  2. Ação a Aplicar
                </h4>
                <div className="space-y-6">
                  {/* TAG ACTION */}
                  <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/50">
                    <label className="block text-xs text-slate-400 mb-2">
                      Atribuir Etiqueta
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedTag}
                        onChange={(e) => setSelectedTag(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500"
                      >
                        <option value="">Selecione...</option>
                        {tags
                          .filter(
                            (t) => !t.scope || t.scope.includes("PROCESS"),
                          )
                          .map((tag) => (
                            <option key={tag.id} value={tag.id}>
                              {tag.name}
                            </option>
                          ))}
                      </select>
                      <button
                        disabled={loading || !selectedTag}
                        onClick={() =>
                          handleBatchAction("processes", "ADD_TAG")
                        }
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>

                  {/* LAWYER ACTION */}
                  <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/50">
                    <label className="block text-xs text-slate-400 mb-2">
                      Atribuir Advogado Responsável
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedLawyer}
                        onChange={(e) => setSelectedLawyer(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500"
                      >
                        <option value="">Selecione...</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.name}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={loading || !selectedLawyer}
                        onClick={() =>
                          handleBatchAction("processes", "UPDATE_LAWYER")
                        }
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        Atribuir
                      </button>
                    </div>
                  </div>

                  {/* STATUS ACTION */}
                  <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/50">
                    <label className="block text-xs text-slate-400 mb-2">
                      Mudar Status em Massa
                    </label>
                    <div className="flex gap-2">
                      <select
                        id="bulk-status-update"
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500"
                      >
                        <option value="ATIVO">Ativo</option>
                        <option value="SUSPENSO">Suspenso</option>
                        <option value="ARQUIVADO">Arquivado</option>
                        <option value="OPORTUNIDADE">Oportunidade</option>
                      </select>
                      <button
                        disabled={loading}
                        onClick={() => {
                          const val = (
                            document.getElementById(
                              "bulk-status-update",
                            ) as HTMLSelectElement
                          ).value;
                          setProcessStatus(val);
                          handleBatchAction("processes", "UPDATE_STATUS");
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        Mudar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- MAIN PAGE ---

export function Settings() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.tab || "options");
  const [loading, setLoading] = useState(false);
  const [testingMicrosoft365, setTestingMicrosoft365] = useState(false);
  const [microsoft365TestResult, setMicrosoft365TestResult] = useState<any>(null);
  const { isHelpOpen, setIsHelpOpen } = useHelpModal();

  // DATA
  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [myTenant, setMyTenant] = useState<any>(null);

  // MODAL STATE
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"tenant" | "plan">("tenant");
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  // PREFERENCES STATE
  const [userPrefs, setUserPrefs] = useState<{
    theme: string;
    soundEnabled: boolean;
  }>({ theme: "DARK", soundEnabled: true });
  const currentUser = useMemo(() => {
    return getUser() || {};
  }, []);
  const isSuperAdmin = currentUser?.email === "evandro@conectionmg.com.br";

  useEffect(() => {
    const user = getUser();
    if (user) {
      setUserPrefs({
        theme: user.theme || "DARK",
        soundEnabled: user.soundEnabled !== undefined ? user.soundEnabled : true,
      });
      setStoredThemePreference((user.theme || "DARK") as ThemePreference);
      applyThemePreference((user.theme || "DARK") as ThemePreference);
    }

    if (activeTab === "tenants") {
      fetchTenants();
      fetchPlans();
    }
    if (activeTab === "plans") fetchPlans();
    if (activeTab === "my-tenant") fetchMyTenant();
  }, [activeTab]);

  // --- FETCHING ---

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const res = await api.get("/saas/tenants");
      setTenants(res.data);
    } catch (error) {
      console.error("Erro ao carregar tenants", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await api.get("/saas/plans");
      setPlans(res.data);
    } catch (error) {
      console.error("Erro ao carregar planos", error);
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIONS ---

  const fetchMyTenant = async () => {
    try {
      setLoading(true);
      const res = await api.get("/saas/my-tenant");
      setMyTenant(res.data);
      setFormData({
        name: res.data.name,
        document: res.data.document,
        msTenantId: res.data.msTenantId || "",
        msClientId: res.data.msClientId || "",
        msClientSecret: res.data.msClientSecret || "",
        msDriveId: res.data.msDriveId || "",
        msFolderId: res.data.msFolderId || "",
        msObservation: res.data.msObservation || "",
        msStorageActive: res.data.msStorageActive || false,
      });
      setMicrosoft365TestResult(null);
    } catch (error) {
      console.error("Erro ao carregar minha empresa", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMyTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myTenant) return;
    try {
      setLoading(true);
      await api.post(`/saas/tenants/update/${myTenant.id}`, formData);
      alert("Configurações salvas com sucesso!");
      fetchMyTenant();
    } catch (error: any) {
      alert(
        "Erro ao salvar: " + (error.response?.data?.message || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTestMicrosoft365 = async (tenantId?: string) => {
    if (!tenantId) {
      alert("Salve a empresa primeiro para habilitar o teste da integraÃ§Ã£o.");
      return;
    }

    try {
      setTestingMicrosoft365(true);
      const res = await api.post(`/saas/tenants/test-microsoft/${tenantId}`, {
        msStorageActive: formData.msStorageActive,
        msTenantId: formData.msTenantId,
        msClientId: formData.msClientId,
        msClientSecret: formData.msClientSecret,
        msDriveId: formData.msDriveId,
        msFolderId: formData.msFolderId,
      });

      setMicrosoft365TestResult(res.data);

      if (!formData.msDriveId && res.data?.resolved?.driveId) {
        setFormData((current: any) => ({
          ...current,
          msDriveId: res.data.resolved.driveId,
        }));
      }
    } catch (error: any) {
      const fallback = {
        success: false,
        checks: [
          {
            key: "request",
            label: "Teste de integraÃ§Ã£o",
            status: "error",
            details:
              error.response?.data?.message ||
              error.message ||
              "Falha ao testar a integraÃ§Ã£o com o Microsoft 365.",
          },
        ],
        recommendations: [],
      };
      setMicrosoft365TestResult(fallback);
      alert(
        "Erro ao testar integraÃ§Ã£o: " +
          (error.response?.data?.message || error.message),
      );
    } finally {
      setTestingMicrosoft365(false);
    }
  };

  const handleOpenModal = (type: "tenant" | "plan", item?: any) => {
    setModalType(type);
    setEditingItem(item || null);

    if (type === "tenant") {
      setFormData(
        item
          ? {
              name: item.name,
              document: item.document,
              planId: item.planId,
              isActive: item.isActive,
              msTenantId: item.msTenantId || "",
              msClientId: item.msClientId || "",
              msClientSecret: item.msClientSecret || "",
              msDriveId: item.msDriveId || "",
              msFolderId: item.msFolderId || "",
              msObservation: item.msObservation || "",
              msStorageActive: item.msStorageActive || false,
              password: "", // Reset password field for security
            }
          : {
              name: "",
              document: "",
              planId: plans.length > 0 ? plans[0].id : "",
              isActive: true,
              msTenantId: "",
              msClientId: "",
              msClientSecret: "",
              msDriveId: "",
              msFolderId: "",
              msObservation: "",
              msStorageActive: false,
              email: "", // Only for new
              password: "",
            },
      );
    } else {
      setFormData(
        item
          ? {
              name: item.name,
              maxUsers: item.maxUsers,
              maxStorage: item.maxStorage,
              price: item.price,
            }
          : {
              name: "",
              maxUsers: 5,
              maxStorage: 1000,
              price: 0,
            },
      );
    }

    setMicrosoft365TestResult(null);
    setModalOpen(true);
  };

  useHotkeys({
    onNew: () => {
      if (activeTab === "tenants") handleOpenModal("tenant");
      if (activeTab === "plans") handleOpenModal("plan");
    },
    onCancel: () => {
      if (modalOpen) setModalOpen(false);
    },
  });

  const handleSave = async (e: React.FormEvent, closeAfterSave = true) => {
    e.preventDefault();
    try {
      setLoading(true);

      if (modalType === "tenant") {
        if (editingItem) {
          // Update
          await api.post(`/saas/tenants/update/${editingItem.id}`, formData);
        } else {
          // Create
          await api.post("/saas/register", formData);
        }
        fetchTenants(); // Refresh
      } else {
        if (editingItem) {
          await api.post(`/saas/plans/update/${editingItem.id}`, formData);
        } else {
          await api.post("/saas/plans", formData);
        }
        fetchPlans(); // Refresh
      }

      if (closeAfterSave) {
        setModalOpen(false);
      } else if (!editingItem) {
        // If it's a new item and we chose "Salvar" (don't close), ideally we should fetch
        // the new item and switch to edit mode. For now we will just close or clear form.
        // We'll close and alert to avoid duplicate creation on next click.
        alert(
          "Criado com sucesso. Para continuar editando busque o item na lista.",
        );
        setModalOpen(false);
      }
    } catch (error: any) {
      alert(
        "Erro ao salvar: " + (error.response?.data?.message || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePreference = async (type: "theme" | "soundEnabled", specificValue?: string) => {
    try {
      const user = getUser();
      if (!user) return;

      let newPrefs = { ...userPrefs };
      if (type === "theme") {
        newPrefs.theme = specificValue || (userPrefs.theme === "DARK" ? "LIGHT" : "DARK");
      } else {
        newPrefs.soundEnabled = !userPrefs.soundEnabled;
      }

      // UI Optimistic
      setUserPrefs(newPrefs);

      // Atualiza localStorage
      const updatedUser = {
        ...user,
        theme: newPrefs.theme,
        soundEnabled: newPrefs.soundEnabled,
      };
      setUser(updatedUser, getAuthPersistence());

      // Aplica tema visual imediatamente
      if (type === "theme") {
        setStoredThemePreference(newPrefs.theme as ThemePreference);
        applyThemePreference(newPrefs.theme as ThemePreference);
      }

      // Persiste na API
      await api.patch("/users/me/preferences", {
        theme: newPrefs.theme,
        soundEnabled: newPrefs.soundEnabled
      });
    } catch (error) {
      console.error("Erro ao salvar preferencia:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Tem certeza que deseja excluir? Esta ação não pode ser desfeita.",
      )
    )
      return;

    try {
      setLoading(true);
      if (activeTab === "tenants") {
        await api.post(`/saas/tenants/delete/${id}`);
        fetchTenants();
      } else {
        await api.post(`/saas/plans/delete/${id}`);
        fetchPlans();
      }
    } catch (error: any) {
      alert(
        "Erro ao excluir: " + (error.response?.data?.message || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  // --- RENDERERS ---

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-slate-400 text-sm">
          Gerencie as opções do sistema e do ambiente SaaS
        </p>
      </div>

      {/* TABS */}
      <div className="flex border-b border-slate-800 overflow-x-auto">
        <TabButton
          active={activeTab === "options"}
          onClick={() => setActiveTab("options")}
          icon={SettingsIcon}
          label="Opções"
        />
        <TabButton
          active={activeTab === "my-tenant"}
          onClick={() => setActiveTab("my-tenant")}
          icon={Building2}
          label="Minha Empresa"
        />
        <TabButton
          active={activeTab === "skills"}
          onClick={() => setActiveTab("skills")}
          icon={Wand2}
          label="Skills"
        />
        <TabButton
          active={activeTab === "drx-claw"}
          onClick={() => setActiveTab("drx-claw")}
          icon={Bot}
          label="DrX-Claw"
        />
        <TabButton
          active={activeTab === "workflows"}
          onClick={() => setActiveTab("workflows")}
          icon={SettingsIcon}
          label="Esteiras de Trabalho"
        />
        <TabButton
           active={activeTab === "tags"}
           onClick={() => setActiveTab("tags")}
           icon={Tags}
           label="Etiquetas"
         />

        {/* SAAS TABS - SUPER ADMIN ONLY */}
        {isSuperAdmin && (
          <>
            <TabButton
              active={activeTab === "tenants"}
              onClick={() => setActiveTab("tenants")}
              icon={Building2}
              label="Empresas"
            />
            <TabButton
              active={activeTab === "plans"}
              onClick={() => setActiveTab("plans")}
              icon={CreditCard}
              label="Planos"
            />
            <TabButton
              active={activeTab === "backup"}
              onClick={() => setActiveTab("backup")}
              icon={Database}
              label="Backup"
            />
          </>
        )}

        <TabButton
          active={activeTab === "help"}
          onClick={() => setActiveTab("help")}
          icon={HelpCircle}
          label="Ajuda"
        />
        <TabButton
          active={activeTab === "whitelabel"}
          onClick={() => setActiveTab("whitelabel")}
          icon={Palette}
          label="Whitelabel"
        />
      </div>

      {/* CONTENT */}
      <div className="min-h-[400px]">
        {/* === OPTIONS TAB === */}
        {activeTab === "options" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Geral</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <span className="text-slate-300 text-sm">
                    Notificações Sonoras
                  </span>
                  <div
                    onClick={() => handleTogglePreference("soundEnabled")}
                    className={clsx(
                      "w-10 h-5 rounded-full relative cursor-pointer transition-colors duration-200",
                      userPrefs.soundEnabled ? "bg-indigo-600" : "bg-slate-700",
                    )}
                  >
                    <div
                      className={clsx(
                        "absolute top-1 w-3 h-3 bg-white rounded-full transition-transform duration-200",
                        userPrefs.soundEnabled
                          ? "translate-x-6"
                          : "translate-x-1",
                      )}
                    ></div>
                  </div>
                </div>

                <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <Palette size={18} className="text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-white">Interface Visual</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Customize sua experiência</p>
                        </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "LIGHT", label: "Claro" },
                      { id: "DARK", label: "Escuro" },
                      { id: "SYSTEM", label: "Sistema" }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => handleTogglePreference("theme", opt.id)}
                        className={clsx(
                          "flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-300",
                          userPrefs.theme === opt.id
                            ? "bg-indigo-600/10 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.1)]"
                            : "bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                        )}
                      >
                        <div className={clsx(
                           "p-2 rounded-lg transition-colors",
                           userPrefs.theme === opt.id ? "bg-indigo-600 text-white" : "bg-slate-900"
                        )}>
                            {opt.id === "LIGHT" && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>}
                            {opt.id === "DARK" && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>}
                            {opt.id === "SYSTEM" && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>}
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === TAGS TAB === */}
        {activeTab === "tags" && <TagsTab />}

        {/* === MY TENANT TAB === */}
        {activeTab === "my-tenant" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6">
              Configurações da Minha Empresa
            </h3>

            {loading && !myTenant ? (
              <div className="text-slate-500">Carregando...</div>
            ) : (
              <form
                onSubmit={handleSaveMyTenant}
                className="space-y-6 max-w-2xl"
              >
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Nome do Escritório
                    </label>
                    <input
                      type="text"
                      value={formData.name || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      CNPJ/CPF
                    </label>
                    <input
                      type="text"
                      value={formData.document || ""}
                      disabled
                      className="w-full bg-slate-950/50 border border-slate-800/50 rounded-lg px-4 py-2 text-slate-500 cursor-not-allowed"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      O documento não pode ser alterado.
                    </p>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-800 space-y-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h4 className="text-md font-semibold text-white mb-2 flex items-center gap-2">
                        <svg
                          className="w-5 h-5 text-blue-500"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" />
                        </svg>
                        Integracao com Microsoft 365
                      </h4>
                      <p className="text-sm text-slate-400 max-w-2xl">
                        Configure a autenticacao no Azure, a biblioteca do OneDrive/SharePoint e registre observacoes operacionais para a equipe saber configurar, usar e testar a integracao.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsHelpOpen(true)}
                      className="inline-flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-200 transition-colors hover:bg-blue-500/20"
                    >
                      <HelpCircle size={16} />
                      Ajuda de Configuracao
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">1. Azure</p>
                      <p className="mt-2 text-sm text-slate-200">Cadastre Tenant ID, Client ID e Client Secret da aplicacao com permissoes Application.</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">2. Biblioteca</p>
                      <p className="mt-2 text-sm text-slate-200">Informe o Drive ID e a pasta raiz onde os processos e documentos serao criados.</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">3. Validacao</p>
                      <p className="mt-2 text-sm text-slate-200">Execute o teste para autenticar, localizar a pasta e criar uma pasta temporaria de prova.</p>
                    </div>
                  </div>

                  <div className="space-y-4 bg-slate-950 p-5 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.msStorageActive || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            msStorageActive: e.target.checked,
                          })
                        }
                        id="myMsStorageActive"
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                      />
                      <label
                        htmlFor="myMsStorageActive"
                        className="text-sm font-medium text-white cursor-pointer"
                      >
                        Ativar Armazenamento OneDrive/SharePoint
                      </label>
                    </div>

                    {formData.msStorageActive && (
                      <div className="space-y-4 mt-4 pt-4 border-t border-slate-800/50 animate-in fade-in duration-300">
                        <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1">
                            Tenant ID (Diretorio Azure)
                          </label>
                          <input
                            type="text"
                            value={formData.msTenantId || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                msTenantId: e.target.value,
                              })
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
                            placeholder="Ex: 83e40612-8967-4775-a1f5-d0946602163f"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">
                              Client ID (App)
                            </label>
                            <input
                              type="text"
                              value={formData.msClientId || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  msClientId: e.target.value,
                                })
                              }
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">
                              Client Secret
                            </label>
                            <input
                              type="password"
                              value={formData.msClientSecret || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  msClientSecret: e.target.value,
                                })
                              }
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">
                              Drive ID / Biblioteca
                            </label>
                            <input
                              type="text"
                              value={formData.msDriveId || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  msDriveId: e.target.value,
                                })
                              }
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
                              placeholder="Ex: b!ABCDEF..."
                            />
                            <p className="text-xs text-slate-500 mt-1">
                              Recomendado. O teste preenche automaticamente quando conseguir descobrir.
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">
                              ID da Pasta Raiz
                            </label>
                            <input
                              type="text"
                              value={formData.msFolderId || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  msFolderId: e.target.value,
                                })
                              }
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
                              placeholder="Ex: 01XTLPBK3F..."
                            />
                            <p className="text-xs text-slate-500 mt-1">
                              Pasta mae onde as subpastas dos processos serao geradas.
                            </p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1">
                            Observacoes da Integracao
                          </label>
                          <textarea
                            rows={4}
                            value={formData.msObservation || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                msObservation: e.target.value,
                              })
                            }
                            className="w-full resize-y bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-white focus:border-blue-500 outline-none"
                            placeholder="Ex: Biblioteca principal aprovada pelo TI em 11/03/2026, usar homologacao para testes, responsavel pela conta Microsoft: financeiro@empresa.com."
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            Registre contexto, cuidados, links, responsaveis e detalhes relevantes para uso e suporte.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <Microsoft365Diagnostics result={microsoft365TestResult} />
                </div>

                <div className="pt-6 border-t border-slate-800 flex flex-col gap-3 md:flex-row md:justify-end">
                  <button
                    type="button"
                    disabled={testingMicrosoft365 || !myTenant}
                    onClick={() => handleTestMicrosoft365(myTenant?.id)}
                    className="border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-100 px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {testingMicrosoft365 ? "Testando integracao..." : "Testar Integracao"}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Save size={18} />
                    {loading ? "Salvando..." : "Salvar Configuracoes"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {activeTab === "skills" && <SkillsTab />}

        {activeTab === "workflows" && <WorkflowsTab />}

        {activeTab === "drx-claw" && <DrxClawTab />}

        {activeTab === "backup" && isSuperAdmin && <BackupTab />}

        {/* === TENANTS TAB === */}
        {activeTab === "tenants" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-64">
                <Search
                  className="absolute left-3 top-2.5 text-slate-500"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Buscar empresa..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                onClick={() => handleOpenModal("tenant")}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={18} />
                Nova Empresa
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3 font-medium">Empresa</th>
                    <th className="px-6 py-3 font-medium">Documento</th>
                    <th className="px-6 py-3 font-medium">Plano</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {loading && tenants.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-8 text-center text-slate-500"
                      >
                        Carregando...
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    tenants.map((tenant) => (
                      <tr
                        key={tenant.id}
                        className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                        onDoubleClick={() => handleOpenModal("tenant", tenant)}
                        title="Duplo clique para editar"
                      >
                        <td className="px-6 py-4 font-medium text-white">
                          {tenant.name}
                        </td>
                        <td className="px-6 py-4">{tenant.document}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 text-xs font-bold border border-indigo-500/20">
                            {tenant.plan?.name || "Sem Plano"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {tenant.isActive ? (
                            <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                              ATIVO
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-red-400 text-xs font-bold">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                              INATIVO
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                          <button
                            onClick={() => handleDelete(tenant.id)}
                            className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                          <button
                            onClick={() => handleOpenModal("tenant", tenant)}
                            className="text-slate-400 hover:text-white p-1"
                          >
                            <MoreVertical size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 text-right mt-2">
              * Dê um duplo clique na linha para editar.
            </p>
          </div>
        )}

        {/* === PLANS TAB === */}
        {activeTab === "plans" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Planos de Assinatura
              </h2>
              <button
                onClick={() => handleOpenModal("plan")}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={18} />
                Novo Plano
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-indigo-500/50 transition-all cursor-pointer group"
                  onDoubleClick={() => handleOpenModal("plan", plan)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        {plan.name}
                      </h3>
                      <p className="text-2xl text-indigo-400 font-bold mt-1">
                        R$ {Number(plan.price).toFixed(2)}
                        <span className="text-sm text-slate-500 font-normal">
                          /mês
                        </span>
                      </p>
                    </div>
                    <CreditCard
                      className="text-slate-600 group-hover:text-indigo-500 transition-colors"
                      size={24}
                    />
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Check size={16} className="text-emerald-500" />
                      <span>
                        Até <b>{plan.maxUsers}</b> usuários
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Check size={16} className="text-emerald-500" />
                      <span>
                        <b>{plan.maxStorage} MB</b> de armazenamento
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-slate-800">
                    <button
                      onClick={() => handleOpenModal("plan", plan)}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(plan.id);
                      }}
                      className="bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 p-2 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}

              {plans.length === 0 && !loading && (
                <div className="col-span-3 text-center py-12 text-slate-500 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                  <CreditCard size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Nenhum plano cadastrado.</p>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 text-right mt-2">
              * Dê um duplo clique no card para editar.
            </p>
          </div>
        )}

        {/* === HELP TAB === */}
        {activeTab === "help" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <HelpCircle size={32} className="text-indigo-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Central de Ajuda
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto mb-6">
              Centralize manuais, passos de configuracao e testes guiados. A documentacao da integracao Microsoft 365 agora inclui Azure, Drive ID, pasta raiz, teste de criacao de pasta e checklist de validacao.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">
                Abrir Chamado
              </button>
              <button
                onClick={() => setIsHelpOpen(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
              >
                Ver Guia do Microsoft 365
              </button>
            </div>
          </div>
        )}

        {/* === WHITELABEL TAB === */}
        {activeTab === "whitelabel" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            <div className="relative z-10">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
                <Palette size={32} className="text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                Personalização Whitelabel
              </h2>
              <p className="text-slate-400 max-w-lg mx-auto mb-8">
                Personalize a plataforma com a sua marca. Altere cores,
                logotipo, domínio e muito mais para oferecer uma experiência
                exclusiva aos seus clientes.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8 text-left">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg">
                  <div className="w-8 h-8 rounded bg-indigo-500/20 flex items-center justify-center mb-3">
                    <Palette size={16} className="text-indigo-400" />
                  </div>
                  <h3 className="font-medium text-white mb-1">Cores e Tema</h3>
                  <p className="text-xs text-slate-500">
                    Defina a paleta de cores da interface.
                  </p>
                </div>
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg">
                  <div className="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center mb-3">
                    <Building2 size={16} className="text-purple-400" />
                  </div>
                  <h3 className="font-medium text-white mb-1">
                    Domínio Personalizado
                  </h3>
                  <p className="text-xs text-slate-500">
                    Use seu próprio domínio (ex: app.suaempresa.com).
                  </p>
                </div>
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg">
                  <div className="w-8 h-8 rounded bg-emerald-500/20 flex items-center justify-center mb-3">
                    <Mail size={16} className="text-emerald-400" />
                  </div>
                  <h3 className="font-medium text-white mb-1">
                    Emails Transacionais
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configure remetente e templates de email.
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold border border-indigo-500/20">
                DISPONÍVEL NO PLANO ENTERPRISE
              </span>
            </div>
          </div>
        )}
      </div>

      {/* === MODAL === */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingItem
            ? `Editar ${modalType === "tenant" ? "Empresa" : "Plano"}`
            : `Nova ${modalType === "tenant" ? "Empresa" : "Plano"}`
        }
      >
        <form onSubmit={(e) => handleSave(e, true)} className="space-y-4">
          {/* FORMULARIO DE EMPRESA */}
          {modalType === "tenant" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Nome da Empresa
                </label>
                <input
                  autoFocus
                  required
                  type="text"
                  value={formData.name || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Documento (CPF/CNPJ)
                </label>
                <input
                  required
                  type="text"
                  value={formData.document || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, document: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Inscrição Estadual
                  </label>
                  <input
                    type="text"
                    value={formData.stateRegistration || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stateRegistration: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Inscrição Municipal
                  </label>
                  <input
                    type="text"
                    value={formData.municipalRegistration || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        municipalRegistration: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              {!editingItem && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Email do Administrador
                  </label>
                  <input
                    required
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Plano
                </label>
                <select
                  required
                  value={formData.planId || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, planId: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                >
                  <option value="">Selecione...</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Nova Senha {editingItem && "(Deixe em branco para manter)"}
                </label>
                <input
                  type="password"
                  value={formData.password || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                  required={!editingItem}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  checked={formData.isActive || false}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  id="isActive"
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="isActive" className="text-sm text-slate-300">
                  Empresa Ativa
                </label>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-800 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-blue-500"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" />
                      </svg>
                      Integracao Microsoft 365
                    </h4>
                    <p className="text-xs text-slate-400 max-w-md">
                      Configure a conexao, registre observacoes importantes e valide a criacao de pastas sem sair da empresa.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsHelpOpen(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-200 transition-colors hover:bg-blue-500/20"
                  >
                    <HelpCircle size={14} />
                    Ajuda
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.msStorageActive || false}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          msStorageActive: e.target.checked,
                        })
                      }
                      id="msStorageActive"
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                    />
                    <label
                      htmlFor="msStorageActive"
                      className="text-sm text-slate-300"
                    >
                      Ativar Armazenamento OneDrive/SharePoint
                    </label>
                  </div>

                  {formData.msStorageActive && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Tenant ID Diretorio (Azure)
                        </label>
                        <input
                          type="text"
                          value={formData.msTenantId || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              msTenantId: e.target.value,
                            })
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                          placeholder="Ex: 83e40612-8967-4775-a1f5-d0946602163f"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Client ID (App)
                          </label>
                          <input
                            type="text"
                            value={formData.msClientId || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                msClientId: e.target.value,
                              })
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Client Secret
                          </label>
                          <input
                            type="password"
                            value={formData.msClientSecret || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                msClientSecret: e.target.value,
                              })
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Drive ID / Biblioteca
                          </label>
                          <input
                            type="text"
                            value={formData.msDriveId || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                msDriveId: e.target.value,
                              })
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                            placeholder="Ex: b!ABCDEF..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            ID da Pasta Raiz no OneDrive
                          </label>
                          <input
                            type="text"
                            value={formData.msFolderId || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                msFolderId: e.target.value,
                              })
                            }
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                            placeholder="Ex: 01XTLPBK3F..."
                          />
                          <p className="text-[10px] text-slate-500 mt-1">
                            Os processos serao criados como subpastas dentro desta pasta Microsoft.
                          </p>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Observacoes da Integracao
                        </label>
                        <textarea
                          rows={4}
                          value={formData.msObservation || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              msObservation: e.target.value,
                            })
                          }
                          className="w-full resize-y bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                          placeholder="Ex: pasta aprovada em 11/03/2026, conta corporativa, usar apenas para documentos oficiais, ambiente de homologacao liberado pelo admin."
                        />
                      </div>

                      <Microsoft365Diagnostics result={microsoft365TestResult} />

                      {editingItem ? (
                        <button
                          type="button"
                          disabled={testingMicrosoft365}
                          onClick={() => handleTestMicrosoft365(editingItem.id)}
                          className="w-full rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-100 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
                        >
                          {testingMicrosoft365 ? "Testando integracao..." : "Testar Integracao Microsoft 365"}
                        </button>
                      ) : (
                        <p className="text-[11px] text-slate-500">
                          Salve a empresa primeiro para habilitar o teste automatico da integracao.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* FORMULARIO DE PLANO */}
          {modalType === "plan" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Nome do Plano
                </label>
                <input
                  autoFocus
                  required
                  type="text"
                  value={formData.name || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                  placeholder="Ex: Basic, Pro, Enterprise"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Max Usuários
                  </label>
                  <input
                    required
                    type="number"
                    value={formData.maxUsers || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxUsers: parseInt(e.target.value),
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Armazenamento (MB)
                  </label>
                  <input
                    required
                    type="number"
                    value={formData.maxStorage || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxStorage: parseInt(e.target.value),
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Preço (R$)
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={formData.price || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price: parseFloat(e.target.value),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 mt-6">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancelar (ESC)
            </button>
            <button
              type="button"
              onClick={(e) => handleSave(e, false)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={(e) => handleSave(e, true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Save size={18} />
              Salvar e Sair
            </button>
          </div>
        </form>
      </Modal>

      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title="Integração Microsoft 365"
        sections={helpMicrosoft365}
      />
    </div>
  );
}
