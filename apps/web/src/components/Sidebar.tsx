import { NavLink, useLocation } from 'react-router-dom';
import { SYSTEM_MODULES } from '../config/modules';
import { clsx } from 'clsx';
import { X, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState } from 'react';
import { getUser } from '../auth/authStorage';

interface SidebarProps {
  isOpen: boolean;
  closeSidebar: () => void;
  isCollapsed: boolean;
  toggleCollapsed: () => void;
}

export function Sidebar({ isOpen, closeSidebar, isCollapsed, toggleCollapsed }: SidebarProps) {
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  const toggleMenu = (id: string) => {
    setOpenMenus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside
      className={clsx(
        'w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-screen fixed left-0 top-0 z-50 transition-all duration-300 ease-in-out',
        isCollapsed ? 'lg:w-16' : 'lg:w-64',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}
    >
      <div
        className={clsx(
          'relative p-5 lg:p-6 flex items-center justify-between gap-3 border-b border-slate-800',
          isCollapsed && 'lg:px-3 lg:justify-center',
        )}
      >
        <div className={clsx('flex items-center gap-3', isCollapsed && 'lg:gap-0')}>
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white text-xl">
            X
          </div>
          <div className={clsx(isCollapsed && 'lg:hidden')}>
            <h1 className="text-white font-bold text-lg leading-tight">Dr.X</h1>
            <p className="text-slate-500 text-xs hidden sm:block">Inteligência Jurídica</p>
          </div>
        </div>

        <button
          onClick={closeSidebar}
          className="lg:hidden p-2 -mr-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          aria-label="Fechar menu"
        >
          <X size={20} />
        </button>

        <button
          onClick={toggleCollapsed}
          className="hidden lg:flex items-center justify-center p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors absolute right-2 top-1/2 -translate-y-1/2"
          title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
          aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav
        className={clsx(
          'flex-1 p-3 lg:p-4 space-y-1.5 lg:space-y-2 overflow-y-auto custom-scrollbar',
          isCollapsed && 'lg:px-2',
        )}
      >
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
        }).map(item => {
          const isItemActive = location.pathname.startsWith(item.to);
          const hasSubItems = !!item.subItems && item.subItems.length > 0;
          const isMenuOpen = !isCollapsed && (openMenus[item.id] || isItemActive);

          return (
            <div key={item.to} className={clsx('flex flex-col', isCollapsed && 'relative group')}>
              <NavLink
                to={item.to}
                onClick={() => closeSidebar()}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center rounded-lg text-sm font-medium transition-all duration-200 relative',
                    isCollapsed ? 'justify-center px-2 py-2.5 lg:py-3' : 'justify-between px-3 py-2.5 lg:px-4 lg:py-3',
                    (hasSubItems ? isItemActive : isActive)
                      ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                  )
                }
                aria-label={item.label}
              >
                <div className={clsx('flex items-center', isCollapsed ? 'justify-center' : 'gap-3')}>
                  <item.icon size={20} className={clsx(!isItemActive && 'opacity-80')} />
                  {!isCollapsed && item.label}
                </div>

                {!isCollapsed && hasSubItems && (
                  <button
                    type="button"
                    onClick={ev => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      toggleMenu(item.id);
                    }}
                    className="text-slate-500 hover:text-slate-200 transition-colors p-1 -mr-1 rounded-md hover:bg-slate-800/60"
                    aria-label={isMenuOpen ? 'Fechar submenu' : 'Abrir submenu'}
                  >
                    {isMenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                )}

                {isCollapsed && (
                  <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50">
                    <div className="bg-slate-900 border border-slate-700 text-slate-100 shadow-xl rounded-md px-3 py-2 text-xs whitespace-nowrap">
                      {item.label}
                    </div>
                  </div>
                )}
              </NavLink>

              {hasSubItems && !isCollapsed && isMenuOpen && (
                <div className="mt-1 flex flex-col space-y-1 pl-10">
                  {item.subItems!.map(sub => (
                    <NavLink
                      key={sub.to}
                      to={sub.to}
                      onClick={closeSidebar}
                      className={({ isActive }) =>
                        clsx(
                          'block px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                          isActive ? 'text-indigo-400 bg-indigo-600/5' : 'text-slate-400 hover:text-white hover:bg-slate-800/50',
                        )
                      }
                    >
                      {sub.label}
                    </NavLink>
                  ))}
                </div>
              )}

              {hasSubItems && isCollapsed && (
                <div className="pointer-events-none opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 absolute left-full top-0 ml-3 z-50 w-64">
                  <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-lg overflow-hidden">
                    <div className="px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-900/60 border-b border-slate-700">
                      {item.label}
                    </div>
                    <div className="p-2 space-y-1">
                      {item.subItems!.map(sub => (
                        <NavLink
                          key={sub.to}
                          to={sub.to}
                          onClick={closeSidebar}
                          className={({ isActive }) =>
                            clsx(
                              'block px-3 py-2 rounded-md text-sm font-medium transition-colors',
                              isActive ? 'text-indigo-300 bg-indigo-600/10' : 'text-slate-300 hover:text-white hover:bg-slate-800/60',
                            )
                          }
                        >
                          {sub.label}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div
          className={clsx(
            'relative flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-800',
            isCollapsed && 'lg:justify-center lg:px-2 group',
          )}
        >
          <div className="w-8 h-8 flex-shrink-0 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs uppercase">
            {(() => {
              const u = getUser();
              if (u) return u.name ? u.name.substring(0, 2) : 'OP';
              return 'OP';
            })()}
          </div>
          <div className={clsx('overflow-hidden', isCollapsed && 'lg:hidden')}>
            <p className="text-sm font-medium text-white truncate">
              {(() => {
                const u = getUser();
                if (u) return u.name || 'Operador';
                return 'Operador';
              })()}
            </p>
            <p className="text-xs text-slate-500 truncate">Online</p>
          </div>

          {isCollapsed && (
            <div className="hidden lg:block pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute left-full bottom-6 ml-3 z-50">
              <div className="bg-slate-900 border border-slate-700 text-slate-100 shadow-xl rounded-md px-3 py-2 text-xs whitespace-nowrap">
                {(() => {
                  const u = getUser();
                  return u?.name || u?.email || 'Operador';
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
