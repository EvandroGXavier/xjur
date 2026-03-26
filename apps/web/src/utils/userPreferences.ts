import { SYSTEM_MODULES } from '../config/modules';

export type StartupModuleMode = 'LAST' | 'HOME';

export function userCanAccessModule(user: any, moduleId: string) {
  if (!user) return false;
  if (user.role === 'OWNER') return true;

  const permissions = user.permissions || {};
  if (permissions[moduleId] && permissions[moduleId].access === false) return false;
  return true;
}

export function resolveModuleTo(moduleId?: string) {
  if (!moduleId) return '/';
  const mod = SYSTEM_MODULES.find(m => m.id === moduleId);
  return mod?.to || '/';
}

export function resolveStartupPath(user: any) {
  const mode = (user?.startupModuleMode || 'LAST') as StartupModuleMode;
  const candidate =
    mode === 'HOME' ? (user?.homeModuleId as string | undefined) : (user?.lastModuleId as string | undefined);

  const preferred = candidate || user?.homeModuleId || 'dashboard';
  if (preferred && userCanAccessModule(user, preferred)) return resolveModuleTo(preferred);

  const fallback = 'dashboard';
  if (userCanAccessModule(user, fallback)) return resolveModuleTo(fallback);

  const firstAllowed = SYSTEM_MODULES.find(m => userCanAccessModule(user, m.id));
  return firstAllowed?.to || '/';
}

export function getModuleIdFromPath(pathname: string) {
  if (!pathname || pathname === '/') return 'dashboard';

  const candidates = SYSTEM_MODULES.filter(m => m.to !== '/').sort((a, b) => b.to.length - a.to.length);
  const found = candidates.find(m => pathname.startsWith(m.to));
  return found?.id || 'dashboard';
}

