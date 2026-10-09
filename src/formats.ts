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
  | "switch-case"
  | "nes-label"
  | "amiga-label"
  | "gameboy-label"
  | "custom";

// What the new-project dialog (and Project ▸ Format) groups formats under.
export type FormatCategory = "cards" | "covers" | "labels";

export const FORMAT_CATEGORIES: { id: FormatCategory; name: string }[] = [
  { id: "cards", name: "Cards" },
  { id: "covers", name: "DVD covers" },
  { id: "labels", name: "Labels" },
];

// A multi-panel format (DVD wrap, cassette J-card) is one artboard split
// into panels by fold lines. The panels partition trimMM.w left-to-right;
// their widths must add up to trimMM.w.
export interface FormatPanel {
  name: string; // English i18n key
  wMM: number;
}

// Physical details of whatever the label is stuck on, drawn over the label in
// the 3D preview only (never exported) so you can see what the artwork has to
// work around. Positions are mm from the trim's top-left corner.
export type FormatFeature =
  | { kind: "hole"; xMM: number; yMM: number; rMM: number } // centred on x/y
  | { kind: "edge"; side: "top" | "bottom" | "left" | "right"; sizeMM: number };

// How the 3D mockup (components/Mockup3D.tsx) shows a format: a case wrap
// folded round a box — front, spine and back panels on the matching sides,
// the spine panel's width as the depth — or a label stuck onto the shell it
// belongs on, at real size. Positions in mm; colours are the plastic.
export type Mockup =
  | { kind: "case"; color: string }
  | {
      kind: "shell";
      wMM: number;
      hMM: number;
      dMM: number;
      color: string;
      labelXMM: number; // label's top-left on the shell's front
      labelYMM: number;
    };

export interface CardFormat {
  id: FormatId;
  name: string; // English i18n key
  category: FormatCategory;
  trimMM: { w: number; h: number };
  bleedMM: number;
  cornerRadiusMM: number; // preview mask only
  thickRatio: number; // 3D preview thickness ÷ trim height
  hasBack: boolean; // a separate, independently designed reverse side
  panels?: FormatPanel[]; // absent = a single print area
  features?: FormatFeature[]; // preview-only overlay, see FormatFeature
  mockup?: Mockup; // 3D preview on the real object; absent = just the sticker
}

