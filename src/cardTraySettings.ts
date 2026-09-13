// Presets + saved calibration for printing directly onto a blank PVC card
// through a printer's disc/card tray (e.g. Canon's "Disc Tray G / J / K / M"
// or "MP Tray" media). The tray is usually much bigger than the card, and
// exactly where the card sits on that bigger page depends on the physical
// tray — which varies by printer model and isn't something this app can
// know in advance. These are starting points to print a test page against;
// the dialog lets the offset be nudged and remembers it per tray type.

export type TrayType = "g" | "jkm" | "mp";

export interface TrayPreset {
  label: string;
  pageWidthMM: number;
  pageHeightMM: number;
  offsetXMM: number;
  offsetYMM: number;
}

export const TRAY_TYPES: TrayType[] = ["g", "jkm", "mp"];

// All three default to the one concrete number available (Canon's MP-tray
// media is "120x120mm") with the card centred on it — an untested starting
// guess for G / J/K/M, not a measured one.
const CARD_W = 54;
const CARD_H = 85.6;
const DEFAULT_PAGE = 120;

const round1 = (n: number) => Math.round(n * 10) / 10;

function centered(label: string): TrayPreset {
  return {
    label,
    pageWidthMM: DEFAULT_PAGE,
    pageHeightMM: DEFAULT_PAGE,
    offsetXMM: round1((DEFAULT_PAGE - CARD_W) / 2),
    offsetYMM: round1((DEFAULT_PAGE - CARD_H) / 2),
  };
}

const DEFAULTS: Record<TrayType, TrayPreset> = {
  g: centered("Disc Tray G"),
  jkm: centered("Disc Tray J / K / M"),
  mp: centered("MP Tray (120 × 120 mm)"),
};

const KEY = (t: TrayType) => `stickerstudio:cardTray:${t}`;
const LAST_KEY = "stickerstudio:cardTray:last";

export function getTrayPreset(t: TrayType): TrayPreset {
  try {
    const raw = localStorage.getItem(KEY(t));
    if (raw) return { ...DEFAULTS[t], ...(JSON.parse(raw) as Partial<TrayPreset>) };
  } catch {
    /* fall back to the default */
  }
  return DEFAULTS[t];
}

export function saveTrayPreset(
  t: TrayType,
  patch: Partial<Omit<TrayPreset, "label">>,
): void {
  try {
    localStorage.setItem(KEY(t), JSON.stringify({ ...getTrayPreset(t), ...patch }));
  } catch {
    /* storage unavailable */
  }
}

export function getLastTrayType(): TrayType {
  try {
    const v = localStorage.getItem(LAST_KEY);
    if (v && (TRAY_TYPES as string[]).includes(v)) return v as TrayType;
  } catch {
    /* unavailable */
  }
  return "jkm";
}

export function setLastTrayType(t: TrayType): void {
  try {
    localStorage.setItem(LAST_KEY, t);
  } catch {
    /* unavailable */
  }
}
