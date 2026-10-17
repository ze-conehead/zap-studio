// Page sizes the user saved for the print sheet (a printer that takes some
// odd format, say), each with the sheet settings that go with it: the gap,
// the margin, a white background and crop marks. Kept in localStorage —
// global, not per project, since they describe the printer, not the work.
// See CutSheetDialog's size picker.

import { MAX_PAGE_MM, MIN_PAGE_MM } from "./sheet";

const KEY = "stickerstudio:savedPaperSizes";

/** What a saved size remembers besides its dimensions. */
export interface PaperSettings {
  gapMM: number;
  marginMM: number;
  whiteBackground: boolean;
  cropMarks: boolean;
}

export interface SavedPaperSize {
  id: string;
  name: string;
  wMM: number; // short side
  hMM: number; // long side
  // Absent on a size saved before these were kept — selecting it then
  // changes nothing but the page size.
  settings?: PaperSettings;
}

const validSettings = (v: unknown): v is PaperSettings => {
  const s = v as Partial<PaperSettings> | null;
  return (
    !!s &&
    typeof s.gapMM === "number" &&
    typeof s.marginMM === "number" &&
    typeof s.whiteBackground === "boolean" &&
    typeof s.cropMarks === "boolean"
  );
};

export const sameSettings = (a: PaperSettings, b: PaperSettings): boolean =>
  Math.abs(a.gapMM - b.gapMM) < 0.005 &&
  Math.abs(a.marginMM - b.marginMM) < 0.005 &&
  a.whiteBackground === b.whiteBackground &&
  a.cropMarks === b.cropMarks;

const valid = (v: unknown): v is SavedPaperSize => {
  const s = v as Partial<SavedPaperSize> | null;
  return (
    !!s &&
    typeof s.id === "string" &&
    typeof s.name === "string" &&
    typeof s.wMM === "number" &&
    typeof s.hMM === "number" &&
    s.wMM >= MIN_PAGE_MM &&
    s.hMM <= MAX_PAGE_MM
  );
};

export function loadSavedSizes(): SavedPaperSize[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    // A damaged settings block is dropped, the size itself kept.
    return raw.filter(valid).map((s) => (s.settings !== undefined && !validSettings(s.settings) ? { ...s, settings: undefined } : s));
  } catch {
    return [];
  }
}

function write(list: SavedPaperSize[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable — the size just isn't kept */
  }
}

/**
 * Saves a size under `name`, with the sheet settings that go with it; a size
 * already saved under that name (any case) is replaced rather than
 * duplicated. Returns the new list, in the order they were first saved.
 */
export function saveSize(name: string, w: number, h: number, settings?: PaperSettings): SavedPaperSize[] {
  const clean = name.trim() || `${+w.toFixed(1)} × ${+h.toFixed(1)} mm`;
  const wMM = Math.min(w, h);
  const hMM = Math.max(w, h);
  const list = loadSavedSizes();
  const at = list.findIndex((s) => s.name.toLowerCase() === clean.toLowerCase());
  const entry: SavedPaperSize = {
    id: at >= 0 ? list[at].id : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: clean,
    wMM,
    hMM,
    ...(settings ? { settings } : {}),
  };
  const next = at >= 0 ? list.map((s, i) => (i === at ? entry : s)) : [...list, entry];
  write(next);
  return next;
}

/** Replaces the sheet settings saved with one size. */
export function updateSizeSettings(id: string, settings: PaperSettings): SavedPaperSize[] {
  const next = loadSavedSizes().map((s) => (s.id === id ? { ...s, settings } : s));
  write(next);
  return next;
}

export function deleteSize(id: string): SavedPaperSize[] {
  const next = loadSavedSizes().filter((s) => s.id !== id);
  write(next);
  return next;
}

/** The saved size matching `size` (either way round), if any. */
export function savedMatch(
  list: SavedPaperSize[],
  size: { wMM: number; hMM: number },
): SavedPaperSize | undefined {
  const a = Math.min(size.wMM, size.hMM);
  const b = Math.max(size.wMM, size.hMM);
  return list.find((s) => Math.abs(s.wMM - a) < 0.05 && Math.abs(s.hMM - b) < 0.05);
}
