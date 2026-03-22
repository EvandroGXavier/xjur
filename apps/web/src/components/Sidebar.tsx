import { NavLink, useLocation } from 'react-router-dom';
import { SYSTEM_MODULES } from '../config/modules';
import { clsx } from 'clsx';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { getUser } from '../auth/authStorage';

interface SidebarProps {
  isOpen: boolean;
  closeSidebar: () => void;
}

export function Sidebar({ isOpen, closeSidebar }: SidebarProps) {
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  const toggleMenu = (id: string) => {
    setOpenMenus(prev => ({ ...prev, [id]: !prev[id] }));
  };

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
             const user = getUser();
             if (!user) return false;
             if (user.role === 'OWNER') return true;
             
             const permissions = user.permissions || {};
             if (permissions[item.id] && permissions[item.id].access === false) return false;
             return true;
           } catch {
             return false;
           }
        }).map((item) => {
          const isItemActive = location.pathname.startsWith(item.to);
          const hasSubItems = !!item.subItems && item.subItems.length > 0;
          const isMenuOpen = openMenus[item.id] || isItemActive;

          return (
            <div key={item.to} className="flex flex-col">
              <NavLink
                to={item.to}
                onClick={(e) => {
                  closeSidebar();
                }}
                className={({ isActive }) => clsx(
                  'flex items-center justify-between px-3 py-2.5 lg:px-4 lg:py-3 rounded-lg text-sm font-medium transition-all duration-200',
                  (hasSubItems ? isItemActive : isActive)
                    ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={20} className={clsx(!isItemActive && "opacity-80")} />
                  {item.label}
                </div>
                {hasSubItems && (
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      toggleMenu(item.id);
                    }}
                    className="text-slate-500 hover:text-slate-200 transition-colors p-1 -mr-1 rounded-md hover:bg-slate-800/60"
                    aria-label={isMenuOpen ? "Fechar submenu" : "Abrir submenu"}
                  >
                    {isMenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                )}
              </NavLink>

              {hasSubItems && isMenuOpen && (
                <div className="mt-1 flex flex-col space-y-1 pl-10">
                  {item.subItems!.map(sub => (
                    <NavLink
                      key={sub.to}
                      to={sub.to}
                      onClick={closeSidebar}
                      className={({ isActive }) => clsx(
                        'block px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                        isActive 
                          ? 'text-indigo-400 bg-indigo-600/5' 
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      )}
                    >
                      {sub.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-800">
          <div className="w-8 h-8 flex-shrink-0 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs uppercase">
            {(() => {
                const u = getUser();
                if (u) return u.name ? u.name.substring(0,2) : 'OP';
                return 'OP';
            })()}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-white truncate">
                {(() => {
                    const u = getUser();
                    if (u) return u.name || 'Operador';
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
