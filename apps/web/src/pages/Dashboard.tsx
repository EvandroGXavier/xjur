
"teste de DEPLOY"
import { ArrowRight, Bell, Calendar, TrendingUp } from 'lucide-react';

export function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-slate-400 mt-1">Visão geral da sua operação jurídica.</p>
        </div>
        <div className="flex gap-3">
          <button className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition">
            <Bell size={20} />
          </button>
          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition shadow-lg shadow-indigo-500/20">
            Novo Caso
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 hover:border-indigo-500/50 transition-colors group">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg group-hover:bg-indigo-500/20 transition">
              <Bell size={24} />
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-800 text-slate-300">Hoje</span>
          </div>
          <h3 className="text-slate-400 text-sm font-medium">Atendimentos Pendentes</h3>
          <p className="text-3xl font-bold text-white mt-1">0</p>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 hover:border-emerald-500/50 transition-colors group">
           <div className="flex items-start justify-between mb-4">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:bg-emerald-500/20 transition">
              <TrendingUp size={24} />
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-800 text-slate-300">Ativos</span>
          </div>
          <h3 className="text-slate-400 text-sm font-medium">Processos em Andamento</h3>
          <p className="text-3xl font-bold text-white mt-1">3</p>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 hover:border-amber-500/50 transition-colors group">
            <div className="flex items-start justify-between mb-4">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg group-hover:bg-amber-500/20 transition">
              <Calendar size={24} />
            </div>
             <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-800 text-slate-300">Mês</span>
          </div>
          <h3 className="text-slate-400 text-sm font-medium">Faturamento Estimado</h3>
          <p className="text-3xl font-bold text-white mt-1">R$ 0,00</p>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Atividade Recente</h3>
          <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-sm border-2 border-dashed border-slate-800 rounded-lg">
            Nenhuma atividade recente encontrada.
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/20 rounded-xl p-6 relative overflow-hidden">
             <div className="relative z-10">
                <h3 className="text-lg font-semibold text-white mb-2">Assistente IA</h3>
                <p className="text-slate-400 text-sm mb-6 max-w-sm">
                    Sua assistente jurídica está pronta para ajudar na análise de contratos e triagem de clientes.
                </p>
                <button className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-medium text-sm transition group">
                    Iniciar Conversa <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
             </div>
             {/* Decorative blob */}
             <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl"></div>
        </div>
      </div>
    </div>
  );
}
