// Colour themes. The app is dark-only, so a theme is an accent colour plus a
// tint for the greys around it; every palette below is derived from those two
// numbers, so the ten themes stay consistent with each other. The choice
// lives in localStorage and is exposed through a useSyncExternalStore pub/sub,
// like the language in src/i18n.ts.

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
  | "graphite";

/** An OKLCH colour as [lightness 0-1, chroma, hue deg]. */
type Oklch = [number, number, number];

export interface Theme {
  id: ThemeId;
  name: string; // English i18n key
  accent: Oklch;
  /** true when the accent is bright enough to need dark text on top. */
  darkOnAccent: boolean;
  /** Hue of the greys (background, cards, borders …). */
  hue: number;
  /** How strongly the greys are tinted. 0 = plain dark grey, no hue. */
  chroma: number;
}

export const THEMES: Record<ThemeId, Theme> = {
  // The default: lime green on plain dark grey (chroma 0 = no hue at all).
  lime: {
    id: "lime",
    name: "Lime",
    accent: [0.86, 0.21, 130],
    darkOnAccent: true,
    hue: 0,
    chroma: 0,
  },
  emerald: {
    id: "emerald",
    name: "Emerald",
    accent: [0.79, 0.16, 162],
    darkOnAccent: true,
    hue: 165,
    chroma: 0.012,
  },
  cyan: {
    id: "cyan",
    name: "Cyan",
    accent: [0.81, 0.14, 197],
    darkOnAccent: true,
    hue: 210,
    chroma: 0.013,
  },
  cobalt: {
    id: "cobalt",
    name: "Cobalt",
    accent: [0.67, 0.19, 258],
    darkOnAccent: false,
    hue: 258,
    chroma: 0.016,
  },
  violet: {
    id: "violet",
    name: "Violet",
    accent: [0.7, 0.2, 297],
    darkOnAccent: false,
    hue: 295,
    chroma: 0.015,
  },
  magenta: {
    id: "magenta",
    name: "Magenta",
    accent: [0.72, 0.24, 341],
    darkOnAccent: false,
    hue: 336,
    chroma: 0.015,
  },
  crimson: {
    id: "crimson",
    name: "Crimson",
    accent: [0.66, 0.23, 21],
    darkOnAccent: false,
    hue: 20,
    chroma: 0.015,
  },
  ember: {
    id: "ember",
    name: "Ember",
    accent: [0.76, 0.18, 52],
    darkOnAccent: true,
    hue: 45,
    chroma: 0.014,
  },
  gold: {
    id: "gold",
    name: "Gold",
    accent: [0.85, 0.16, 88],
    darkOnAccent: true,
    hue: 80,
    chroma: 0.013,
  },
  graphite: {
    id: "graphite",
    name: "Graphite",
    accent: [0.8, 0.035, 250],
    darkOnAccent: true,
    hue: 250,
    chroma: 0.007,
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const DEFAULT_THEME: ThemeId = "lime";

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

// Every CSS custom property a theme drives. The lightness ladder is the one
// the dark palette already used; a theme only shifts its hue/chroma and swaps
// the accent in.
function themeVars(theme: Theme): Record<string, string> {
  const { hue: h, chroma: c } = theme;
  const grey = (l: number, mul = 1, alpha = 1) => okl(l, c * mul, h, alpha);
  const accent = accentColor(theme);
  const fg = onAccent(theme);

  return {
    "--background": grey(0.16),
    "--foreground": grey(0.97, 0.3),
    "--card": grey(0.216),
    "--card-foreground": grey(0.97, 0.3),
    "--popover": grey(0.24),
    "--popover-foreground": grey(0.97, 0.3),
    "--primary": accent,
    "--primary-foreground": fg,
    "--secondary": grey(0.29),
    "--secondary-foreground": grey(0.97, 0.3),
    "--muted": grey(0.29),
    "--muted-foreground": grey(0.68, 0.6),
    "--accent": grey(0.32),
    "--accent-foreground": grey(0.97, 0.3),
    "--border": grey(0.99, 0.2, 0.11),
    "--input": grey(0.99, 0.2, 0.15),
    "--ring": accent,
    "--sidebar": grey(0.19),
    "--sidebar-foreground": grey(0.97, 0.3),
    "--sidebar-primary": accent,
    "--sidebar-primary-foreground": fg,
    "--sidebar-accent": grey(0.32),
    "--sidebar-accent-foreground": grey(0.97, 0.3),
    "--sidebar-border": grey(0.99, 0.2, 0.11),
    "--sidebar-ring": accent,

    // App surfaces and effects that sit outside the shadcn token set.
    "--canvas-bg": grey(0.135),
    "--canvas-checker": grey(0.225, 1.2, 0.55),
    "--scene-bg": grey(0.115),
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
    root.dataset.theme = current;
    const vars = themeVars(THEMES[current]);
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  } catch {
    /* no document (tests) */
  }
}

apply();

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
