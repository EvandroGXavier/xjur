export const themeColor = {
  white: 'rgb(255, 255, 255)',
  black: 'rgb(2, 6, 23)',
  slate700: 'rgb(var(--color-slate-700))',
  slate800: 'rgb(var(--color-slate-800))',
  slate900: 'rgb(var(--color-slate-900))',
  slate950: 'rgb(var(--color-slate-950))',
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

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function formatRgb(rgb: number[]) {
  return `rgb(${clampByte(rgb[0])}, ${clampByte(rgb[1])}, ${clampByte(rgb[2])})`;
}

function srgbToLinear(channel: number) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function getRelativeLuminance(rgb: number[]) {
  const [r, g, b] = rgb.map(srgbToLinear);
  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}

function getContrastRatio(foreground: number[], background: number[]) {
  const lighter = Math.max(getRelativeLuminance(foreground), getRelativeLuminance(background));
  const darker = Math.min(getRelativeLuminance(foreground), getRelativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function mixRgb(source: number[], target: number[], amount: number) {
  const ratio = Math.max(0, Math.min(1, amount));
  return source.map((value, index) => value + ((target[index] ?? value) - value) * ratio);
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

export function getReadableAccentColor(
  color?: string | null,
  options?: {
    against?: string | null;
    fallback?: string;
    minContrast?: number;
    maxMix?: number;
  },
) {
  const fallback = options?.fallback || defaultTagColor;
  const resolved = resolveCssColor(color, fallback);
  const rgb = extractRgb(resolved);
  if (!rgb) return resolved;

  const surfaceResolved = resolveCssColor(options?.against, themeColor.white);
  const surfaceRgb = extractRgb(surfaceResolved) || [255, 255, 255];
  const minimumContrast = options?.minContrast ?? 4.7;
  if (getContrastRatio(rgb, surfaceRgb) >= minimumContrast) {
    return resolved;
  }

  const surfaceIsLight = getRelativeLuminance(surfaceRgb) >= 0.45;
  const targetResolved = surfaceIsLight
    ? resolveCssColor(themeColor.slate800, themeColor.black)
    : resolveCssColor(themeColor.white, themeColor.white);
  const targetRgb = extractRgb(targetResolved) || (surfaceIsLight ? [15, 23, 42] : [255, 255, 255]);
  const maxMix = Math.max(0.2, Math.min(0.96, options?.maxMix ?? 0.88));

  let fallbackCandidate = rgb;
  for (let step = 1; step <= 14; step += 1) {
    const amount = (step / 14) * maxMix;
    const candidate = mixRgb(rgb, targetRgb, amount);
    fallbackCandidate = candidate;
    if (getContrastRatio(candidate, surfaceRgb) >= minimumContrast) {
      return formatRgb(candidate);
    }
  }

  return formatRgb(fallbackCandidate);
}

export function getAccentUiStyles(
  color?: string | null,
  options?: {
    backgroundAlpha?: number;
    borderAlpha?: number;
    surfaceColor?: string | null;
    fallback?: string;
    minContrast?: number;
  },
) {
  const fallback = options?.fallback || defaultTagColor;
  const accentColor = String(color || '').trim() || fallback;

  return {
    backgroundColor: withAlpha(accentColor, options?.backgroundAlpha ?? 0.14, fallback),
    borderColor: withAlpha(accentColor, options?.borderAlpha ?? 0.34, fallback),
    color: getReadableAccentColor(accentColor, {
      against: options?.surfaceColor,
      fallback,
      minContrast: options?.minContrast,
    }),
  };
}
