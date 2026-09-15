// Sticker formats. One is active at a time, per project: the key below is
// namespaced by workspace, so every project remembers its own format and
// switching project brings it along. The choice is read once at module load;
// switching persists it and reloads the page (like a backup restore) so the
// geometry constants in src/card.ts can stay plain module-level consts.

import { wsSuffix } from "./workspace";

export type FormatId =
  | "card"
  | "cassette-label"
  | "floppy-label"
  | "dvd-insert"
  | "cassette-jcard"
  | "custom";

// A multi-panel format (DVD wrap, cassette J-card) is one artboard split
// into panels by fold lines. The panels partition trimMM.w left-to-right;
// their widths must add up to trimMM.w.
export interface FormatPanel {
  name: string; // English i18n key
  wMM: number;
}

export interface CardFormat {
  id: FormatId;
  name: string; // English i18n key
  trimMM: { w: number; h: number };
  bleedMM: number;
  cornerRadiusMM: number; // preview mask only
  thickRatio: number; // 3D preview thickness ÷ trim height
  hasBack: boolean; // only the credit card has a separate back
  panels?: FormatPanel[]; // absent = a single print area
}

// Dimensions are approximate real-world values — tune here if needed.
export const FORMATS: Record<FormatId, CardFormat> = {
  card: {
    id: "card",
    name: "Credit card",
    trimMM: { w: 54, h: 85.6 },
    bleedMM: 3,
    cornerRadiusMM: 3.18,
    thickRatio: 0.00888,
    hasBack: true,
  },
  "cassette-label": {
    id: "cassette-label",
    name: "Cassette label",
    trimMM: { w: 63.5, h: 42.7 },
    bleedMM: 2,
    cornerRadiusMM: 1.5,
    thickRatio: 0.0015,
    hasBack: false,
  },
  "floppy-label": {
    id: "floppy-label",
    name: "Floppy disk label",
    trimMM: { w: 70, h: 70 },
    bleedMM: 2,
    cornerRadiusMM: 2,
    thickRatio: 0.0015,
    hasBack: false,
  },
  "dvd-insert": {
    id: "dvd-insert",
    name: "DVD case wrap",
    // flap 7 + back 130.5 + spine 14 + front 130.5 + flap 7
    trimMM: { w: 289, h: 183 },
    bleedMM: 3,
    cornerRadiusMM: 0,
    thickRatio: 0.0008,
    hasBack: false,
    panels: [
      { name: "Flap", wMM: 7 },
      { name: "Back", wMM: 130.5 },
      { name: "Spine", wMM: 14 },
      { name: "Front", wMM: 130.5 },
      { name: "Flap", wMM: 7 },
    ],
  },
  "cassette-jcard": {
    id: "cassette-jcard",
    name: "Cassette case (J-card)",
    // front 64 + spine 12 + back 64 + tuck flap 14
    trimMM: { w: 154, h: 101.6 },
    bleedMM: 3,
    cornerRadiusMM: 0,
    thickRatio: 0.0008,
    hasBack: false,
    panels: [
      { name: "Front", wMM: 64 },
      { name: "Spine", wMM: 12 },
      { name: "Back", wMM: 64 },
      { name: "Flap", wMM: 14 },
    ],
  },
  // Placeholder geometry — a project created with this format stores its own
  // dimensions (see CustomFormatSpec below) and getFormat() merges them in.
  custom: {
    id: "custom",
    name: "Custom",
    trimMM: { w: 54, h: 85.6 },
    bleedMM: 3,
    cornerRadiusMM: 3.18,
    thickRatio: 0.00888,
    hasBack: true,
  },
};

// A user-chosen size for the "custom" format — set once at project creation
// (see WorkspaceDialog) and stored per workspace, the same way the format
// choice itself is.
export interface CustomFormatSpec {
  wMM: number;
  hMM: number;
  cornerRadiusMM: number;
}

export const DEFAULT_CUSTOM_FORMAT: CustomFormatSpec = {
  wMM: 54,
  hMM: 85.6,
  cornerRadiusMM: 3.18,
};

