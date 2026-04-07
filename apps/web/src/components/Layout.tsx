import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Building2, Clock, LogOut, Menu, User, Sun, Moon, Monitor, PanelLeftClose, PanelLeftOpen, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { getAuthPersistence, getUser, logoutLocal, setUser as authSetUser } from '../auth/authStorage';
import { useIdleLogout } from '../hooks/useIdleLogout';
import { applyThemePreference, getStoredThemePreference, setStoredThemePreference, type ThemePreference } from '../utils/theme';
import { api, getApiUrl } from '../services/api';
import { InventoryHelpModal } from './inventory/InventoryHelpModal';
import { Sidebar } from './Sidebar';
import { getModuleIdFromPath } from '../utils/userPreferences';
import { useSigilo } from '../contexts/SigiloContext';
import { SigiloAuthModal } from './SigiloAuthModal';

declare const __APP_VERSION__: string;

const StatusBar = ({
  toggleSidebar,
  isSidebarCollapsed,
  toggleSidebarCollapsed,
}: {
  toggleSidebar: () => void;
  isSidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;
}) => {
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  const [user, setUser] = useState<any>(null);
  const [runtimeVersion, setRuntimeVersion] = useState<any>(null);
  const { isSigiloActive, timeLeft } = useSigilo();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);

    const stored = getUser();
    if (stored) setUser(stored);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadVersion = async () => {
      try {
        const response = await fetch(getApiUrl('/version'));
        if (!response.ok) return;

        const payload = await response.json();
        if (!cancelled) {
          setRuntimeVersion(payload);
        }
      } catch (error) {
        console.error('Erro ao carregar versao publicada:', error);
      }
    };

    loadVersion();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    logoutLocal();
    navigate('/login');
  };

  const handleThemeToggle = async () => {
    if (!user) return;
    
    const currentTheme = user.theme || 'DARK';
    const themes: ThemePreference[] = ['LIGHT', 'DARK', 'SYSTEM'];
    const nextTheme = themes[(themes.indexOf(currentTheme as any) + 1) % themes.length];

    // Optimistic Update
    const updatedUser = { ...user, theme: nextTheme };
    authSetUser(updatedUser, getAuthPersistence());
    setStoredThemePreference(nextTheme);
    applyThemePreference(nextTheme);
    setUser(updatedUser); // Update local state (useState setter)

    try {
        await api.patch('/users/me/preferences', { theme: nextTheme });
    } catch (err) {
        console.error("Erro ao persistir tema:", err);
    }
  };

  const formatTimeLeft = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const displayedVersion = runtimeVersion?.displayVersion || __APP_VERSION__;
  const displayedReleaseCounter = runtimeVersion?.displayReleaseCounter ?? null;
  const displayedVersionText =
    displayedReleaseCounter !== null && displayedReleaseCounter !== undefined
      ? `${displayedVersion} #${displayedReleaseCounter}`
      : displayedVersion;

  if (!user) return null;

  return (
    <div
      className={clsx(
        'h-10 lg:h-8 bg-emerald-950/30 border-b border-emerald-500/30 flex items-center justify-between lg:justify-end px-4 lg:px-6 text-xs text-emerald-100/80 gap-3 lg:gap-6 fixed top-0 right-0 left-0 z-10 shadow-sm backdrop-blur-sm',
        isSidebarCollapsed ? 'lg:left-16' : 'lg:left-64',
      )}
    >
      <button
        onClick={toggleSidebar}
        className="lg:hidden p-1.5 -ml-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-md transition-colors"
      >
        <Menu size={18} />
      </button>

      <button
        onClick={toggleSidebarCollapsed}
        className="hidden lg:flex items-center justify-center p-1.5 -ml-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-md transition-colors"
        title={isSidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
        aria-label={isSidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
      >
        {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>

      {isSigiloActive && (
        <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full animate-pulse">
          <ShieldCheck size={14} className="text-red-400" />
          <span className="text-red-200 font-bold tracking-tighter">SIGILO ATIVO: {formatTimeLeft(timeLeft)}</span>
        </div>
      )}

      <div className="hidden md:flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium tracking-wide text-emerald-200">
        <span className="text-emerald-400/80">Versao</span>
        <span className="text-white">{displayedVersionText}</span>
      </div>

      <div className="flex items-center gap-2 lg:gap-6 ml-auto">
        <div className="hidden sm:flex items-center gap-2">
          <Building2 size={12} className="text-emerald-400" />
          <span className="font-medium text-emerald-100 truncate max-w-[120px] lg:max-w-none">
            {user.tenant?.name || user.tenantId || 'Empresa ???'}
          </span>
        </div>
        <div className="hidden sm:block w-px h-3 bg-emerald-800/50"></div>
        <div className="flex items-center gap-1.5 lg:gap-2">
          <User size={12} className="text-emerald-400" />
          <span className="truncate max-w-[100px] lg:max-w-none">
            {user.name || user.email}
          </span>
        </div>
        <div className="hidden md:block w-px h-3 bg-emerald-800/50"></div>
        <div className="hidden md:flex items-center gap-2 min-w-[125px]">
          <Clock size={12} className="text-emerald-500" />
          <span>
            {time.toLocaleDateString('pt-BR')} - {time.toLocaleTimeString('pt-BR')}
          </span>
        </div>
        <div className="hidden md:block w-px h-3 bg-emerald-800/50"></div>
        <button
          onClick={handleThemeToggle}
          className="flex items-center justify-center p-1.5 rounded-md hover:bg-emerald-500/10 text-emerald-400 transition-colors"
          title="Trocar tema"
        >
          {(!user.theme || user.theme === 'DARK') && <Moon size={14} />}
          {user.theme === 'LIGHT' && <Sun size={14} />}
          {user.theme === 'SYSTEM' && <Monitor size={14} />}
        </button>
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    const stored = getUser();
    return Boolean(stored?.sidebarCollapsed);
  });
  const navigate = useNavigate();
  const location = useLocation();
  const lastModulePersistedRef = useRef<string | null>(null);

  useIdleLogout({
    timeoutMs: 5 * 60 * 1000,
    onIdle: () => {
      logoutLocal();
      navigate('/login', {
        replace: true,
        state: { message: 'Sessão encerrada por inatividade (5 minutos).' },
      });
    },
  });

  useEffect(() => {
    const apply = () => {
      const stored = getUser();
      const preference = ((stored?.theme as ThemePreference) || getStoredThemePreference() || 'DARK') as ThemePreference;
      applyThemePreference(preference);
      setIsSidebarCollapsed(Boolean(stored?.sidebarCollapsed));
    };

    apply();
    const onStorage = () => apply();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const stored = getUser();
    if (!stored) return;

    const moduleId = getModuleIdFromPath(location.pathname);
    if (!moduleId) return;

    if (lastModulePersistedRef.current === moduleId) return;
    lastModulePersistedRef.current = moduleId;

    if (stored.lastModuleId === moduleId) return;

    const updatedUser = { ...stored, lastModuleId: moduleId };
    authSetUser(updatedUser, getAuthPersistence());

    api.patch('/users/me/preferences', { lastModuleId: moduleId }).catch((err) => {
      console.error('Erro ao persistir lastModuleId:', err);
    });
  }, [location.pathname]);

  const toggleSidebarCollapsed = async () => {
    const stored = getUser();
    if (!stored) return;

    const nextCollapsed = !Boolean(stored.sidebarCollapsed);

    const updatedUser = { ...stored, sidebarCollapsed: nextCollapsed };
    authSetUser(updatedUser, getAuthPersistence());
    setIsSidebarCollapsed(nextCollapsed);

    try {
      await api.patch('/users/me/preferences', { sidebarCollapsed: nextCollapsed });
    } catch (err) {
      console.error('Erro ao persistir sidebarCollapsed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-[Inter] overflow-x-hidden transition-colors duration-300">
      <Sidebar
        isOpen={isSidebarOpen}
        closeSidebar={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        toggleCollapsed={toggleSidebarCollapsed}
      />

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <main
        className={clsx(
          'min-h-screen transition-all duration-300 pt-10 lg:pt-8 w-full flex flex-col',
          isSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64',
        )}
      >
        <StatusBar
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarCollapsed={isSidebarCollapsed}
          toggleSidebarCollapsed={toggleSidebarCollapsed}
        />
        <div className="w-full flex-1 p-0">
          <Outlet />
        </div>
      </main>

      <InventoryHelpModal />
      <SigiloAuthModal />
    </div>
  );
}
