// User-configurable spot colours for the cover PDF's cut line and fold
// (score) line — Settings ▸ Cut & fold lines …. Global, not per-workspace:
// this is a print-pipeline preference, not project data.

export interface SpotColor {
  name: string;
  c: number; // 0–1 each
  m: number;
  y: number;
  k: number;
}

export const DEFAULT_CUT_SPOT: SpotColor = { name: "kiss_cut", c: 0, m: 1, y: 0, k: 0 };
export const DEFAULT_SCORE_SPOT: SpotColor = { name: "kiss_score", c: 1, m: 0, y: 0, k: 0 };

const CUT_KEY = "stickerstudio:cutLineSpot";
const SCORE_KEY = "stickerstudio:scoreLineSpot";

function isSpotColor(v: unknown): v is SpotColor {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.name === "string" &&
    typeof o.c === "number" &&
    typeof o.m === "number" &&
    typeof o.y === "number" &&
    typeof o.k === "number"
  );
}

function readSpot(key: string, fallback: SpotColor): SpotColor {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const v: unknown = JSON.parse(raw);
      if (isSpotColor(v)) return v;
    }
  } catch {
    /* unavailable / malformed */
  }
  return fallback;
}

function writeSpot(key: string, v: SpotColor): void {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* unavailable */
  }
}

export const getCutLineSpot = (): SpotColor => readSpot(CUT_KEY, DEFAULT_CUT_SPOT);
export const setCutLineSpot = (v: SpotColor): void => writeSpot(CUT_KEY, v);
export const getScoreLineSpot = (): SpotColor => readSpot(SCORE_KEY, DEFAULT_SCORE_SPOT);
export const setScoreLineSpot = (v: SpotColor): void => writeSpot(SCORE_KEY, v);

// A rough on-screen approximation — naive CMYK→RGB, just for a settings
// swatch and the export preview, never for the print itself (that's the
// exact /Separation + CMYK tint in the PDF).
export function spotColorCss(s: SpotColor): string {
  const r = Math.round(255 * (1 - s.c) * (1 - s.k));
  const g = Math.round(255 * (1 - s.m) * (1 - s.k));
  const b = Math.round(255 * (1 - s.y) * (1 - s.k));
  return `rgb(${r}, ${g}, ${b})`;
}