const customKey = (suffix: string) => `stickerstudio:customFormat${suffix}`;

export function getCustomFormatSpec(suffix = wsSuffix()): CustomFormatSpec {
  try {
    const raw = localStorage.getItem(customKey(suffix));
    if (raw) {
      const v = JSON.parse(raw) as Partial<CustomFormatSpec>;
      if (
        typeof v.wMM === "number" &&
        typeof v.hMM === "number" &&
        typeof v.cornerRadiusMM === "number"
      ) {
        return { wMM: v.wMM, hMM: v.hMM, cornerRadiusMM: v.cornerRadiusMM };
      }
    }
  } catch {
    /* unavailable / malformed */
  }
  return DEFAULT_CUSTOM_FORMAT;
}

export function setCustomFormatSpec(spec: CustomFormatSpec, suffix = wsSuffix()): void {
  try {
    localStorage.setItem(customKey(suffix), JSON.stringify(spec));
  } catch {
    /* unavailable */
  }
}

// A CardFormat for the "custom" id built from a spec, without touching
// storage — used for the live preview while the user is still typing.
export function customCardFormat(spec: CustomFormatSpec): CardFormat {
  return {
    ...FORMATS.custom,
    trimMM: { w: spec.wMM, h: spec.hMM },
    cornerRadiusMM: spec.cornerRadiusMM,
  };
}

export const FORMAT_IDS = Object.keys(FORMATS) as FormatId[];

const KEY = `stickerstudio:format${wsSuffix()}`;

export function getFormatId(): FormatId {
  try {
    const v = localStorage.getItem(KEY);
    if (v && v in FORMATS) return v as FormatId;
  } catch {
    /* unavailable */
  }
  return "card";
}

// The bleed can be changed per workspace (Settings ▸ Bleed …); absent =
// the format's own. Changing it moves every layer (src/bleed.ts) and
// reloads, like a format switch, since src/card.ts derives the canvas from
// it at module load.
const BLEED_KEY = `stickerstudio:bleed${wsSuffix()}`;
export const MAX_BLEED_MM = 10;

export function getBleedOverride(): number | undefined {
  try {
    const v = Number(localStorage.getItem(BLEED_KEY));
    if (Number.isFinite(v) && v >= 0 && v <= MAX_BLEED_MM && localStorage.getItem(BLEED_KEY) !== null) return v;
  } catch {
    /* unavailable */
  }
  return undefined;
}

export function setBleedOverride(mm: number | undefined): void {
  try {
    if (mm === undefined) localStorage.removeItem(BLEED_KEY);
    else localStorage.setItem(BLEED_KEY, String(mm));
  } catch {
    /* unavailable */
  }
}

/** The active format with the format's own bleed, ignoring the override. */
export function getBaseFormat(): CardFormat {
  const id = getFormatId();
  if (id === "custom") return customCardFormat(getCustomFormatSpec());
  return FORMATS[id];
}

export function getFormat(): CardFormat {
  const base = getBaseFormat();
  const bleed = getBleedOverride();
  return bleed === undefined ? base : { ...base, bleedMM: bleed };
}

export const isCard = () => getFormatId() === "card";

export function setFormat(id: FormatId): void {
  if (id === getFormatId()) return;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* unavailable */
  }
  location.reload();
}

// CSS custom properties that make the 3D card / demo card match the active
// format's proportions. Spread into a style object.
export function previewCssVars(): Record<string, string | number> {
  const f = getFormat();
  return {
    "--aspect": `${f.trimMM.w} / ${f.trimMM.h}`,
    "--thick-ratio": f.thickRatio,
    "--radius-ratio": f.cornerRadiusMM / f.trimMM.h,
    "--radius-x": `${(f.cornerRadiusMM / f.trimMM.w) * 100}%`,
    "--radius-y": `${(f.cornerRadiusMM / f.trimMM.h) * 100}%`,
  };
}
