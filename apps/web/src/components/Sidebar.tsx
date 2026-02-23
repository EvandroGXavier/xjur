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
  Columns,
  X
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

interface SidebarProps {
  isOpen: boolean;
  closeSidebar: () => void;
}

export function Sidebar({ isOpen, closeSidebar }: SidebarProps) {
  return (
    <aside className={clsx(
      "w-72 lg:w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out",
      isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
    )}>
      <div className="p-5 lg:p-6 flex items-center justify-between lg:justify-start gap-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white text-xl">X</div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Dr.X</h1>
            <p className="text-slate-500 text-xs hidden sm:block">Inteligência Jurídica</p>
          </div>
        </div>
        <button 
          onClick={closeSidebar}
          className="lg:hidden p-2 -mr-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 p-3 lg:p-4 space-y-1.5 lg:space-y-2 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={closeSidebar}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 lg:px-4 lg:py-3 rounded-lg text-sm font-medium transition-all duration-200',
              isActive 
                ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            )}
          >
            <item.icon size={20} className={clsx(!location.pathname.startsWith(item.to) && "opacity-80")} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-800">
          <div className="w-8 h-8 flex-shrink-0 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs">
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
