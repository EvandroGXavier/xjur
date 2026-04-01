import { 
  Briefcase, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  AlertCircle 
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { dashboardChartColors, themeColor } from '../../utils/themeColors';

interface StatsProps {
  id: string;
  data: any;
}

export function StatsWidget({ data }: StatsProps) {
  if (!data) return null;

  const cards = [
    { label: 'Processos Ativos', value: data.counters.activeProcesses, icon: Briefcase, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: 'Compromissos Hoje', value: data.counters.todayAppointments, icon: Calendar, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Financeiro Pendente', value: data.counters.pendingFinancial, icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Receita (Mês)', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.counters.monthlyRevenue), icon: DollarSign, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  ];

  return (
    <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 h-full items-center">
      {cards.map((card, i) => (
        <div key={i} className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <div className={`p-1.5 rounded-lg ${card.bg} ${card.color}`}>
              <card.icon size={18} />
            </div>
            <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">{card.label}</span>
          </div>
          <span className="text-2xl font-bold text-white leading-none">{card.value}</span>
        </div>
      ))}
    </div>
  );
}

export function StatusChartWidget({ id, data }: { id: string, data: any }) {
  if (!data?.statusDistribution) return null;

  return (
    <div className="p-4 h-full flex flex-col">
      <h3 className="text-slate-200 text-sm font-semibold mb-4 flex items-center gap-2">
        <TrendingUp size={16} className="text-indigo-400" />
        Processos por Status
      </h3>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.statusDistribution}>
            <XAxis dataKey="status" hide />
            <YAxis hide />
            <Tooltip 
              contentStyle={{
                backgroundColor: themeColor.slate800,
                border: `1px solid ${themeColor.slate700}`,
                borderRadius: '8px',
              }}
              itemStyle={{ color: themeColor.white }}
            />
            <Bar dataKey="_count._all" radius={[4, 4, 0, 0]}>
              {data.statusDistribution.map((entry: any, index: number) => (
                <Cell
                  key={`cell-${index}`}
                  fill={dashboardChartColors[index % dashboardChartColors.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function FinancialSummaryWidget({ id, data }: { id: string, data: any }) {
  if (!data?.counters) return null;

  const chartData = [
    { name: 'Receita', value: data.counters.monthlyRevenue },
    { name: 'Despesa', value: data.counters.monthlyExpenses },
  ];

  return (
    <div className="p-4 h-full flex flex-col">
       <h3 className="text-slate-200 text-sm font-semibold mb-4 flex items-center gap-2">
        <DollarSign size={16} className="text-emerald-400" />
        Financeiro Mensal
      </h3>
      <div className="flex-1 flex items-center">
         <div className="w-1/2 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill={themeColor.emerald500} />
                  <Cell fill={themeColor.red500} />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
         </div>
         <div className="w-1/2 space-y-3 pl-4">
            <div>
              <p className="text-xs text-slate-400">Receitas Pagas</p>
              <p className="text-lg font-bold text-emerald-400">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.counters.monthlyRevenue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Despesas Pagas</p>
              <p className="text-lg font-bold text-rose-400">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.counters.monthlyExpenses)}
              </p>
            </div>
         </div>
      </div>
    </div>
  );
}
