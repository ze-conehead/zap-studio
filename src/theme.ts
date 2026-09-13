// Colour themes. A theme is an accent colour plus a tint for the greys
// around it, and a light/dark mode that picks which lightness ladder those
// greys climb; every palette below is derived from those numbers, so themes
// of the same mode stay consistent with each other. The choice lives in
// localStorage and is exposed through a useSyncExternalStore pub/sub, like
// the language in src/i18n.ts.

import { useSyncExternalStore } from "react";

export type ThemeId =
  | "lime"
  | "emerald"
  | "cyan"
  | "cobalt"
  | "violet"
  | "magenta"
  | "crimson"
  | "ember"
  | "gold"
  | "graphite"
  | "paper"
  | "sky"
  | "rose";

export type ThemeMode = "dark" | "light";

/** An OKLCH colour as [lightness 0-1, chroma, hue deg]. */
type Oklch = [number, number, number];

export interface Theme {
  id: ThemeId;
  name: string; // English i18n key
  mode: ThemeMode;
  accent: Oklch;
  /** true when the accent is bright enough to need dark text on top. */
  darkOnAccent: boolean;
  /** Hue of the greys (background, cards, borders …). */
  hue: number;
  /** How strongly the greys are tinted. 0 = plain grey, no hue. */
  chroma: number;
}

