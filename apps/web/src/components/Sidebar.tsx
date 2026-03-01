import { NavLink, useLocation } from 'react-router-dom';
import { SYSTEM_MODULES } from '../config/modules';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  closeSidebar: () => void;
}

export function Sidebar({ isOpen, closeSidebar }: SidebarProps) {
  const location = useLocation();
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
        {SYSTEM_MODULES.filter(item => {
           try {
             const userStr = localStorage.getItem('user');
             if (!userStr) return false;
             const user = JSON.parse(userStr);
             if (user.role === 'OWNER') return true;
             
             // Por padrão, se não tem a permissão configurada, libera (ou oculta, escolhemos liberar)
             // Como a instrução diz "QUE ELE NÃO ACESSA, ELE NEM VERÁ", e "QUANDO CRIAR UM NOVO MODULO ELE JA É CRIADO AUTOMATICAMENTE"
             // A gente pode inferir que acesso padrão é liberado a não ser que revogado explicitamente, ou vice-versa.
             // Para garantir que coisas novas apareçam automaticamente: o padrão será true, a menos que permission.access === false.
             const permissions = user.permissions || {};
             if (permissions[item.id] && permissions[item.id].access === false) return false;
             return true;
           } catch {
             return false;
           }
        }).map((item) => (
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
          <div className="w-8 h-8 flex-shrink-0 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs uppercase">
            {(() => {
                const uStr = localStorage.getItem('user');
                if (uStr) {
                    const u = JSON.parse(uStr);
                    return u.name ? u.name.substring(0,2) : 'OP';
                }
                return 'OP';
            })()}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-white truncate">
                {(() => {
                    const uStr = localStorage.getItem('user');
                    if (uStr) {
                        const u = JSON.parse(uStr);
                        return u.name || 'Operador';
                    }
                    return 'Operador';
                })()}
            </p>
            <p className="text-xs text-slate-500 truncate">Online</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
