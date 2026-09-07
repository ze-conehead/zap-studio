// Preflight: the checks worth running before print data leaves the app.
// Everything here measures the card in its real physical size — canvas px are
// 300 DPI units (see src/card.ts), so a px is a px is 1/300".
//
// Findings are deduplicated by layer, because a problem in a template layer
// is one problem that shows up on every card, not twenty problems.

import { PX_PER_MM, TRIM_RECT } from "./card";
import { isBackground } from "./factory";
import { t } from "./i18n";
import { loadOverviewCards, type OverviewCard } from "./overview";
import { renderedFontSize, textHeight } from "./textFit";
import type { Layer, Project, TextLayer } from "./types";

// ── thresholds ─────────────────────────────────────────────────────────────
// Print shops ask for 300 dpi; 250 still looks fine, below 150 is visibly soft.
export const DPI_GOOD = 250;
export const DPI_BAD = 150;
// Below ~5 pt small print stops being readable at arm's length; 4 pt is the
// point where offset printing starts to lose strokes entirely.
export const PT_SMALL = 5;
export const PT_TINY = 4;
// How close to the trim edge is asking for trouble when the cut drifts.
export const SAFE_MM = 2;

export type Severity = "error" | "warning";
export type FindingCode =
  | "low-dpi"
  | "tiny-text"
  | "outside-trim"
  | "near-trim"
  | "empty";

export interface Finding {
  key: string; // dedupe key: code + layer id
  severity: Severity;
  code: FindingCode;
  message: string;
  layerName: string;
  /** Cards this finding applies to. More than one => it sits in a template. */
  cards: { name: string; gameKey?: string; consoleName?: string }[];
  fromTemplate: boolean;
}

// canvas px -> physical units
const pxToMM = (px: number) => px / PX_PER_MM;
const pxToPt = (px: number) => (px / PX_PER_MM / 25.4) * 72;

/** Effective resolution of an image layer once it is scaled onto the card. */
export function effectiveDpi(l: Layer): number | null {
  if (l.type !== "image" || !l.naturalWidth || !l.naturalHeight) return null;
  const w = Math.abs(l.width * l.scaleX);
  const h = Math.abs(l.height * l.scaleY);
  if (!w || !h) return null;
  // Canvas px are already 300 dpi, so the ratio of source to placed pixels
  // scales that directly. The tighter axis wins.
  return Math.min((l.naturalWidth / w) * 300, (l.naturalHeight / h) * 300);
}

/** Axis-aligned bounds of a layer in canvas px, rotation included. */
function bounds(l: Layer): { x1: number; y1: number; x2: number; y2: number } | null {
  let w: number;
  let h: number;
  if (l.type === "text") {
    w = l.width;
    h = textHeight(l);
  } else if ("width" in l && "height" in l) {
    w = l.width;
    h = l.height;
  } else {
    return null;
  }
  w = Math.abs(w * l.scaleX);
  h = Math.abs(h * l.scaleY);
  if (!w || !h) return null;

  if (!l.rotation) {
    return { x1: l.x - w / 2, y1: l.y - h / 2, x2: l.x + w / 2, y2: l.y + h / 2 };
  }
  const r = (l.rotation * Math.PI) / 180;
  const cw = (Math.abs(Math.cos(r)) * w + Math.abs(Math.sin(r)) * h) / 2;
  const ch = (Math.abs(Math.sin(r)) * w + Math.abs(Math.cos(r)) * h) / 2;
  return { x1: l.x - cw, y1: l.y - ch, x2: l.x + cw, y2: l.y + ch };
}

// A layer that is meant to run past the trim edge, so the edge checks skip it.
const bleedsOnPurpose = (l: Layer) =>
  isBackground(l) || !!l.mainMask || !!l.logoSlot || !!l.main || !!l.mask;

