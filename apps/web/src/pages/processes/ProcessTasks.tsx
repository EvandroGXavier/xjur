import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Filter,
  Search,
  User,
} from "lucide-react";
import { api } from "../../services/api";
import { toast } from "sonner";
import { DataGrid } from "../../components/ui/DataGrid";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { clsx } from "clsx";

type TimelineTaskProcess = {
  id: string;
  code?: string | null;
  title?: string | null;
  cnj?: string | null;
  status?: string | null;
  category?: string | null;
};

type TimelineTaskItem = {
  id: string;
  processId: string;
  title: string;
  description?: string | null;
  date: string;
  internalDate?: string | null;
  fatalDate?: string | null;
  origin?: string | null;
  type?: string | null;
  category?: string | null;
  status?: string | null;
  priority?: string | null;
  requesterName?: string | null;
  responsibleName?: string | null;
  completedAt?: string | null;
  dueAt?: string | null;
  isOverdue?: boolean;
  process: TimelineTaskProcess;
};

type TasksResponse = {
  items: TimelineTaskItem[];
  summary: {
    myOpen: number;
    myOverdue: number;
    openTotal: number;
    overdueTotal: number;
  };
};

const getCurrentUserEmail = () => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return "";
    const user = JSON.parse(raw);
    return String(user.email || "").trim();
  } catch {
    return "";
  }
};

const formatDateDisplay = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "-";
  return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
};

const getStatusBadge = (status?: string | null) => {
  const normalized = String(status || "PENDENTE").toUpperCase();
  const map: Record<string, { label: string; className: string }> = {
    PENDENTE: {
      label: "Pendente",
      className: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    },
    EM_TRATAMENTO: {
      label: "Em tratamento",
      className: "bg-sky-500/10 text-sky-300 border-sky-500/20",
    },
    CONCLUIDO: {
      label: "Concluído",
      className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    },
  };
  return (
    map[normalized] || {
      label: normalized,
      className: "bg-slate-500/10 text-slate-200 border-slate-500/20",
    }
  );
};

const getPriorityBadge = (priority?: string | null) => {
  const normalized = String(priority || "MEDIA").toUpperCase();
  const map: Record<string, { label: string; className: string }> = {
    BAIXA: {
      label: "Baixa",
      className: "bg-slate-500/10 text-slate-200 border-slate-500/20",
    },
    MEDIA: {
      label: "Média",
      className: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
    },
    ALTA: {
      label: "Alta",
      className: "bg-orange-500/10 text-orange-300 border-orange-500/20",
    },
    URGENTE: {
      label: "Urgente",
      className: "bg-red-500/10 text-red-300 border-red-500/20",
    },
  };
  return (
    map[normalized] || {
      label: normalized,
      className: "bg-slate-500/10 text-slate-200 border-slate-500/20",
    }
  );
};

