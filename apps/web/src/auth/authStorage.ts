const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const DEVICE_TOKEN_KEY = 'device_token';

export type AuthPersistence = 'persistent' | 'session';

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function getAuthPersistence(): AuthPersistence {
  return localStorage.getItem(TOKEN_KEY) ? 'persistent' : 'session';
}

export function setToken(token: string, persistence: AuthPersistence) {
  if (persistence === 'persistent') {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
    return;
  }
  sessionStorage.setItem(TOKEN_KEY, token);
  localStorage.removeItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function getUser() {
  const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setUser(user: unknown, persistence: AuthPersistence) {
  const serialized = JSON.stringify(user);
  if (persistence === 'persistent') {
    localStorage.setItem(USER_KEY, serialized);
    sessionStorage.removeItem(USER_KEY);
    return;
  }
  sessionStorage.setItem(USER_KEY, serialized);
  localStorage.removeItem(USER_KEY);
}

export function clearUser() {
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function getDeviceToken() {
  return localStorage.getItem(DEVICE_TOKEN_KEY);
}

export function setDeviceToken(token: string) {
  localStorage.setItem(DEVICE_TOKEN_KEY, token);
}

export function clearDeviceToken() {
  localStorage.removeItem(DEVICE_TOKEN_KEY);
}

export function logoutLocal() {
  clearToken();
  clearUser();
}