export const THEMES: Record<ThemeId, Theme> = {
  // The default: lime green on plain dark grey (chroma 0 = no hue at all).
  lime: {
    id: "lime",
    name: "Lime",
    mode: "dark",
    accent: [0.86, 0.21, 130],
    darkOnAccent: true,
    hue: 0,
    chroma: 0,
  },
  emerald: {
    id: "emerald",
    name: "Emerald",
    mode: "dark",
    accent: [0.79, 0.16, 162],
    darkOnAccent: true,
    hue: 165,
    chroma: 0.012,
  },
  cyan: {
    id: "cyan",
    name: "Cyan",
    mode: "dark",
    accent: [0.81, 0.14, 197],
    darkOnAccent: true,
    hue: 210,
    chroma: 0.013,
  },
  cobalt: {
    id: "cobalt",
    name: "Cobalt",
    mode: "dark",
    accent: [0.67, 0.19, 258],
    darkOnAccent: false,
    hue: 258,
    chroma: 0.016,
  },
  violet: {
    id: "violet",
    name: "Violet",
    mode: "dark",
    accent: [0.7, 0.2, 297],
    darkOnAccent: false,
    hue: 295,
    chroma: 0.015,
  },
  magenta: {
    id: "magenta",
    name: "Magenta",
    mode: "dark",
    accent: [0.72, 0.24, 341],
    darkOnAccent: false,
    hue: 336,
    chroma: 0.015,
  },
  crimson: {
    id: "crimson",
    name: "Crimson",
    mode: "dark",
    accent: [0.66, 0.23, 21],
    darkOnAccent: false,
    hue: 20,
    chroma: 0.015,
  },
  ember: {
    id: "ember",
    name: "Ember",
    mode: "dark",
    accent: [0.76, 0.18, 52],
    darkOnAccent: true,
    hue: 45,
    chroma: 0.014,
  },
  gold: {
    id: "gold",
    name: "Gold",
    mode: "dark",
    accent: [0.85, 0.16, 88],
    darkOnAccent: true,
    hue: 80,
    chroma: 0.013,
  },
  graphite: {
    id: "graphite",
    name: "Graphite",
    mode: "dark",
    accent: [0.8, 0.035, 250],
    darkOnAccent: true,
    hue: 250,
    chroma: 0.007,
  },

  // ── Light themes ──────────────────────────────────────────────────────────
  paper: {
    id: "paper",
    name: "Paper",
    mode: "light",
    accent: [0.32, 0.03, 250],
    darkOnAccent: false,
    hue: 250,
    chroma: 0.006,
  },
  sky: {
    id: "sky",
    name: "Sky",
    mode: "light",
    accent: [0.58, 0.17, 250],
    darkOnAccent: false,
    hue: 235,
    chroma: 0.012,
  },
  rose: {
    id: "rose",
    name: "Rose",
    mode: "light",
    accent: [0.62, 0.2, 10],
    darkOnAccent: false,
    hue: 20,
    chroma: 0.012,
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const DEFAULT_THEME: ThemeId = "lime";

// ── interface font ─────────────────────────────────────────────────────────
// Separate from the card fonts in src/fonts.ts: this one only styles the
// app's own chrome. The web faces are the ones index.html already loads.

export interface UiFont {
  id: string;
  name: string; // English i18n key
  stack: string;
}

export const UI_FONTS: UiFont[] = [
  {
    id: "system",
    name: "System",
    stack:
      'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  { id: "montserrat", name: "Montserrat", stack: '"Montserrat", system-ui, sans-serif' },
  { id: "oswald", name: "Oswald", stack: '"Oswald", system-ui, sans-serif' },
  { id: "bebas", name: "Bebas Neue", stack: '"Bebas Neue", system-ui, sans-serif' },
  { id: "georgia", name: "Georgia", stack: 'Georgia, "Times New Roman", serif' },
  { id: "mono", name: "Monospace", stack: 'ui-monospace, "Courier New", monospace' },
  {
    id: "arcade",
    name: "Press Start 2P",
    stack: '"Press Start 2P", ui-monospace, monospace',
  },
];

export const DEFAULT_UI_FONT = "system";
const FONT_KEY = "stickerstudio:uiFont";

function loadFont(): string {
  try {
    const raw = localStorage.getItem(FONT_KEY);
    if (raw && UI_FONTS.some((f) => f.id === raw)) return raw;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_UI_FONT;
}

let currentFont = loadFont();

export const getUiFontId = () => currentFont;
export const getUiFont = () =>
  UI_FONTS.find((f) => f.id === currentFont) ?? UI_FONTS[0];

function applyFont(): void {
  try {
    // "Press Start 2P" is enormous per character — scale the whole UI down a
    // notch so the existing layout still fits.
    const f = getUiFont();
    document.documentElement.style.setProperty("--ui-font", f.stack);
    document.documentElement.style.setProperty(
      "--ui-font-scale",
      f.id === "arcade" ? "0.82" : f.id === "bebas" ? "1.08" : "1",
    );
  } catch {
    /* no document (tests) */
  }
}

export function setUiFont(id: string): void {
  if (id === currentFont || !UI_FONTS.some((f) => f.id === id)) return;
  currentFont = id;
  try {
    localStorage.setItem(FONT_KEY, id);
  } catch {
    /* storage unavailable */
  }
  applyFont();
  for (const fn of listeners) fn();
}

/** Re-renders the component whenever the interface font changes. */
export function useUiFont(): UiFont {
  const id = useSyncExternalStore(subscribe, getUiFontId, () => DEFAULT_UI_FONT);
  return UI_FONTS.find((f) => f.id === id) ?? UI_FONTS[0];
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const okl = (l: number, c: number, h: number, alpha = 1) => {
  const base = `${clamp01(l).toFixed(3)} ${Math.max(0, c).toFixed(4)} ${h}`;
  return alpha >= 1 ? `oklch(${base})` : `oklch(${base} / ${alpha})`;
};

/** A lighter/darker relative of the theme's accent. */
export function accentShade(theme: Theme, dl = 0, chromaMul = 1, alpha = 1): string {
  const [l, c, h] = theme.accent;
  const base = `${clamp01(l + dl).toFixed(3)} ${Math.max(0, c * chromaMul).toFixed(4)} ${h}`;
  return alpha >= 1 ? `oklch(${base})` : `oklch(${base} / ${alpha})`;
}

/** The accent itself, as a plain CSS colour — also handed to Konva. */
export const accentColor = (theme: Theme) => accentShade(theme);

const onAccent = (theme: Theme) =>
  theme.darkOnAccent
    ? okl(0.2, theme.accent[1] * 0.22, theme.accent[2])
    : okl(0.98, theme.accent[1] * 0.05, theme.accent[2]);

// Every CSS custom property a theme drives. Two lightness ladders — one per
// mode — climb from a dim/void surface (canvas) up through background, card,
// popover and the raised hover/muted greys; a theme only shifts hue/chroma
// within its mode's ladder and swaps the accent in. The 3D preview's
// "--scene-bg" is deliberately left out of the mode split: that stage stays
// a dark backdrop in every theme (see index.css's hardcoded white overlay
// colours there), the same way a photo lightbox stays dark regardless of a
// site's own light/dark mode.
const LADDER: Record<ThemeMode, {
  bg: number; card: number; popover: number; soft: number;
  mutedFg: number; mutedFgMul: number; hover: number; sidebar: number;
  canvas: number; checker: number; checkerAlpha: number;
  borderL: number; borderMul: number; borderAlpha: number; inputAlpha: number;
}> = {
  dark: {
    bg: 0.16, card: 0.216, popover: 0.24, soft: 0.29,
    mutedFg: 0.68, mutedFgMul: 0.6, hover: 0.32, sidebar: 0.19,
    canvas: 0.135, checker: 0.225, checkerAlpha: 0.55,
    borderL: 0.99, borderMul: 0.2, borderAlpha: 0.11, inputAlpha: 0.15,
  },
  light: {
    bg: 0.965, card: 0.99, popover: 1, soft: 0.905,
    mutedFg: 0.42, mutedFgMul: 0.5, hover: 0.87, sidebar: 0.94,
    canvas: 0.88, checker: 0.78, checkerAlpha: 0.4,
    borderL: 0.15, borderMul: 0.25, borderAlpha: 0.14, inputAlpha: 0.18,
  },
};

function themeVars(theme: Theme): Record<string, string> {
  const { hue: h, chroma: c, mode } = theme;
  const grey = (l: number, mul = 1, alpha = 1) => okl(l, c * mul, h, alpha);
  const accent = accentColor(theme);
  const fg = onAccent(theme);
  const L = LADDER[mode];
  const ink = mode === "dark" ? grey(0.97, 0.3) : grey(0.2, 0.35);

  return {
    "--background": grey(L.bg),
    "--foreground": ink,
    "--card": grey(L.card),
    "--card-foreground": ink,
    "--popover": grey(L.popover),
    "--popover-foreground": ink,
    "--primary": accent,
    "--primary-foreground": fg,
    "--secondary": grey(L.soft),
    "--secondary-foreground": ink,
    "--muted": grey(L.soft),
    "--muted-foreground": grey(L.mutedFg, L.mutedFgMul),
    "--accent": grey(L.hover),
    "--accent-foreground": ink,
    "--border": grey(L.borderL, L.borderMul, L.borderAlpha),
    "--input": grey(L.borderL, L.borderMul, L.inputAlpha),
    "--ring": accent,
    "--sidebar": grey(L.sidebar),
    "--sidebar-foreground": ink,
    "--sidebar-primary": accent,
    "--sidebar-primary-foreground": fg,
    "--sidebar-accent": grey(L.hover),
    "--sidebar-accent-foreground": ink,
    "--sidebar-border": grey(L.borderL, L.borderMul, L.borderAlpha),
    "--sidebar-ring": accent,

    // App surfaces and effects that sit outside the shadcn token set.
    "--canvas-bg": grey(L.canvas),
    "--canvas-checker": grey(L.checker, 1.2, L.checkerAlpha),
    "--scene-bg": okl(0.115, c, h),
    "--accent-solid": accent,
    "--accent-on": fg,
    "--accent-bright": accentShade(theme, 0.1, 0.8),
    "--accent-dim": accentShade(theme, -0.24),
    "--accent-deep": accentShade(theme, -0.42, 0.8),
    "--accent-glow": accentShade(theme, 0.02, 1, 0.45),
    "--accent-veil": accentShade(theme, -0.06, 0.9, 0.28),
  };
}

const KEY = "stickerstudio:theme";
const listeners = new Set<() => void>();

function load(): ThemeId {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw && raw in THEMES) return raw as ThemeId;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_THEME;
}

let current: ThemeId = load();

function apply(): void {
  try {
    const root = document.documentElement;
    const theme = THEMES[current];
    root.dataset.theme = current;
    // index.css's ".dark" class only supplies the pre-hydration fallback
    // palette and a couple of tokens this file doesn't drive (e.g.
    // --destructive) — toggling it keeps those in step with the chosen mode.
    root.classList.toggle("dark", theme.mode === "dark");
    root.style.colorScheme = theme.mode;
    const vars = themeVars(theme);
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  } catch {
    /* no document (tests) */
  }
}

apply();
applyFont();

export function getThemeId(): ThemeId {
  return current;
}

export function getTheme(): Theme {
  return THEMES[current];
}

export function setTheme(next: ThemeId): void {
  if (next === current || !(next in THEMES)) return;
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage unavailable */
  }
  apply();
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Re-renders the component whenever the theme changes. */
export function useTheme(): Theme {
  const id = useSyncExternalStore(subscribe, getThemeId, () => DEFAULT_THEME);
  return THEMES[id];
}

/** The accent as a CSS colour string — for canvas code that can't read a var. */
export function useAccent(): string {
  return accentColor(useTheme());
}
