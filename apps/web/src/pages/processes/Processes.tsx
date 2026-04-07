import { useState, useMemo } from "react";
import { 
  Scale, 
  Activity,
  Settings
} from "lucide-react";
import { ProcessList } from "./ProcessList";
import { ProcessTasks } from "./ProcessTasks";
import { useNavigate } from "react-router-dom";
import { ModuleHeader } from "../../components/ui/ModuleHeader";

type ViewType = "list" | "tasks";

export function Processes() {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewType>("list");

  const tabs = useMemo(() => [
    { id: "list", label: "Processos", icon: Scale },
    { id: "tasks", label: "Andamentos/Tarefas", icon: Activity },
  ], []);

  const actions = (
    <button 
        onClick={() => navigate('/processes/config')} 
        className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition hidden md:flex" 
        title="Configurações de Processos"
    >
        <Settings size={20} />
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col space-y-4">
      <ModuleHeader
        title="Processos"
        subtitle="Gestão jurídica e andamentos"
        icon={Scale}
        iconColorClass="text-sky-400 bg-sky-600/20 border-sky-600/30"
        activeTabColorClass="bg-sky-600 shadow-lg shadow-sky-900/20"
        tabs={tabs}
        activeTab={view}
        onTabChange={(id) => setView(id as ViewType)}
        actions={actions}
      />

      {/* Conteúdo Dinâmico */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {view === "list" && <ProcessList />}
        {view === "tasks" && (
            <div className="h-full min-h-0 p-4 md:p-6 xl:p-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
                <ProcessTasks />
            </div>
        )}
      </div>
    </div>
  );
}