export function ProcessTasks() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TimelineTaskItem[]>([]);
  const [summary, setSummary] = useState<TasksResponse["summary"]>({
    myOpen: 0,
    myOverdue: 0,
    openTotal: 0,
    overdueTotal: 0,
  });

  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"mine" | "all" | "unassigned">("mine");
  const [status, setStatus] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [includeCompleted, setIncludeCompleted] = useState(false);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params: any = {
        scope,
        overdue: overdueOnly ? "true" : "false",
        includeCompleted: includeCompleted ? "true" : "false",
      };
      if (search.trim()) params.q = search.trim();
      if (status) params.status = status;
      if (category) params.category = category;

      const res = await api.get<TasksResponse>("/processes/timelines/tasks", {
        params,
      });
      setItems(Array.isArray(res.data.items) ? res.data.items : []);
      if (res.data.summary) setSummary(res.data.summary);
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao carregar andamentos/tarefas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      fetchTasks();
    }, 250);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, status, category, overdueOnly, includeCompleted, search]);

  const handleOpenProcess = (processId: string) => {
    navigate(`/processes/${processId}`);
  };

  const patchTimeline = async (
    processId: string,
    timelineId: string,
    payload: Record<string, string>,
  ) => {
    const data = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).length > 0) {
        data.append(k, String(v));
      }
    });

    await api.patch(`/processes/${processId}/timelines/${timelineId}`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  };

  const handleConclude = async (item: TimelineTaskItem) => {
    try {
      await patchTimeline(item.processId, item.id, { status: "CONCLUIDO" });
      toast.success("Tarefa concluída");
      await fetchTasks();
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao concluir tarefa");
    }
  };

  const handleAssume = async (item: TimelineTaskItem) => {
    const email = getCurrentUserEmail();
    if (!email) {
      toast.error("Usuário não encontrado. Faça login novamente.");
      return;
    }
    try {
      await patchTimeline(item.processId, item.id, {
        responsibleName: email,
        status: item.status && item.status !== "CONCLUIDO" ? String(item.status) : "PENDENTE",
      });
      toast.success("Tarefa atribuída a você");
      await fetchTasks();
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao assumir tarefa");
    }
  };

  const columns = [
    {
      key: "process",
      label: "Processo",
      sortable: true,
      render: (item: TimelineTaskItem) => (
        <div className="space-y-1">
          <div className="text-white font-semibold leading-tight">
            {item.process?.code || item.process?.cnj || "Processo"}
          </div>
          <div className="text-xs text-slate-400 line-clamp-2">
            {item.process?.title || "-"}
          </div>
        </div>
      ),
    },
    {
      key: "title",
      label: "Andamento / Tarefa",
      sortable: true,
      render: (item: TimelineTaskItem) => (
        <div className="space-y-1">
          <div className="text-white font-semibold leading-tight">{item.title}</div>
          {item.description ? (
            <div className="text-xs text-slate-400 line-clamp-2">
              {item.description}
            </div>
          ) : (
            <div className="text-xs text-slate-500">Sem descrição</div>
          )}
        </div>
      ),
    },
    {
      key: "dueAt",
      label: "Prazos",
      sortable: true,
      render: (item: TimelineTaskItem) => {
        const due = item.dueAt || item.fatalDate || item.internalDate || null;
        return (
          <div className="space-y-1">
            <div className="text-xs text-slate-400">
              Lançado: <span className="text-slate-200">{formatDateDisplay(item.date)}</span>
            </div>
            <div className="text-xs">
              <span className="text-slate-400">Prazo:</span>{" "}
              <span
                className={clsx(
                  "font-semibold",
                  item.isOverdue ? "text-red-300" : "text-slate-200",
                )}
              >
                {formatDateDisplay(due)}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (item: TimelineTaskItem) => {
        const statusBadge = getStatusBadge(item.status);
        const priorityBadge = getPriorityBadge(item.priority);
        return (
          <div className="flex flex-col gap-2">
            <span
              className={clsx(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border w-fit",
                statusBadge.className,
              )}
            >
              {statusBadge.label}
            </span>
            <span
              className={clsx(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border w-fit",
                priorityBadge.className,
              )}
            >
              {priorityBadge.label}
            </span>
          </div>
        );
      },
    },
    {
      key: "responsibleName",
      label: "Responsável",
      sortable: true,
      render: (item: TimelineTaskItem) => (
        <div className="text-sm text-white">
          <div className="flex items-center gap-2">
            <User size={14} className="text-slate-400" />
            <span className="truncate max-w-[220px]">
              {item.responsibleName || "Não atribuído"}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Ações",
      render: (item: TimelineTaskItem) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenProcess(item.processId);
            }}
            className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            title="Abrir processo"
          >
            <ExternalLink size={14} />
          </button>

          {!item.responsibleName && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAssume(item);
              }}
              className="px-2 py-1 rounded-md bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-200 border border-indigo-600/30 transition-colors"
              title="Assumir"
            >
              <User size={14} />
            </button>
          )}

          {String(item.status || "").toUpperCase() !== "CONCLUIDO" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleConclude(item);
              }}
              className="px-2 py-1 rounded-md bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-200 border border-emerald-600/30 transition-colors"
              title="Concluir"
            >
              <CheckCircle2 size={14} />
            </button>
          )}

          {item.isOverdue && (
            <span
              className="px-2 py-1 rounded-md bg-red-600/10 text-red-200 border border-red-600/20"
              title="Em atraso"
            >
              <AlertTriangle size={14} />
            </span>
          )}
        </div>
      ),
    },
  ];

  const cards = [
    {
      id: "mine",
      title: "Meus (abertos)",
      value: summary.myOpen,
      hint: "Ações atribuídas a você",
      active: scope === "mine" && !overdueOnly && !includeCompleted,
      onClick: () => {
        setScope("mine");
        setOverdueOnly(false);
        setIncludeCompleted(false);
        setStatus("");
      },
    },
    {
      id: "mine-overdue",
      title: "Meus (em atraso)",
      value: summary.myOverdue,
      hint: "Prazos vencidos",
      active: scope === "mine" && overdueOnly,
      onClick: () => {
        setScope("mine");
        setOverdueOnly(true);
        setIncludeCompleted(false);
        setStatus("");
      },
    },
    {
      id: "open-total",
      title: "Pendentes (geral)",
      value: summary.openTotal,
      hint: "Todos os abertos",
      active: scope === "all" && !overdueOnly && !includeCompleted,
      onClick: () => {
        setScope("all");
        setOverdueOnly(false);
        setIncludeCompleted(false);
        setStatus("");
      },
    },
    {
      id: "overdue-total",
      title: "Em atraso (geral)",
      value: summary.overdueTotal,
      hint: "Prazos vencidos",
      active: scope === "all" && overdueOnly,
      onClick: () => {
        setScope("all");
        setOverdueOnly(true);
        setIncludeCompleted(false);
        setStatus("");
      },
    },
  ];

  const displayedCount = items.length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Andamentos / Tarefas</h1>
          <p className="text-slate-400 mt-1">
            Visualize e execute seus andamentos sem entrar em cada processo.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchTasks}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors border border-slate-700"
        >
          <Filter size={18} />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={card.onClick}
            className={clsx(
              "p-4 rounded-xl border text-left transition-colors",
              card.active
                ? "bg-indigo-600/10 border-indigo-500/30"
                : "bg-slate-900 border-slate-800 hover:bg-slate-800/40",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="text-slate-300 font-semibold">{card.title}</div>
              <div className="text-white text-xl font-bold">{card.value}</div>
            </div>
            <div className="text-xs text-slate-500 mt-1">{card.hint}</div>
          </button>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          <div className="flex-1 flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
            <Search size={18} className="text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por processo, título, descrição, responsável..."
              className="flex-1 bg-transparent outline-none text-white placeholder:text-slate-600"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as any)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
            >
              <option value="mine">Meus</option>
              <option value="all">Todos</option>
              <option value="unassigned">Sem responsável</option>
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
            >
              <option value="">Status (todos)</option>
              <option value="PENDENTE">Pendente</option>
              <option value="EM_TRATAMENTO">Em tratamento</option>
              <option value="CONCLUIDO">Concluído</option>
            </select>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
            >
              <option value="">Categoria (todas)</option>
              <option value="ACAO">Ação</option>
              <option value="AGENDA">Agenda</option>
              <option value="REGISTRO">Registro</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500/20"
            />
            Em atraso
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500/20"
            />
            Incluir concluídos
          </label>
          <div className="ml-auto text-slate-500">
            {loading ? "Carregando..." : `${displayedCount} item(ns)`}
          </div>
        </div>
      </div>

      <div className="h-[62vh]">
        <DataGrid
          data={items}
          columns={columns as any}
          isLoading={loading}
          pageSize={20}
          onRowDoubleClick={(item) => handleOpenProcess(item.processId)}
        />
      </div>
    </div>
  );
}