// Dimensions are approximate real-world values — tune here if needed.
export const FORMATS: Record<FormatId, CardFormat> = {
  card: {
    id: "card",
    category: "cards",
    name: "Credit card",
    trimMM: { w: 54, h: 85.6 },
    bleedMM: 3,
    cornerRadiusMM: 3.18,
    thickRatio: 0.00888,
    hasBack: true,
  },
  "cassette-label": {
    id: "cassette-label",
    category: "labels",
    name: "Cassette label",
    trimMM: { w: 63.5, h: 42.7 },
    bleedMM: 2,
    cornerRadiusMM: 1.5,
    thickRatio: 0.0015,
    hasBack: false,
    // The two hub holes of the cassette shell, 42 mm apart.
    features: [
      { kind: "hole", xMM: 10.75, yMM: 27, rMM: 5.5 },
      { kind: "hole", xMM: 52.75, yMM: 27, rMM: 5.5 },
    ],
    mockup: { kind: "shell", wMM: 100.4, hMM: 63.8, dMM: 12, color: "#2b2f36", labelXMM: 18.5, labelYMM: 4 },
  },
  "floppy-label": {
    id: "floppy-label",
    category: "labels",
    name: "Floppy disk label",
    trimMM: { w: 70, h: 70 },
    bleedMM: 2,
    cornerRadiusMM: 2,
    thickRatio: 0.0015,
    hasBack: false,
    mockup: { kind: "shell", wMM: 90, hMM: 94, dMM: 3.3, color: "#1e2026", labelXMM: 10, labelYMM: 22 },
  },
  "dvd-insert": {
    id: "dvd-insert",
    category: "covers",
    name: "DVD case wrap",
    // flap 7 + back 130.5 + spine 14 + front 130.5 + flap 7
    trimMM: { w: 289, h: 183 },
    bleedMM: 3,
    cornerRadiusMM: 0,
    thickRatio: 0.0008,
    hasBack: true,
    panels: [
      { name: "Flap", wMM: 7 },
      { name: "Back", wMM: 130.5 },
      { name: "Spine", wMM: 14 },
      { name: "Front", wMM: 130.5 },
      { name: "Flap", wMM: 7 },
    ],
    mockup: { kind: "case", color: "#121417" },
  },
  "cassette-jcard": {
    id: "cassette-jcard",
    category: "covers",
    name: "Cassette case (J-card)",
    // The standard J-card, as laid flat: tuck flap 25.4 (1") + spine 12.7
    // (½") + front 65.087, 103.187 × 102 mm — the flap tucks in along the
    // back of the case, the front faces out.
    trimMM: { w: 103.187, h: 102 },
    bleedMM: 3,
    cornerRadiusMM: 0,
    thickRatio: 0.0008,
    hasBack: false,
    panels: [
      { name: "Flap", wMM: 25.4 },
      { name: "Spine", wMM: 12.7 },
      { name: "Front", wMM: 65.087 },
    ],
    mockup: { kind: "case", color: "#c9ced6" },
  },
  "switch-case": {
    id: "switch-case",
    category: "covers",
    name: "Nintendo Switch case",
    // back 99 + spine 10 + front 99, left to right — same order as the DVD
    // wrap's own panels below; back face = the case's inside.
    trimMM: { w: 208, h: 160.5 },
    bleedMM: 3,
    cornerRadiusMM: 0,
    thickRatio: 0.0008,
    hasBack: true,
    panels: [
      { name: "Back", wMM: 99 },
      { name: "Spine", wMM: 10 },
      { name: "Front", wMM: 99 },
    ],
    mockup: { kind: "case", color: "#d32f2f" },
  },
  // Approximate real-world label recesses — tune here if needed.
  "nes-label": {
    id: "nes-label",
    category: "labels",
    name: "NES cartridge label",
    trimMM: { w: 73, h: 54 },
    bleedMM: 2,
    cornerRadiusMM: 1.5,
    thickRatio: 0.0015,
    hasBack: false,
    // The cartridge's raised top lip, which the label tucks up against.
    features: [{ kind: "edge", side: "top", sizeMM: 4 }],
    mockup: { kind: "shell", wMM: 120, hMM: 133, dMM: 20, color: "#8d9096", labelXMM: 23.5, labelYMM: 14 },
  },
  "amiga-label": {
    id: "amiga-label",
    category: "labels",
    name: "Amiga disk label",
    trimMM: { w: 70, h: 55 },
    bleedMM: 2,
    cornerRadiusMM: 2,
    thickRatio: 0.0015,
    hasBack: false,
    mockup: { kind: "shell", wMM: 90, hMM: 94, dMM: 3.3, color: "#e9e6dd", labelXMM: 10, labelYMM: 36 },
  },
  "gameboy-label": {
    id: "gameboy-label",
    category: "labels",
    name: "Game Boy cartridge label",
    trimMM: { w: 46, h: 40 },
    bleedMM: 2,
    cornerRadiusMM: 1.5,
    thickRatio: 0.0015,
    hasBack: false,
    mockup: { kind: "shell", wMM: 57, hMM: 65, dMM: 8, color: "#a9a7a1", labelXMM: 5.5, labelYMM: 13 },
  },
  // Placeholder geometry — a project created with this format stores its own
  // dimensions (see CustomFormatSpec below) and getFormat() merges them in.
  custom: {
    id: "custom",
    category: "cards",
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

export const formatsIn = (c: FormatCategory): FormatId[] =>
  FORMAT_IDS.filter((id) => FORMATS[id].category === c);

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

// The bleed can be changed per workspace (Project ▸ Bleed …); absent =
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
