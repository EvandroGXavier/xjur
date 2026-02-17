import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Scale, 
  DollarSign, 
  Users, 
  Bot,
  FileText,
  Settings,
  Package,
  ShieldCheck,
  Calendar,
  Columns
} from 'lucide-react';
import { clsx } from 'clsx';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/' },
  { icon: MessageSquare, label: 'Atendimento', to: '/chat' },
  { icon: Columns, label: 'Kanban', to: '/kanban' },
  { icon: Scale, label: 'Processos', to: '/processes' },
  { icon: Calendar, label: 'Agenda', to: '/agenda' },
  { icon: DollarSign, label: 'Financeiro', to: '/financial' },
  { icon: Package, label: 'Produtos', to: '/products' },
  { icon: Users, label: 'Contatos', to: '/contacts' },
  { icon: FileText, label: 'Biblioteca', to: '/documents' },
  { icon: ShieldCheck, label: 'Equipe', to: '/users' },
  { icon: Bot, label: 'Inteligência Artificial', to: '/ai' },
  { icon: Settings, label: 'Configuração', to: '/settings' },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen fixed left-0 top-0 z-50">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white text-xl">X</div>
        <div>
          <h1 className="text-white font-bold text-lg leading-tight">Dr.X</h1>
          <p className="text-slate-500 text-xs">Inteligência Jurídica</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
              isActive 
                ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            )}
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-800">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs">
            OP
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-white truncate">Operador</p>
            <p className="text-xs text-slate-500 truncate">Online</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
