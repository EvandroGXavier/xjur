import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { User, Building2, Clock, LogOut, Menu } from 'lucide-react';

const StatusBar = ({ toggleSidebar }: { toggleSidebar: () => void }) => {
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Relógio
    const timer = setInterval(() => setTime(new Date()), 1000);
    
    // User Info (Carregar apenas uma vez)
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
        try {
            setUser(JSON.parse(storedUser));
        } catch (e) {
            console.error(e);
        }
    }

    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className="h-10 lg:h-8 bg-emerald-950/30 border-b border-emerald-500/30 flex items-center justify-between lg:justify-end px-4 lg:px-6 text-xs text-emerald-100/80 gap-3 lg:gap-6 fixed top-0 right-0 left-0 lg:left-64 z-10 shadow-sm backdrop-blur-sm">
        <button 
            onClick={toggleSidebar} 
            className="lg:hidden p-1.5 -ml-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-md transition-colors"
        >
            <Menu size={18} />
        </button>

        <div className="flex items-center gap-2 lg:gap-6 ml-auto">
            <div className="hidden sm:flex items-center gap-2">
                <Building2 size={12} className="text-emerald-400" />
                <span className="font-medium text-emerald-100 truncate max-w-[120px] lg:max-w-none">{user.tenant?.name || user.tenantId || 'Empresa ???'}</span>
            </div>
            <div className="hidden sm:block w-px h-3 bg-emerald-800/50"></div>
            <div className="flex items-center gap-1.5 lg:gap-2">
                <User size={12} className="text-emerald-400" />
                <span className="truncate max-w-[100px] lg:max-w-none">{user.name || user.email}</span>
            </div>
            <div className="hidden md:block w-px h-3 bg-emerald-800/50"></div>
            <div className="hidden md:flex items-center gap-2 min-w-[125px]">
                <Clock size={12} className="text-emerald-500" />
                <span>
                    {time.toLocaleDateString('pt-BR')} - {time.toLocaleTimeString('pt-BR')}
                </span>
            </div>
            <div className="w-px h-3 bg-emerald-800/50"></div>
            <button 
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-red-500 hover:text-red-400 transition-colors font-medium bg-red-500/10 px-2 py-1 lg:py-0.5 rounded hover:bg-red-500/20"
                title="Sair do sistema"
            >
                <LogOut size={12} />
                <span className="hidden sm:inline">Sair</span>
            </button>
        </div>
    </div>
  );
};

export function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-[Inter] overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} closeSidebar={() => setIsSidebarOpen(false)} />
      
      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <main className="lg:pl-64 min-h-screen transition-all duration-300 pt-10 lg:pt-8 w-full flex flex-col">
        <StatusBar toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        <div className="p-3 sm:p-4 lg:p-8 max-w-7xl mx-auto w-full flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