function checkLayer(l: Layer): { code: FindingCode; severity: Severity; message: string }[] {
  if (!l.visible) return [];
  const out: { code: FindingCode; severity: Severity; message: string }[] = [];

  // ── resolution ──
  const dpi = effectiveDpi(l);
  if (dpi != null && dpi < DPI_GOOD) {
    out.push({
      code: "low-dpi",
      severity: dpi < DPI_BAD ? "error" : "warning",
      message: t("Only {dpi} dpi at this size — {good} dpi or more prints cleanly.", {
        dpi: Math.round(dpi),
        good: DPI_GOOD,
      }),
    });
  }

  // ── text size ──
  if (l.type === "text" && l.text.trim()) {
    const pt = pxToPt(renderedFontSize(l as TextLayer) * Math.abs(l.scaleY));
    if (pt < PT_SMALL) {
      out.push({
        code: "tiny-text",
        severity: pt < PT_TINY ? "error" : "warning",
        message: t("Text is {pt} pt — under {small} pt it gets hard to read in print.", {
          pt: pt.toFixed(1),
          small: PT_SMALL,
        }),
      });
    }
  }

  // ── distance to the cut ──
  if (!bleedsOnPurpose(l)) {
    const b = bounds(l);
    if (b) {
      const safe = SAFE_MM * PX_PER_MM;
      const over = Math.max(
        TRIM_RECT.x - b.x1,
        TRIM_RECT.y - b.y1,
        b.x2 - (TRIM_RECT.x + TRIM_RECT.w),
        b.y2 - (TRIM_RECT.y + TRIM_RECT.h),
      );
      if (over > 0) {
        out.push({
          code: "outside-trim",
          severity: "error",
          message: t("Sticks {mm} mm past the cut line — that part gets trimmed off.", {
            mm: pxToMM(over).toFixed(1),
          }),
        });
      } else if (over > -safe) {
        out.push({
          code: "near-trim",
          severity: "warning",
          message: t("Only {mm} mm from the cut line — keep {safe} mm clear so a drifting cut can't clip it.", {
            mm: pxToMM(-over).toFixed(1),
            safe: SAFE_MM,
          }),
        });
      }
    }
  }

  return out;
}

interface Card {
  name: string;
  gameKey?: string;
  consoleName?: string;
  project: Project;
  overlay: Layer[];
}

/** Runs every check over a set of cards, merging repeats from templates. */
export function checkCards(cards: Card[]): Finding[] {
  const byKey = new Map<string, Finding>();

  for (const card of cards) {
    const where = { name: card.name, gameKey: card.gameKey, consoleName: card.consoleName };
    const own = new Set(card.project.layers.map((l) => l.id));

    if (!card.project.layers.length) {
      const key = `empty:${card.project.id}`;
      byKey.set(key, {
        key,
        severity: "warning",
        code: "empty",
        message: t("This card has no layers yet."),
        layerName: "",
        cards: [where],
        fromTemplate: false,
      });
      continue;
    }

    for (const l of [...card.project.layers, ...card.overlay]) {
      for (const f of checkLayer(l)) {
        const key = `${f.code}:${l.id}`;
        const hit = byKey.get(key);
        if (hit) {
          hit.cards.push(where);
        } else {
          byKey.set(key, {
            key,
            severity: f.severity,
            code: f.code,
            message: f.message,
            layerName: l.name,
            cards: [where],
            fromTemplate: !own.has(l.id),
          });
        }
      }
    }
  }

  const order: Record<Severity, number> = { error: 0, warning: 1 };
  return [...byKey.values()].sort(
    (a, b) => order[a.severity] - order[b.severity] || b.cards.length - a.cards.length,
  );
}

/** Every card in the catalogue, templates included. */
export async function checkAllCards(): Promise<Finding[]> {
  const cards = await loadOverviewCards();
  return checkCards(
    cards.map((c: OverviewCard) => ({
      name: c.gameTitle,
      gameKey: c.key,
      consoleName: c.consoleName,
      project: c.card.project,
      overlay: c.card.overlay,
    })),
  );
}
