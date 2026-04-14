import { useState, useEffect } from "react";
import axios from "axios";
import {
  FileText,
  Plus,
  Search,
  Trash2,
  BookOpen,
  Archive,
  Save,
  ArrowLeft,
  Tag as TagIcon,
  X,
  Settings2,
  Sparkles,
  RefreshCw,
  Shield,
  Copy,
  Grid,
  List,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { RichTextEditor } from "../components/ui/RichTextEditor";
import { useHotkeys } from "../hooks/useHotkeys";
import { clsx } from "clsx";
import { getUser } from "../auth/authStorage";
import { HelpModal, useHelpModal } from "../components/HelpModal";
import { helpLibrary } from "../data/helpManuals";
import {
  defaultTagColor,
  getAccentUiStyles,
  themeColor,
} from "../utils/themeColors";
import { AdvancedTagFilter } from "../components/ui/AdvancedTagFilter";
import { InlineTags } from "../components/ui/InlineTags";
import { DataGrid } from "../components/ui/DataGrid";
import { TenantDocumentLayoutSettings } from "../components/documents/TenantDocumentLayoutSettings";

interface Template {
  id: string;
  title: string;
  content: string;
  categoryId?: string | null;
  updatedAt: string;
  description?: string | null;
  tags?: any;
  globalTags?: any;
  tagIds?: any;
  preferredStorage?: string | null;
  metadata?: any;
  isSystemTemplate?: boolean;
  systemKey?: string | null;
  sourceTemplateId?: string | null;
}

interface GlobalTag {
  id: string;
  name: string;
  color: string;
  textColor?: string;
  isInternal?: boolean;
}

interface DocumentHistory {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

type LibraryTab = "TEMPLATES" | "HISTORY" | "SETTINGS";
type TemplateViewMode = "CARDS" | "LIST";
type TemplateSortField = "updatedAt" | "title" | "createdAt";
type HistorySortField = "createdAt" | "updatedAt" | "title" | "status";

interface PersistedLibraryState {
  activeTab?: LibraryTab;
  searchTerm?: string;
  templateViewMode?: TemplateViewMode;
  templateSortField?: TemplateSortField;
  templateSortDirection?: "asc" | "desc";
  historySortField?: HistorySortField;
  historySortDirection?: "asc" | "desc";
  includedTags?: string[];
  excludedTags?: string[];
}

const LIBRARY_STATE_KEY = "drx:library:state:v3";
const INTERNAL_SYSTEM_TAG_NAME = "SISTEMA";
const INTERNAL_SYSTEM_TAG_COLOR = "#f59e0b";
const INTERNAL_SYSTEM_TAG_TEXT = "#ffffff";

const readLibraryState = (): PersistedLibraryState => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.sessionStorage.getItem(LIBRARY_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const getLibraryAccentStyles = (
  color?: string | null,
  options?: {
    backgroundAlpha?: number;
    borderAlpha?: number;
    minContrast?: number;
    surfaceColor?: string | null;
  },
) =>
  getAccentUiStyles(color, {
    surfaceColor: themeColor.slate950,
    backgroundAlpha: 0.14,
    borderAlpha: 0.34,
    minContrast: 4.8,
    ...options,
  });

const normalizeSystemTag = (tag?: Partial<GlobalTag> | null): GlobalTag => ({
  id: String(tag?.id || "__library_system_tag__"),
  name: INTERNAL_SYSTEM_TAG_NAME,
  color: String(tag?.color || INTERNAL_SYSTEM_TAG_COLOR),
  textColor: String(tag?.textColor || INTERNAL_SYSTEM_TAG_TEXT),
  isInternal: true,
});

const isInternalSystemTag = (tag?: Partial<GlobalTag> | null) =>
  String(tag?.name || "").trim().toUpperCase() === INTERNAL_SYSTEM_TAG_NAME;

export function Library() {
  const isSuperAdmin = (() => {
    const baseEmails = ["evandro@conectionmg.com.br"];
    const envEmails = String(
      (import.meta as any)?.env?.VITE_SUPERADMIN_EMAILS || "",
    )
      .split(",")
      .map((x: string) => x.trim().toLowerCase())
      .filter(Boolean);
    const allowed = new Set(
      [...baseEmails, ...envEmails].map((x) => x.toLowerCase()),
    );
    const u = getUser();
    const email = String(u?.email || "")
      .trim()
      .toLowerCase();
    return Boolean(email && allowed.has(email));
  })();

  const persistedState = readLibraryState();

  const [activeTab, setActiveTab] = useState<LibraryTab>(
    persistedState.activeTab || "TEMPLATES",
  );
  const [templates, setTemplates] = useState<Template[]>([]);
  const [history, setHistory] = useState<DocumentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(
    persistedState.searchTerm || "",
  );
  const [searchTerm, setSearchTerm] = useState(persistedState.searchTerm || "");

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorTitle, setEditorTitle] = useState("");
  const [editorDescription, setEditorDescription] = useState("");
  const [editorPreferredStorage, setEditorPreferredStorage] = useState<
    "WORD_ONLINE" | "GOOGLE_DOCS" | ""
  >("WORD_ONLINE");
  const [editorTags, setEditorTags] = useState<GlobalTag[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [editorMode, setEditorMode] = useState<"TENANT" | "SYSTEM">("TENANT");
  const [editorSystemKey, setEditorSystemKey] = useState("");
  const [availableLibraryTags, setAvailableLibraryTags] = useState<GlobalTag[]>(
    [],
  );
  const [loadingLibraryTags, setLoadingLibraryTags] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editorMetadataText, setEditorMetadataText] = useState("");
  const [editorReadOnly, setEditorReadOnly] = useState(false);
  const [editorAction, setEditorAction] = useState<"EDIT" | "COPY">("EDIT");

  // Filter state
  const [includedTags, setIncludedTags] = useState<string[]>(
    persistedState.includedTags || [],
  );
  const [excludedTags, setExcludedTags] = useState<string[]>(
    persistedState.excludedTags || [],
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [templateViewMode, setTemplateViewMode] = useState<TemplateViewMode>(
    persistedState.templateViewMode || "LIST",
  );
  const [templateSortField, setTemplateSortField] = useState<TemplateSortField>(
    persistedState.templateSortField || "updatedAt",
  );
  const [templateSortDirection, setTemplateSortDirection] = useState<
    "asc" | "desc"
  >(persistedState.templateSortDirection || "desc");
  const [historySortField, setHistorySortField] = useState<HistorySortField>(
    persistedState.historySortField || "createdAt",
  );
  const [historySortDirection, setHistorySortDirection] = useState<
    "asc" | "desc"
  >(persistedState.historySortDirection || "desc");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);

  const { isHelpOpen, setIsHelpOpen } = useHelpModal();
  const systemAccentStyle = getLibraryAccentStyles(themeColor.amber500, {
    backgroundAlpha: 0.14,
    borderAlpha: 0.34,
    minContrast: 5,
  });
  const systemActionStyle = getLibraryAccentStyles(themeColor.amber500, {
    backgroundAlpha: 0.16,
    borderAlpha: 0.4,
    minContrast: 5.1,
  });
  const officeAccentStyle = getLibraryAccentStyles(themeColor.emerald500, {
    backgroundAlpha: 0.14,
    borderAlpha: 0.34,
    minContrast: 4.9,
  });
  const copyAccentStyle = getLibraryAccentStyles(themeColor.indigo500, {
    backgroundAlpha: 0.14,
    borderAlpha: 0.32,
    minContrast: 4.8,
  });
  const internalCommentAccentStyle = getLibraryAccentStyles(
    themeColor.amber500,
    {
      backgroundAlpha: 0.1,
      borderAlpha: 0.26,
      minContrast: 5.3,
      surfaceColor: themeColor.slate900,
    },
  );

  useHotkeys({
    onNew: () => handleNewTemplate(),
    onCancel: () => {
      if (isEditorOpen) {
        setIsEditorOpen(false);
        return;
      }

      if (activeTab === "SETTINGS") {
        setActiveTab("TEMPLATES");
      }
    },
    enableNew: !isEditorOpen,
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const payload: PersistedLibraryState = {
      activeTab,
      searchTerm: searchInput,
      templateViewMode,
      templateSortField,
      templateSortDirection,
      historySortField,
      historySortDirection,
      includedTags,
      excludedTags,
    };

    window.sessionStorage.setItem(LIBRARY_STATE_KEY, JSON.stringify(payload));
  }, [
    activeTab,
    searchInput,
    templateViewMode,
    templateSortField,
    templateSortDirection,
    historySortField,
    historySortDirection,
    includedTags,
    excludedTags,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    if (activeTab !== "SETTINGS") {
      void fetchData(controller.signal);
    }

    void fetchLibraryTags(controller.signal);

    return () => controller.abort();
  }, [
    activeTab,
    searchTerm,
    includedTags,
    excludedTags,
    templateSortField,
    templateSortDirection,
    historySortField,
    historySortDirection,
  ]);

  const fetchData = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      if (activeTab === "TEMPLATES") {
        const params: any = {};
        if (searchTerm) params.q = searchTerm;
        if (includedTags.length > 0)
          params.includedTags = includedTags.join(",");
        if (excludedTags.length > 0)
          params.excludedTags = excludedTags.join(",");
        params.sortBy = templateSortField;
        params.sortDirection = templateSortDirection;

        const res = await api.get("/documents/templates", {
          params,
          signal,
        });
        setTemplates(res.data);
        setSelectedTemplateIds([]);
        return;
      }

      if (activeTab === "HISTORY") {
        const res = await api.get("/documents", {
          params: {
            q: searchTerm || undefined,
            sortBy: historySortField,
            sortDirection: historySortDirection,
          },
          signal,
        });
        setHistory(res.data);
      }
    } catch (err: any) {
      if (axios.isCancel(err)) return;
      console.error(err);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const refreshCurrentTab = async () => {
    setIsRefreshing(true);
    try {
      await fetchData();
      await fetchLibraryTags();
    } finally {
      setIsRefreshing(false);
    }
  };

  const normalizeGlobalTags = (tags: any): GlobalTag[] => {
    const list = Array.isArray(tags) ? tags : [];
    return list
      .map((t) => ({
        id: String(t?.id || "").trim(),
        name: String(t?.name || "").trim(),
        color: String(t?.color || defaultTagColor).trim(),
        textColor: t?.textColor ? String(t.textColor) : undefined,
        isInternal: Boolean(t?.isInternal) || isInternalSystemTag(t),
      }))
      .filter((t) => t.id && t.name)
      .slice(0, 30);
  };

  const ensureSystemTagSelected = (tags: GlobalTag[]) => {
    if (tags.some((tag) => isInternalSystemTag(tag))) return tags;
    const availableSystemTag = availableLibraryTags.find((tag) =>
      isInternalSystemTag(tag),
    );
    return [
      normalizeSystemTag(availableSystemTag),
      ...tags.filter((tag) => !isInternalSystemTag(tag)),
    ].slice(0, 30);
  };

  const fetchLibraryTags = async (signal?: AbortSignal) => {
    try {
      setLoadingLibraryTags(true);
      const res = await api.get("/tags?scope=LIBRARY", { signal });
      setAvailableLibraryTags(normalizeGlobalTags(res.data));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLibraryTags(false);
    }
  };

  useEffect(() => {
    if (!isEditorOpen) return;
    const controller = new AbortController();
    void fetchLibraryTags(controller.signal);
    return () => controller.abort();
  }, [isEditorOpen]);

  useEffect(() => {
    if (!isEditorOpen || editorMode !== "SYSTEM") return;
    setEditorTags((prev) => ensureSystemTagSelected(prev));
  }, [availableLibraryTags, editorMode, isEditorOpen]);

  const setEditorFromTemplate = (tpl: Template | null) => {
    setEditingTemplate(tpl);
    const isSystemTpl = Boolean(tpl?.isSystemTemplate);
    setEditorMode(isSystemTpl ? "SYSTEM" : "TENANT");
    setEditorSystemKey(tpl?.systemKey || "");
    setEditorReadOnly(isSystemTpl && !isSuperAdmin);
    setEditorTitle(tpl?.title || "");
    setEditorContent(tpl?.content || "");
    setEditorDescription(tpl?.description || "");
    setEditorPreferredStorage((tpl?.preferredStorage as any) || "WORD_ONLINE");
    const nextTags = normalizeGlobalTags((tpl as any)?.globalTags);
    setEditorTags(isSystemTpl ? ensureSystemTagSelected(nextTags) : nextTags);
    setTagInput("");
    setShowAdvanced(false);
    setEditorMetadataText(
      tpl?.metadata ? JSON.stringify(tpl.metadata, null, 2) : "",
    );
  };

  const handleNewTemplate = () => {
    setEditorFromTemplate(null);
    setEditorMode("TENANT");
    setEditorSystemKey("");
    setEditorPreferredStorage("WORD_ONLINE");
    setIsEditorOpen(true);
  };

  const handleNewSystemTemplate = () => {
    setEditorFromTemplate(null);
    setEditorMode("SYSTEM");
    setEditorSystemKey("");
    setEditorPreferredStorage("WORD_ONLINE");
    setEditorTags(ensureSystemTagSelected([]));
    setEditorReadOnly(!isSuperAdmin);
    setIsEditorOpen(true);
  };

  const handleEditTemplate = (tpl: Template, action: "EDIT" | "COPY") => {
    setEditorAction(action);
    setEditorFromTemplate(tpl);
    if (action === "COPY") {
      setEditorMode("TENANT"); // Force to tenant mode to allow editing before saving copy
      setEditorReadOnly(false);
      setEditorTags((prev) => prev.filter((tag) => !tag.isInternal));
      if (!tpl.title.endsWith("(Cópia)")) {
        setEditorTitle(tpl.title + " (Cópia)");
      }
    }
    setIsEditorOpen(true);
  };

  const isTagSelected = (id: string) => editorTags.some((t) => t.id === id);

  const handleToggleTag = (tag: GlobalTag) => {
    setEditorTags((prev) => {
      if (editorMode !== "SYSTEM" && tag.isInternal) {
        toast.error("A tag SISTEMA é interna e não pode ser usada manualmente.");
        return prev;
      }

      if (prev.some((t) => t.id === tag.id)) {
        if (tag.isInternal) return prev;
        return prev.filter((t) => t.id !== tag.id);
      }
      const next = [...prev, tag].slice(0, 30);
      return editorMode === "SYSTEM" ? ensureSystemTagSelected(next) : next;
    });
  };

  const handleRemoveTag = (tagId: string) => {
    setEditorTags((prev) => {
      const current = prev.find((tag) => tag.id === tagId);
      if (current?.isInternal) return prev;
      const next = prev.filter((tag) => tag.id !== tagId);
      return editorMode === "SYSTEM" ? ensureSystemTagSelected(next) : next;
    });
  };

  const handleAddOrCreateTag = async (raw: string) => {
    const cleaned = raw.trim().replace(/^#/, "");
    if (!cleaned) return;

    const existing = availableLibraryTags.find(
      (t) => t.name.toLowerCase() === cleaned.toLowerCase(),
    );
    if (existing) {
      if (editorMode !== "SYSTEM" && existing.isInternal) {
        toast.error("A tag SISTEMA é interna e não pode ser usada manualmente.");
        return;
      }
      handleToggleTag(existing);
      return;
    }

    try {
      const res = await api.post("/tags", {
        name: cleaned,
        scope: ["LIBRARY"],
      });
      const created: GlobalTag = res.data;
      setAvailableLibraryTags((prev) => [created, ...prev]);
      if (editorMode !== "SYSTEM" && created.isInternal) {
        toast.error("A tag SISTEMA é interna e não pode ser usada manualmente.");
        return;
      }
      handleToggleTag(created);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao criar tag global");
    }
  };

  const handleSaveAsCopy = async () => {
    try {
      const payload: any = {
        title: editorTitle,
        content: editorContent,
        description: editorDescription,
        preferredStorage: editorPreferredStorage || undefined,
        tagIds: editorTags.map((tag) => tag.id).filter(Boolean),
        sourceTemplateId: editingTemplate?.id,
      };

      await api.post("/documents/templates", payload);
      toast.success("Cópia salva com sucesso! (Original mantido)");
      setIsEditorOpen(false);
      await refreshCurrentTab();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar cópia");
    }
  };

  const handleSaveTemplate = async () => {
    if (editorReadOnly) {
      toast.warning(
        'Modelos do sistema não podem ser editados. Use "Personalizar".',
      );
      return;
    }
    if (!editorTitle) {
      toast.warning("O título é obrigatório");
      return;
    }

    try {
      let parsedMetadata: any = undefined;
      if (editorMetadataText.trim()) {
        try {
          parsedMetadata = JSON.parse(editorMetadataText);
        } catch {
          toast.error("Metadata (JSON) inválido");
          return;
        }
      }

      const isSystemMode = editorMode === "SYSTEM";

      if (isSystemMode) {
        if (!isSuperAdmin) {
          toast.error("Acesso restrito ao SuperAdmin");
          return;
        }
        if (!editingTemplate && !editorSystemKey.trim()) {
          toast.warning(
            "O System Key é obrigatório para criar um modelo do sistema",
          );
          return;
        }

        const payload: any = {
          title: editorTitle,
          content: editorContent,
          description: editorDescription || undefined,
          tags: editorTags.map((tag) => tag.name),
          preferredStorage: editorPreferredStorage || undefined,
          metadata: parsedMetadata,
        };

        if (editingTemplate?.id) {
          await api.put(
            `/documents/system/templates/${editingTemplate.id}`,
            payload,
          );
          toast.success("Modelo do sistema atualizado!");
        } else {
          await api.post("/documents/system/templates", {
            ...payload,
            systemKey: editorSystemKey.trim(),
          });
          toast.success("Modelo do sistema criado!");
        }

        setIsEditorOpen(false);
        await refreshCurrentTab();
        return;
      }

      const payload: any = {
        title: editorTitle,
        content: editorContent,
        description: editorDescription || undefined,
        tagIds: editorTags.length ? editorTags.map((t) => t.id) : undefined,
        preferredStorage: editorPreferredStorage || undefined,
        metadata: parsedMetadata,
      };

      if (editingTemplate) {
        await api.put(`/documents/templates/${editingTemplate.id}`, payload);
        toast.success("Modelo atualizado!");
      } else {
        await api.post("/documents/templates", payload);
        toast.success("Modelo criado!");
      }
      setIsEditorOpen(false);
      await refreshCurrentTab();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar modelo");
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Deseja excluir este modelo?")) return;
    try {
      await api.delete(`/documents/templates/${id}`);
      toast.success("Modelo excluído");
      await refreshCurrentTab();
    } catch (err) {
      toast.error("Erro ao excluir");
    }
  };

  const handleDeleteSystemTemplate = async (id: string) => {
    if (!isSuperAdmin) return toast.error("Acesso restrito ao SuperAdmin");
    if (
      !confirm("Excluir modelo do sistema? Isso pode impactar outras empresas.")
    )
      return;
    try {
      await api.delete(`/documents/system/templates/${id}`);
      toast.success("Modelo do sistema excluído");
      await refreshCurrentTab();
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.response?.data?.message || "Erro ao excluir modelo do sistema",
      );
    }
  };

  const handleForceSyncSystemLibrary = async () => {
    if (!isSuperAdmin) return toast.error("Acesso restrito ao SuperAdmin");
    if (
      !confirm(
        "Forçar sincronização do sistema irá SOBRESCREVER os modelos do sistema pelo código. Continuar?",
      )
    )
      return;
    try {
      await api.post("/documents/system/sync?force=true");
      toast.success("Modelos do sistema sincronizados (force)");
      await refreshCurrentTab();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao sincronizar modelos do sistema");
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("pt-BR");
  };

  const statusLabel = (status?: string | null) => {
    if (String(status || "").toUpperCase() === "FINALIZED") return "Finalizado";
    return "Rascunho";
  };

  const hasTemplateFilters = Boolean(
    searchTerm || includedTags.length > 0 || excludedTags.length > 0,
  );

  const handleClearTemplateFilters = () => {
    setSearchInput("");
    setIncludedTags([]);
    setExcludedTags([]);
  };

  const handleTemplateSort = (field: string, direction: "asc" | "desc") => {
    const allowedFields: TemplateSortField[] = [
      "updatedAt",
      "title",
      "createdAt",
    ];
    if (!allowedFields.includes(field as TemplateSortField)) return;
    setTemplateSortField(field as TemplateSortField);
    setTemplateSortDirection(direction);
  };

  const handleHistorySort = (field: string, direction: "asc" | "desc") => {
    const allowedFields: HistorySortField[] = [
      "createdAt",
      "updatedAt",
      "title",
      "status",
    ];
    if (!allowedFields.includes(field as HistorySortField)) return;
    setHistorySortField(field as HistorySortField);
    setHistorySortDirection(direction);
  };

  const templateColumns = [
    {
      key: "title",
      label: "Modelo",
      sortable: true,
      render: (tpl: Template) => (
        <div className="min-w-[220px]">
          <div className="font-semibold text-white flex items-center gap-2">
            <FileText size={14} className="text-indigo-400" />
            <span className="truncate">{tpl.title}</span>
          </div>
          {tpl.description && (
            <div className="text-xs text-slate-400 mt-1 line-clamp-2">
              {tpl.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "tags",
      label: "Tags",
      render: (tpl: Template) => (
        <div onClick={(event) => event.stopPropagation()}>
          <InlineTags
            entityId={tpl.id}
            entityType="library"
            tags={tpl.globalTags || []}
            readOnly={Boolean(tpl.isSystemTemplate)}
            onRefresh={() => void refreshCurrentTab()}
          />
        </div>
      ),
    },
    {
      key: "updatedAt",
      label: "Atualizado",
      sortable: true,
      render: (tpl: Template) => (
        <span className="text-xs text-slate-300">
          {formatDate(tpl.updatedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Acoes",
      render: (tpl: Template) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void handleEditTemplate(tpl, "COPY");
            }}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border hover:brightness-95"
            style={copyAccentStyle}
          >
            Copiar
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void handleEditTemplate(tpl, "EDIT");
            }}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
          >
            {tpl.isSystemTemplate && !isSuperAdmin ? "Visualizar" : "Editar"}
          </button>
          {(tpl.isSystemTemplate ? isSuperAdmin : true) && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (tpl.isSystemTemplate) {
                  void handleDeleteSystemTemplate(tpl.id);
                  return;
                }

                void handleDeleteTemplate(tpl.id);
              }}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20"
            >
              Excluir
            </button>
          )}
        </div>
      ),
    },
  ];

  const historyColumns = [
    {
      key: "title",
      label: "Documento",
      sortable: true,
      render: (doc: DocumentHistory) => (
        <div className="min-w-[220px]">
          <div className="font-semibold text-white">{doc.title}</div>
          <div className="text-xs text-slate-500 mt-1">
            Criado em {formatDate(doc.createdAt)}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (doc: DocumentHistory) => (
        <span
          className="px-2 py-1 text-xs rounded border"
          style={
            doc.status === "FINALIZED" ? officeAccentStyle : systemAccentStyle
          }
        >
          {statusLabel(doc.status)}
        </span>
      ),
    },
    {
      key: "createdAt",
      label: "Criado em",
      sortable: true,
      render: (doc: DocumentHistory) => (
        <span className="text-xs text-slate-300">
          {formatDate(doc.createdAt)}
        </span>
      ),
    },
    {
      key: "updatedAt",
      label: "Atualizado",
      sortable: true,
      render: (doc: DocumentHistory) => (
        <span className="text-xs text-slate-300">
          {formatDate(doc.updatedAt)}
        </span>
      ),
    },
  ];

  const filteredTemplates = templates;
  const filteredHistory = history;

  if (isEditorOpen) {
    const isSystem = editorMode === "SYSTEM";
    const canEditSystem = isSystem && isSuperAdmin;
    let metadataPreview: any = null;
    let metadataPreviewError = false;
    if (editorMetadataText.trim()) {
      try {
        metadataPreview = JSON.parse(editorMetadataText);
      } catch {
        metadataPreviewError = true;
      }
    }
    const internalCommentsPreview = Array.isArray(
      metadataPreview?.internalComments,
    )
      ? (metadataPreview.internalComments as any[])
          .map((x) => String(x))
          .filter(Boolean)
          .slice(0, 20)
      : [];
    const sectionsPreview = Array.isArray(metadataPreview?.sections)
      ? (metadataPreview.sections as any[]).slice(0, 20)
      : [];
    return (
      <>
        <div className="h-full flex flex-col bg-slate-950 animate-in fade-in slide-in-from-bottom-4">
          <div className="border-b border-slate-800 p-4 flex justify-between items-center bg-slate-900 gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition"
              >
                <ArrowLeft size={24} />
              </button>
              <div className="flex-1 max-w-2xl group">
                <div className="flex items-center gap-2">
                  <input
                    value={editorTitle}
                    onChange={(e) => setEditorTitle(e.target.value)}
                    placeholder="Título do Modelo (Ex: Procuração Ad Judicia)"
                    className={clsx(
                      "bg-transparent text-xl font-bold text-white focus:outline-none placeholder-slate-600 w-full px-2 py-1 transition-colors rounded",
                      editorReadOnly
                        ? "opacity-80"
                        : "hover:bg-slate-800 focus:bg-slate-800 border-b border-dashed border-slate-600 focus:border-indigo-500 hover:border-indigo-400",
                    )}
                    autoFocus
                    disabled={editorReadOnly}
                    title={
                      editorReadOnly
                        ? "Modelo do sistema não pode ser renomeado aqui"
                        : "Clique para alterar o nome do modelo"
                    }
                  />
                </div>
                <div className="flex items-center gap-2 mt-1 px-2">
                  {isSystem && (
                    <span
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
                      style={systemAccentStyle}
                    >
                      <Sparkles size={14} /> Modelo do Sistema
                    </span>
                  )}
                  {!!editingTemplate?.sourceTemplateId && !isSystem && (
                    <span
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
                      style={copyAccentStyle}
                    >
                      Copiado do Sistema
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsHelpOpen(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium flex items-center gap-2 transition border border-slate-700"
              >
                <BookOpen size={16} /> Ajuda (F1)
              </button>
              {isSystem && canEditSystem && (
                <>
                  {!!editingTemplate?.id && (
                    <button
                      onClick={() =>
                        handleDeleteSystemTemplate(editingTemplate.id)
                      }
                      className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-300 rounded-lg font-bold flex items-center gap-2 transition border border-red-500/20"
                      title="Excluir modelo do sistema"
                    >
                      <Trash2 size={18} /> Excluir
                    </button>
                  )}
                  <button
                    onClick={handleSaveTemplate}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-2 transition"
                    title="Salvar alterações no modelo do sistema"
                  >
                    <Save size={18} /> Salvar (Sistema)
                  </button>
                </>
              )}
              {editorAction === "COPY" && (
                <button
                  onClick={handleSaveAsCopy}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-2 transition"
                  title="Salvar como uma Nova Cópia no seu escritório"
                >
                  <Copy size={18} /> Salvar como Cópia
                </button>
              )}
              {editorAction === "EDIT" && (!isSystem || canEditSystem) && (
                <button
                  onClick={handleSaveTemplate}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-2 transition"
                >
                  <Save size={18} /> Salvar Modelo
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 p-6 overflow-hidden flex flex-col gap-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
                <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Settings2 size={16} /> Informações
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {isSystem && (
                    <div className="md:col-span-2">
                      <label className="text-xs text-slate-400">
                        System Key (identificador do modelo do sistema)
                      </label>
                      <input
                        value={editorSystemKey}
                        onChange={(e) => setEditorSystemKey(e.target.value)}
                        disabled={
                          Boolean(editingTemplate?.id) || !canEditSystem
                        }
                        placeholder="Ex: CHA_CONTRATO_HONORARIOS"
                        className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500 disabled:opacity-70"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Use um identificador único e estável. Depois de criado,
                        não pode ser alterado aqui.
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-slate-400">
                      Armazenamento
                    </label>
                    <select
                      value={editorPreferredStorage}
                      onChange={(e) =>
                        setEditorPreferredStorage(e.target.value as any)
                      }
                      disabled={editorReadOnly}
                      className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="WORD_ONLINE">
                        Word Online (Microsoft 365)
                      </option>
                      <option value="GOOGLE_DOCS">
                        Google Docs (Workspace)
                      </option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400">
                    Descrição (orientações jurídicas)
                  </label>
                  <textarea
                    value={editorDescription}
                    onChange={(e) => setEditorDescription(e.target.value)}
                    disabled={editorReadOnly}
                    rows={3}
                    placeholder="Ex: Baseado no Art. 319 do CPC..."
                    className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
                  />
                  {(internalCommentsPreview.length > 0 ||
                    sectionsPreview.length > 0 ||
                    metadataPreviewError) && (
                    <div className="mt-3 space-y-2">
                      {metadataPreviewError && (
                        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
                          Metadata (JSON) invÃ¡lido: corrija no modo avanÃ§ado
                          para visualizar comentÃ¡rios/seÃ§Ãµes.
                        </div>
                      )}
                      {internalCommentsPreview.length > 0 && (
                        <div
                          className="rounded p-2 border"
                          style={internalCommentAccentStyle}
                        >
                          <div className="text-[11px] font-bold text-amber-300 mb-1">
                            ComentÃ¡rios Internos
                          </div>
                          <ul className="list-disc pl-4 text-xs text-amber-200/90 space-y-1">
                            {internalCommentsPreview.map((c) => (
                              <li key={c}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {sectionsPreview.length > 0 && (
                        <div className="bg-slate-950 border border-slate-700 rounded p-2">
                          <div className="text-[11px] font-bold text-slate-300 mb-1">
                            SeÃ§Ãµes / Ajuda
                          </div>
                          <div className="space-y-1">
                            {sectionsPreview.map((s: any, idx: number) => (
                              <div
                                key={String(s?.title || idx)}
                                className="text-xs text-slate-300"
                              >
                                <span className="font-bold">
                                  {String(s?.title || "SeÃ§Ã£o")}
                                </span>
                                {s?.help ? (
                                  <span className="text-slate-500">
                                    {" "}
                                    - {String(s.help)}
                                  </span>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3 lg:col-span-2">
                <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <TagIcon size={16} /> Tags da Biblioteca
                </div>
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== ",") return;
                      e.preventDefault();

                      const parts = tagInput
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean);
                      setTagInput("");
                      if (!parts.length) return;

                      for (const part of parts) {
                        void handleAddOrCreateTag(part);
                      }
                    }}
                    disabled={isSystem ? !canEditSystem : false}
                    placeholder={
                      isSystem
                        ? "Digite e pressione Enter (ex: Cível, CPC, Contrato)"
                        : "Digite e pressione Enter (ex: Cível, CPC, Contrato)"
                    }
                    className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const parts = tagInput
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean);
                      setTagInput("");
                      if (!parts.length) return;

                      for (const part of parts) void handleAddOrCreateTag(part);
                    }}
                    disabled={isSystem ? !canEditSystem : false}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-700 text-sm"
                  >
                    Adicionar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(availableLibraryTags || [])
                    .filter((tag) => {
                      if (!isSystem && tag.isInternal) return false;
                      const q = tagInput.trim().toLowerCase();
                      if (!q) return true;
                      return (tag.name || "").toLowerCase().includes(q);
                    })
                    .slice(0, 14)
                    .map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleToggleTag(tag)}
                        disabled={isSystem ? !canEditSystem : false}
                        className={clsx(
                          "px-2 py-1 rounded-full text-xs font-bold border transition",
                          isTagSelected(tag.id)
                            ? "bg-slate-800 border-slate-600"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700",
                        )}
                        style={{
                          borderColor: `${tag.color}80`,
                          color: isTagSelected(tag.id) ? tag.color : undefined,
                        }}
                        title={
                          isTagSelected(tag.id) ? "Remover tag" : "Adicionar tag"
                        }
                      >
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          {tag.name}
                        </span>
                      </button>
                    ))}
                  {loadingLibraryTags && (
                    <span className="text-xs text-slate-500">
                      Carregando tags...
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {editorTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs"
                      style={{
                        backgroundColor: `${tag.color}20`,
                        borderColor: `${tag.color}55`,
                        color: tag.color,
                      }}
                    >
                      {tag.name}
                      {(!tag.isInternal && (!isSystem || canEditSystem)) && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag.id)}
                          className="ml-1 p-0.5 rounded hover:bg-white/10"
                          title="Remover"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </span>
                  ))}
                  {editorTags.length === 0 && (
                    <span className="text-xs text-slate-500">Sem tags.</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-2 mt-1"
                >
                  <Settings2 size={14} /> {showAdvanced ? "Ocultar" : "Mostrar"}{" "}
                  avançado (metadata/Visual Law)
                </button>
                {showAdvanced && (
                  <div className="mt-2">
                    <label className="text-xs text-slate-400">
                      Metadata (JSON)
                    </label>
                    <textarea
                      value={editorMetadataText}
                      onChange={(e) => setEditorMetadataText(e.target.value)}
                      disabled={editorReadOnly}
                      rows={7}
                      placeholder='{\n  \"sections\": [{\"title\": \"Dos Fatos\", \"help\": \"Descreva o ocorrido.\"}],\n  \"internalComments\": [\"Verificar pedido de Justiça Gratuita\"]\n}'
                      className="w-full mt-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <RichTextEditor
                value={editorContent}
                onChange={setEditorContent}
                showVariables={true}
                minHeight={960}
                placeholder="Estruture aqui o modelo da Biblioteca com títulos, subtítulos, cláusulas, assinaturas, tabelas e variáveis dinâmicas."
                readOnly={editorReadOnly}
                className={editorReadOnly ? "opacity-95" : undefined}
              />
            </div>
          </div>
        </div>
        <HelpModal
          isOpen={isHelpOpen}
          onClose={() => setIsHelpOpen(false)}
          title="Biblioteca"
          sections={helpLibrary}
        />
      </>
    );
  }

  return (
    <>
      <div className="p-8 space-y-6 h-full flex flex-col bg-slate-950">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <BookOpen className="text-indigo-400" size={32} />
                Biblioteca de Modelos
              </h1>
              <p className="text-slate-400 mt-1">
                Gerencie minutas, contratos e documentos padrão com busca, grid,
                tags e configurações do escritório.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 min-w-[140px]">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  Modelos
                </div>
                <div className="text-xl font-semibold text-white mt-1">
                  {templates.length}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 min-w-[140px]">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  Tags
                </div>
                <div className="text-xl font-semibold text-white mt-1">
                  {availableLibraryTags.length}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 min-w-[140px]">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  Historico
                </div>
                <div className="text-xl font-semibold text-white mt-1">
                  {history.length}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 justify-end">
            <button
              type="button"
              onClick={() => void refreshCurrentTab()}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-800 text-sm font-medium inline-flex items-center gap-2 transition"
            >
              <RefreshCw
                size={16}
                className={clsx(isRefreshing && "animate-spin")}
              />
              {isRefreshing ? "Atualizando..." : "Atualizar"}
            </button>
            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-800 text-sm font-medium inline-flex items-center gap-2 transition"
            >
              <BookOpen size={16} /> Ajuda (F1)
            </button>
            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveTab("TEMPLATES")}
                className={clsx(
                  "px-4 py-2 text-sm font-medium rounded-md transition",
                  activeTab === "TEMPLATES"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-500 hover:text-white",
                )}
              >
                Modelos
              </button>
              <button
                onClick={() => setActiveTab("HISTORY")}
                className={clsx(
                  "px-4 py-2 text-sm font-medium rounded-md transition",
                  activeTab === "HISTORY"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-500 hover:text-white",
                )}
              >
                Historico
              </button>
              <button
                onClick={() => setActiveTab("SETTINGS")}
                className={clsx(
                  "px-4 py-2 text-sm font-medium rounded-md transition inline-flex items-center gap-2",
                  activeTab === "SETTINGS"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-500 hover:text-white",
                )}
              >
                <Settings2 size={14} /> Configuracoes
              </button>
            </div>
          </div>
        </div>

        {activeTab !== "SETTINGS" && (
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-col gap-5 flex-1">
              {/* Barra de Busca - Linha Dedicada */}
              <div className="relative w-full group">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-indigo-400"
                  size={20}
                />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={
                    activeTab === "TEMPLATES"
                      ? "Buscar por título, descrição ou tags do modelo..."
                      : "Buscar documentos gerados recentemente..."
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-12 pr-4 py-4 text-lg text-white font-medium focus:ring-2 focus:ring-indigo-500/50 focus:outline-none transition-all shadow-lg placeholder:text-slate-600 focus:bg-slate-900 focus:border-indigo-500/50"
                />
              </div>

              {/* Tags de Filtro - Linha Dedicada abaixo da busca */}
              {activeTab === "TEMPLATES" && (
                <div className="bg-slate-950/20 p-2 rounded-xl border border-slate-900/50">
                  <AdvancedTagFilter
                    entityType="library"
                    includedIds={includedTags}
                    excludedIds={excludedTags}
                    onChange={(inc, exc) => {
                      setIncludedTags(inc);
                      setExcludedTags(exc);
                    }}
                    className="min-h-[48px]"
                  />
                </div>
              )}

              {activeTab === "TEMPLATES" && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setTemplateViewMode("LIST")}
                      className={clsx(
                        "px-3 py-2 rounded-md inline-flex items-center gap-2 transition",
                        templateViewMode === "LIST"
                          ? "bg-slate-800 text-white"
                          : "text-slate-500 hover:text-white",
                      )}
                    >
                      <List size={14} /> Grid
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplateViewMode("CARDS")}
                      className={clsx(
                        "px-3 py-2 rounded-md inline-flex items-center gap-2 transition",
                        templateViewMode === "CARDS"
                          ? "bg-slate-800 text-white"
                          : "text-slate-500 hover:text-white",
                      )}
                    >
                      <Grid size={14} /> Cards
                    </button>
                  </div>
                  {selectedTemplateIds.length > 0 && (
                    <span className="px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-200">
                      {selectedTemplateIds.length} selecionado(s)
                    </span>
                  )}
                  {hasTemplateFilters && (
                    <button
                      type="button"
                      onClick={handleClearTemplateFilters}
                      className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-end">
              {activeTab === "TEMPLATES" && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab("SETTINGS")}
                    className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg flex items-center gap-2 transition border border-slate-800"
                  >
                    <Settings2 size={16} /> Configurar
                  </button>
                  {isSuperAdmin && (
                    <button
                      onClick={handleNewSystemTemplate}
                      className="px-5 py-3 font-medium rounded-lg flex items-center gap-2 transition border shadow-sm hover:brightness-95"
                      style={systemActionStyle}
                      title="Criar novo modelo do sistema (SuperAdmin)"
                    >
                      <Shield size={18} /> Novo Sistema
                    </button>
                  )}
                  <button
                    onClick={handleNewTemplate}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg flex items-center gap-2 transition shadow-lg shadow-indigo-500/20"
                  >
                    <Plus size={20} /> Novo Modelo
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto pr-2 min-h-0">
          {activeTab === "TEMPLATES" ? (
            templateViewMode === "LIST" ? (
              <DataGrid<Template>
                data={filteredTemplates}
                columns={templateColumns}
                pageSize={12}
                totalItems={filteredTemplates.length}
                isLoading={loading}
                onSort={handleTemplateSort}
                onSelect={setSelectedTemplateIds}
                onRowDoubleClick={(tpl) => handleEditTemplate(tpl, "EDIT")}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    onDoubleClick={() => handleEditTemplate(tpl, "EDIT")}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-6 group transition flex flex-col h-full hover:border-indigo-500/50 cursor-pointer select-none"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition">
                        <FileText size={24} />
                      </div>
                      <div className="flex gap-2">
                        {tpl.isSystemTemplate ? (
                          <>
                            {isSuperAdmin && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSystemTemplate(tpl.id);
                                }}
                                className="p-2 hover:bg-red-500/20 text-red-500 bg-red-500/10 rounded-lg transition"
                                title="Excluir (Sistema)"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTemplate(tpl.id);
                            }}
                            className="p-2 hover:bg-red-500/20 text-red-500 bg-red-500/10 rounded-lg transition"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    <h3 className="font-bold text-white text-lg mb-1 truncate">
                      {tpl.title}
                    </h3>
                    {!!tpl.description && (
                      <p className="text-slate-400 text-sm line-clamp-2 mb-2">
                        {tpl.description}
                      </p>
                    )}
                    <div className="my-2" onClick={(e) => e.stopPropagation()}>
                      <InlineTags
                        entityId={tpl.id}
                        entityType="library"
                        tags={tpl.globalTags || []}
                        readOnly={Boolean(tpl.isSystemTemplate)}
                        onRefresh={() => void refreshCurrentTab()}
                      />
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTemplate(tpl, "COPY");
                        }}
                        className="flex-1 py-2 text-sm font-bold rounded-lg flex justify-center items-center gap-2 transition border hover:brightness-95"
                        style={copyAccentStyle}
                      >
                        <Copy size={16} /> Fazer Cópia
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTemplate(tpl, "EDIT");
                        }}
                        className="flex-1 py-2 text-sm font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex justify-center items-center gap-2 transition border border-slate-700"
                      >
                        <FileText size={16} />{" "}
                        {tpl.isSystemTemplate && !isSuperAdmin
                          ? "Visualizar"
                          : "Editar"}
                      </button>
                    </div>
                  </div>
                ))}
                {filteredTemplates.length === 0 && !loading && (
                  <div className="col-span-full text-center py-20 text-slate-500">
                    <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
                    <p>
                      {hasTemplateFilters
                        ? "Nenhum modelo encontrado com os filtros atuais."
                        : "Nenhum modelo encontrado. Crie o primeiro!"}
                    </p>
                  </div>
                )}
              </div>
            )
          ) : activeTab === "HISTORY" ? (
            filteredHistory.length > 0 || loading ? (
              <DataGrid<DocumentHistory>
                data={filteredHistory}
                columns={historyColumns}
                pageSize={12}
                totalItems={filteredHistory.length}
                isLoading={loading}
                onSort={handleHistorySort}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <Archive size={48} className="mx-auto mb-4 opacity-20" />
                  <p>
                    {searchTerm
                      ? "Nenhum documento encontrado para a busca."
                      : "Nenhum documento gerado ate o momento."}
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Settings2 size={18} className="text-indigo-400" />
                    Configuracao da Biblioteca
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Centralize tags, modelos do sistema e padroes de cabecalho e
                    rodape do escritorio.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    Tags
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-4 text-sm text-slate-300 space-y-3">
                    <p>
                      A Biblioteca agora usa somente tags para classificar,
                      filtrar e identificar os modelos.
                    </p>
                    <p>
                      A tag <span className="font-semibold text-amber-300">SISTEMA</span>{" "}
                      e interna, aplicada automaticamente aos modelos do sistema e
                      protegida contra edicao e exclusao.
                    </p>
                    <div className="text-xs text-slate-500">
                      Tags disponiveis no tenant: {availableLibraryTags.length}
                    </div>
                  </div>
                </div>

                {isSuperAdmin && (
                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                      Sistema
                    </div>
                    <button
                      onClick={() => void handleForceSyncSystemLibrary()}
                      className="w-full px-4 py-3 bg-slate-950 hover:bg-slate-800 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition border border-slate-700"
                    >
                      <RefreshCw size={16} /> Sincronizar modelos do sistema
                    </button>
                    <button
                      onClick={() => void handleNewSystemTemplate()}
                      className="w-full px-4 py-3 font-medium rounded-lg flex items-center justify-center gap-2 transition border shadow-sm hover:brightness-95"
                      style={systemActionStyle}
                    >
                      <Shield size={16} /> Criar modelo de sistema
                    </button>
                  </div>
                )}
              </div>

              <TenantDocumentLayoutSettings />
            </div>
          )}
        </div>
      </div>
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title="Biblioteca"
        sections={helpLibrary}
      />
    </>
  );
}
