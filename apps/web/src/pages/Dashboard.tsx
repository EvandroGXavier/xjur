import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { DashboardGrid } from '../components/dashboard/DashboardGrid';
import { StatsWidget, StatusChartWidget, FinancialSummaryWidget } from '../components/dashboard/Widgets';
import { Bell, Plus, Settings2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            Dashboard
            <span className="text-xs font-mono bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/30">V2</span>
          </h1>
          <p className="text-slate-400 mt-1 text-sm sm:text-base">Painel dinâmico e configurável da sua operação.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button 
            onClick={loadData}
            className="p-2 flex-shrink-0 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
            title="Atualizar"
          >
            <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button className="p-2 flex-shrink-0 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition">
            <Settings2 size={20} />
          </button>
          <button className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition shadow-lg shadow-indigo-500/20 text-center flex items-center justify-center gap-2">
            <Plus size={20} /> Novo Caso
          </button>
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
