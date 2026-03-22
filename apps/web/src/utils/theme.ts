export type ThemePreference = 'DARK' | 'LIGHT' | 'SYSTEM';

const THEME_KEY = 'theme_preference';

export function getStoredThemePreference(): ThemePreference | null {
  const raw = (localStorage.getItem(THEME_KEY) || '').trim().toUpperCase();
  if (raw === 'DARK' || raw === 'LIGHT' || raw === 'SYSTEM') return raw as ThemePreference;
  return null;
}

export function setStoredThemePreference(preference: ThemePreference) {
  localStorage.setItem(THEME_KEY, preference);
}

export function resolveThemePreference(preference: ThemePreference) {
  if (preference === 'SYSTEM') {
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
    return prefersDark ? 'DARK' : 'LIGHT';
  }
  return preference;
}

export function applyThemePreference(preference: ThemePreference) {
  const resolved = resolveThemePreference(preference);
  const html = document.documentElement;

  if (resolved === 'LIGHT') {
    html.classList.add('light');
  } else {
    html.classList.remove('light');
  }

  // Optional (helps future Tailwind darkMode if enabled)
  if (resolved === 'DARK') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
}
