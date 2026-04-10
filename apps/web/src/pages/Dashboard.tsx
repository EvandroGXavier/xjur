import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { DashboardGrid } from '../components/dashboard/DashboardGrid';
import { StatsWidget, StatusChartWidget, FinancialSummaryWidget } from '../components/dashboard/Widgets';
import { 
  Bell, 
  Plus, 
  Settings2, 
  RefreshCw, 
  MessageSquare, 
  Briefcase, 
  UserPlus, 
  LayoutGrid
} from 'lucide-react';
import { toast } from 'sonner';

export function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/dashboard/stats');
      setData(res.data);
    } catch (error) {
      console.error('Erro ao carregar dashboard', error);
      toast.error('Não foi possível carregar os dados do painel.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetLayout = () => {
    localStorage.removeItem('drx_dashboard_layouts_v3');
    window.location.reload();
  };




  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6 md:p-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            Dashboard
            <span className="text-xs font-mono bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/30">V2</span>
          </h1>
          <p className="text-slate-400 mt-1 text-sm sm:text-base">Painel dinâmico e configurável da sua operação.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Ações Rápidas */}
          <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 mr-2">
            <button 
              onClick={() => navigate('/atendimento')}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-teal-400 hover:bg-slate-700 hover:text-teal-300 rounded-lg transition-all"
              title="Novo Atendimento"
            >
              <MessageSquare size={18} />
              <span className="hidden xl:inline">Novo Atendimento</span>
            </button>
            <div className="w-px h-6 bg-slate-700 mx-1 self-center"></div>
            <button 
              onClick={() => navigate('/processes/new')}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-emerald-400 hover:bg-slate-700 hover:text-emerald-300 rounded-lg transition-all"
              title="Novo Processo"
            >
              <Briefcase size={18} />
              <span className="hidden xl:inline">Novo Processo</span>
            </button>
            <div className="w-px h-6 bg-slate-700 mx-1 self-center"></div>
            <button 
              onClick={() => navigate('/contacts/new')}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-sky-400 hover:bg-slate-700 hover:text-sky-300 rounded-lg transition-all"
              title="Novo Contato"
            >
              <UserPlus size={18} />
              <span className="hidden xl:inline">Novo Contato</span>
            </button>
          </div>

          <div className="flex items-center gap-2 h-full">
            <button 
              onClick={loadData}
              className="p-2.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition border border-slate-700"
              title="Sincronizar Dados"
            >
              <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
            </button>
            
            <button 
              onClick={handleResetLayout}
              className="p-2.5 rounded-lg bg-slate-800 text-slate-400 hover:text-amber-400 hover:bg-slate-700 transition border border-slate-700"
              title="Resetar Layout"
            >
              <LayoutGrid size={20} />
            </button>

            <button className="p-2.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition border border-slate-700">
              <Settings2 size={20} />
            </button>
            
            <button 
              onClick={() => navigate('/processes/new')}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center gap-2 ring-1 ring-indigo-500/50"
            >
              <Plus size={20} strokeWidth={3} /> <span className="text-sm">NOVO CASO</span>
            </button>
          </div>
        </div>
      </div>


      {isLoading && !data ? (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 animate-pulse">Sincronizando dados reais...</p>
          </div>
        </div>
      ) : (
        <DashboardGrid>
          <StatsWidget id="stats" data={data} />
          <StatusChartWidget id="process_funnel" data={data} />
          <FinancialSummaryWidget id="finance_chart" data={data} />
          
          {/* Placeholder para compromissos ou outras listas se necessário */}
          <div id="appointments" className="p-4 h-full flex flex-col">
            <h3 className="text-slate-200 text-sm font-semibold mb-4 flex items-center gap-2">
              <Bell size={16} className="text-amber-400" />
              Eventos Recentes
            </h3>
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs border border-dashed border-slate-700 rounded-lg">
              Nenhuma atividade importante agora.
            </div>
          </div>
        </DashboardGrid>
      )}
    </div>
  );
}
