export const themeColor = {
  white: 'rgb(255, 255, 255)',
  black: 'rgb(2, 6, 23)',
  slate700: 'rgb(var(--color-slate-700))',
  slate800: 'rgb(var(--color-slate-800))',
  indigo500: 'rgb(var(--color-indigo-500))',
  emerald500: 'rgb(var(--color-emerald-500))',
  amber500: 'rgb(var(--color-amber-500))',
  red500: 'rgb(var(--color-red-500))',
  violet500: 'rgb(var(--color-violet-500))',
  cyan500: 'rgb(var(--color-cyan-500))',
  orange500: 'rgb(var(--color-orange-500))',
  pink500: 'rgb(var(--color-pink-500))',
  teal500: 'rgb(var(--color-teal-500))',
  sky500: 'rgb(var(--color-sky-500))',
  blue500: 'rgb(var(--color-blue-500))',
  green500: 'rgb(var(--color-green-500))',
  slate500: 'rgb(var(--color-slate-500))',
  magenta500: 'rgb(var(--color-purple-500))',
  rose500: 'rgb(var(--color-rose-500))',
} as const;

export const dashboardChartColors = [
  themeColor.indigo500,
  themeColor.emerald500,
  themeColor.amber500,
  themeColor.red500,
  themeColor.violet500,
] as const;

export const queuePresetColors = [
  themeColor.indigo500,
  themeColor.amber500,
  themeColor.emerald500,
  themeColor.cyan500,
  themeColor.red500,
  themeColor.pink500,
] as const;

export const tagPresetColors = [
  themeColor.indigo500,
  themeColor.violet500,
  themeColor.pink500,
  themeColor.red500,
  themeColor.orange500,
  themeColor.amber500,
  themeColor.green500,
  themeColor.teal500,
  themeColor.cyan500,
  themeColor.blue500,
  themeColor.slate500,
  themeColor.magenta500,
  themeColor.rose500,
  themeColor.sky500,
  themeColor.violet500,
] as const;

export const defaultTagColor = themeColor.indigo500;
export const defaultTagTextColor = themeColor.white;

export const embeddedContentColor = {
  text: 'rgb(51, 65, 85)',
  textStrong: 'rgb(15, 23, 42)',
  textMuted: 'rgb(100, 116, 139)',
  textInverse: 'rgb(203, 213, 225)',
  textInverseMuted: 'rgb(148, 163, 184)',
  border: 'rgb(71, 85, 105)',
  borderSoft: 'rgb(203, 213, 225)',
  borderStrong: 'rgb(51, 65, 85)',
  surface: 'rgb(255, 255, 255)',
  surfaceMuted: 'rgb(248, 250, 252)',
  surfaceSoft: 'rgb(241, 245, 249)',
  surfaceInverse: 'rgba(15, 23, 42, 0.55)',
  accent: 'rgb(99, 102, 241)',
  accentSoft: 'rgba(99, 102, 241, 0.1)',
} as const;

function extractRgb(color: string) {
  const matches = color.match(/\d+(\.\d+)?/g);
  if (!matches || matches.length < 3) return null;

  return matches.slice(0, 3).map((value) => Number(value));
}

export function resolveCssColor(color?: string | null, fallback = defaultTagColor) {
  const input = String(color || '').trim() || fallback;

  if (typeof window === 'undefined' || !document?.body) {
    return input;
  }

  const probe = document.createElement('span');
  probe.style.color = input;
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const computed = window.getComputedStyle(probe).color || fallback;
  document.body.removeChild(probe);
  return computed;
}

export function withAlpha(color?: string | null, alpha = 1, fallback = defaultTagColor) {
  const resolved = resolveCssColor(color, fallback);
  const rgb = extractRgb(resolved);
  if (!rgb) return resolved;
  const normalizedAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${normalizedAlpha})`;
}

export function getContrastTextColor(color?: string | null, fallback = defaultTagColor) {
  const resolved = resolveCssColor(color, fallback);
  const rgb = extractRgb(resolved);
  if (!rgb) return defaultTagTextColor;

  const [r, g, b] = rgb;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.58 ? themeColor.black : defaultTagTextColor;
}
