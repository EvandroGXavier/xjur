import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { User, Building2, Clock, LogOut } from 'lucide-react';

const StatusBar = () => {
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
    <div className="h-8 bg-slate-900 border-b border-slate-800 flex items-center justify-end px-6 text-xs text-slate-400 gap-6 fixed top-0 right-0 left-64 z-10 shadow-sm">
        <div className="flex items-center gap-2">
            <Building2 size={12} className="text-indigo-400" />
            <span className="font-medium text-slate-300">{user.tenant?.name || user.tenantId || 'Empresa ???'}</span>
        </div>
        <div className="w-px h-3 bg-slate-800"></div>
        <div className="flex items-center gap-2">
            <User size={12} className="text-emerald-400" />
            <span>{user.name || user.email}</span>
        </div>
        <div className="w-px h-3 bg-slate-800"></div>
        <div className="flex items-center gap-2 min-w-[125px]">
            <Clock size={12} className="text-slate-500" />
            <span>
                {time.toLocaleDateString('pt-BR')} - {time.toLocaleTimeString('pt-BR')}
            </span>
        </div>
        <div className="w-px h-3 bg-slate-800"></div>
        <button 
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-slate-400 hover:text-red-400 transition-colors"
            title="Sair do sistema"
        >
            <LogOut size={12} />
            <span className="hidden sm:inline">Sair</span>
        </button>
    </div>
  );
};

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-[Inter]">
      <Sidebar />
      <main className="pl-64 min-h-screen transition-all duration-300 pt-8"> {/* pt-8 para compensar a barra fixa */}
        <StatusBar />
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
