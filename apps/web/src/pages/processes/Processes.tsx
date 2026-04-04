import { useState } from "react";
import { 
  Scale, 
  Activity,
  Settings
} from "lucide-react";
import { clsx } from "clsx";
import { ProcessList } from "./ProcessList";
import { ProcessTasks } from "./ProcessTasks";
import { useNavigate } from "react-router-dom";

export function Processes() {
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "tasks">("list");

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header com Abas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600/20 rounded-lg flex items-center justify-center text-indigo-400 border border-indigo-600/30">
            <Scale size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Processos</h1>
            <p className="text-slate-500 text-xs">Gestão jurídica e andamentos</p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 w-full md:w-auto overflow-x-auto no-scrollbar">
          <button
            onClick={() => setView("list")}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap",
              view === "list"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
          >
            <Scale size={16} />
            Processos
          </button>
          <button
            onClick={() => setView("tasks")}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap",
              view === "tasks"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
          >
            <Activity size={16} />
            Andamentos/Tarefas
          </button>
        </div>

        <button 
            onClick={() => navigate('/processes/config')} 
            className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition hidden md:flex" 
            title="Configurações de Processos"
        >
            <Settings size={20} />
        </button>
      </div>

      {/* Conteúdo Dinâmico */}
      <div className="flex-1 overflow-y-auto">
        {view === "list" && <ProcessList />}
        {view === "tasks" && (
            <div className="p-6 md:p-10 animate-in fade-in slide-in-from-bottom-3 duration-500">
                <ProcessTasks />
            </div>
        )}
      </div>
    </div>
  );
}
