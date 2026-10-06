// Preflight: the checks worth running before print data leaves the app.
// Everything here measures the card in its real physical size — canvas px are
// 300 DPI units (see src/card.ts), so a px is a px is 1/300".
//
// Findings are deduplicated by layer, because a problem in a template layer
// is one problem that shows up on every card, not twenty problems.

import { croppedNatural } from "./factory";
import { FOLD_X, PANELS, PX_PER_MM, TRIM_RECT } from "./card";
import { getFormat, type FormatFeature } from "./formats";
import { resolveConditions } from "./conditions";
import { isBackground } from "./factory";
import { resolveBadgeMeta } from "./gamelist";
import { t } from "./i18n";
import { loadOverviewCards, type OverviewCard } from "./overview";
import { bounds } from "./layerBounds";
import { renderedFontSize } from "./textFit";
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
// Same for a fold line on a case wrap: a fold never lands exactly.
export const SAFE_FOLD_MM = 2;

export type Severity = "error" | "warning";
export type FindingCode =
  | "low-dpi"
  | "tiny-text"
  | "outside-trim"
  | "near-trim"
  | "on-fold"
  | "near-fold"
  | "under-feature"
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
  // scales that directly. The tighter axis wins. A crop shows fewer source
  // pixels in the same box.
  const nat = croppedNatural(l);
  return Math.min((nat.w / w) * 300, (nat.h / h) * 300);
}

// A layer that is meant to run past the trim edge, so the edge checks skip it.
const bleedsOnPurpose = (l: Layer) =>
  isBackground(l) ||
  (l.type === "image" && !!l.spineBg) ||
  !!l.alphaMask ||
  !!l.logoSlot ||
  !!l.main ||
  !!l.mask ||
  (l.type === "image" && !!l.maskId);

// What a fold or a hole would ruin: small print and codes. Pictures and
// shapes often wrap across a fold on purpose.
const isFineDetail = (l: Layer) => l.type === "text" || l.type === "qr" || l.type === "metabadge";

/** The physical layout the checks measure against — the active format by default. */
export interface CheckContext {
  folds: { x: number; left: string; right: string }[]; // canvas px, with the panels either side
  features: FormatFeature[]; // mm from the trim's top-left
}

export function formatContext(): CheckContext {
  return {
    folds: FOLD_X.map((x, i) => ({ x, left: PANELS[i].name, right: PANELS[i + 1].name })),
    features: getFormat().features ?? [],
  };
}

// Does an axis-aligned box touch a circle?
function boxHitsCircle(
  b: { x1: number; y1: number; x2: number; y2: number },
  cx: number,
  cy: number,
  r: number,
): boolean {
  const nx = Math.max(b.x1, Math.min(cx, b.x2));
  const ny = Math.max(b.y1, Math.min(cy, b.y2));
  return (nx - cx) ** 2 + (ny - cy) ** 2 < r * r;
}

function checkLayer(
  l: Layer,
  ctx: CheckContext = formatContext(),
): { code: FindingCode; severity: Severity; message: string }[] {
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

  // ── folds of a case wrap ──
  const b = bounds(l);
  if (b && isFineDetail(l)) {
    const safe = SAFE_FOLD_MM * PX_PER_MM;
    for (const f of ctx.folds) {
      const names = { a: t(f.left), b: t(f.right) };
      if (b.x1 < f.x && b.x2 > f.x) {
        out.push({
          code: "on-fold",
          severity: "error",
          message: t("Runs across the fold between {a} and {b} — it will be bent in half.", names),
        });
      } else {
        const d = Math.min(Math.abs(b.x1 - f.x), Math.abs(b.x2 - f.x));
        if (d < safe) {
          out.push({
            code: "near-fold",
            severity: "warning",
            message: t("Only {mm} mm from the fold between {a} and {b} — keep {safe} mm clear.", {
              ...names,
              mm: pxToMM(d).toFixed(1),
              safe: SAFE_FOLD_MM,
            }),
          });
        }
      }
    }
  }

  // ── holes / edges of what the label sticks on ──
  if (b && !bleedsOnPurpose(l)) {
    for (const f of ctx.features) {
      if (f.kind === "hole") {
        const hit = boxHitsCircle(
          b,
          TRIM_RECT.x + f.xMM * PX_PER_MM,
          TRIM_RECT.y + f.yMM * PX_PER_MM,
          f.rMM * PX_PER_MM,
        );
        if (hit) {
          out.push({
            code: "under-feature",
            severity: "warning",
            message: t("Covers a hole in the shell — that part won't be seen."),
          });
          break;
        }
      } else {
        const size = f.sizeMM * PX_PER_MM;
        const hit =
          f.side === "top"
            ? b.y1 < TRIM_RECT.y + size
            : f.side === "bottom"
              ? b.y2 > TRIM_RECT.y + TRIM_RECT.h - size
              : f.side === "left"
                ? b.x1 < TRIM_RECT.x + size
                : b.x2 > TRIM_RECT.x + TRIM_RECT.w - size;
        if (hit) {
          out.push({
            code: "under-feature",
            severity: "warning",
            message: t("Reaches under the shell's edge ({mm} mm) — that part gets hidden.", {
              mm: f.sizeMM,
            }),
          });
          break;
        }
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
export function checkCards(cards: Card[], ctx: CheckContext = formatContext()): Finding[] {
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
      // …but its template layers still print on it, so they're still checked.
    }

    // Cases the metadata doesn't select never print on this card, so they
    // aren't checked here — another card that does select them will.
    const meta = resolveBadgeMeta(card.project);
    const live = [
      ...resolveConditions(card.project.layers, meta),
      ...resolveConditions(card.overlay, meta),
    ];

    for (const l of live) {
      for (const f of checkLayer(l, ctx)) {
        const key = `${f.code}:${l.id}`;
        const hit = byKey.get(key);
        if (hit) {
          // One layer can trip the same check twice on a card (two folds).
          if (!hit.cards.includes(where)) hit.cards.push(where);
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
