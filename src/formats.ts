// Sticker formats. One is active for the whole workspace at a time; the
// choice lives in localStorage and is read once at module load. Switching
// persists the choice and reloads the page (like a backup restore) so the
// geometry constants in src/card.ts can stay plain module-level consts.

export type FormatId =
  | "card"
  | "cassette-label"
  | "floppy-label"
  | "dvd-insert"
  | "cassette-jcard";

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
  safeMM: number;
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
    safeMM: 3,
    thickRatio: 0.00888,
    hasBack: true,
  },
  "cassette-label": {
    id: "cassette-label",
    name: "Cassette label",
    trimMM: { w: 63.5, h: 42.7 },
    bleedMM: 2,
    cornerRadiusMM: 1.5,
    safeMM: 2,
    thickRatio: 0.0015,
    hasBack: false,
  },
  "floppy-label": {
    id: "floppy-label",
    name: "Floppy disk label",
    trimMM: { w: 70, h: 70 },
    bleedMM: 2,
    cornerRadiusMM: 2,
    safeMM: 2,
    thickRatio: 0.0015,
    hasBack: false,
  },
  "dvd-insert": {
    id: "dvd-insert",
    name: "DVD case wrap",
    trimMM: { w: 275, h: 183 }, // back 130.5 + spine 14 + front 130.5
    bleedMM: 3,
    cornerRadiusMM: 0,
    safeMM: 4,
    thickRatio: 0.0008,
    hasBack: false,
    panels: [
      { name: "Back", wMM: 130.5 },
      { name: "Spine", wMM: 14 },
      { name: "Front", wMM: 130.5 },
    ],
  },
  "cassette-jcard": {
    id: "cassette-jcard",
    name: "Cassette case (J-card)",
    trimMM: { w: 140, h: 101.6 }, // front 64 + spine 12 + back 64
    bleedMM: 3,
    cornerRadiusMM: 0,
    safeMM: 3,
    thickRatio: 0.0008,
    hasBack: false,
    panels: [
      { name: "Front", wMM: 64 },
      { name: "Spine", wMM: 12 },
      { name: "Back", wMM: 64 },
    ],
  },
};

export const FORMAT_IDS = Object.keys(FORMATS) as FormatId[];

const KEY = "stickerstudio:format";

export function getFormatId(): FormatId {
  try {
    const v = localStorage.getItem(KEY);
    if (v && v in FORMATS) return v as FormatId;
  } catch {
    /* unavailable */
  }
  return "card";
}

export function getFormat(): CardFormat {
  return FORMATS[getFormatId()];
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
