// Snapping while a layer is dragged: the guide / card / layer positions
// it can lock onto, and the nudge that does it.

import type Konva from "konva";
import type { Layer as TLayer } from "../../types";

// Guide positions (canvas px) a dragged layer can snap to, plus how close
// (canvas px) counts as "near".
export interface SnapLines {
  xs: number[]; // the user's guides
  ys: number[];
  smartX: number[]; // the card box and the other layers
  smartY: number[];
  tol: number;
}

// Which positions a dragged layer is currently snapped to, split by source:
// `xs`/`ys` highlight an existing guide, `smartX`/`smartY` get a line drawn.
export interface SnapHit {
  xs: number[];
  ys: number[];
  smartX: number[];
  smartY: number[];
}

/**
 * Shift while dragging (as in Photoshop): the movement is held to one axis —
 * whichever the pointer has travelled further along. Returns that axis, the
 * one that keeps moving.
 */
export const dominantAxis = (dx: number, dy: number): "x" | "y" => (Math.abs(dx) >= Math.abs(dy) ? "x" : "y");

/** Pins `node` back to `from` on the axis that Shift holds still; returns that held axis. */
export function lockNodeAxis(node: Konva.Node, from: { x: number; y: number }): "x" | "y" {
  const moving = dominantAxis(node.x() - from.x, node.y() - from.y);
  const held = moving === "x" ? "y" : "x";
  node[held](from[held]);
  return held;
}

/** `hit` without the highlight on the held axis — nothing snaps there. */
export function withoutAxis(hit: SnapHit, held: "x" | "y" | null): SnapHit {
  if (!held) return hit;
  return held === "x" ? { ...hit, xs: [], smartX: [] } : { ...hit, ys: [], smartY: [] };
}

export interface SnapBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The nudge that lines `box`'s nearest edge or centre up with a guide /
 * alignment line within `lines.tol`, and what it locked onto (per axis, for
 * the highlight). Pure — callers apply the delta.
 */
export function snapBox(box: SnapBox, lines: SnapLines): { dx: number; dy: number; hit: SnapHit } {
  const anchorsX = [box.x, box.x + box.width / 2, box.x + box.width];
  const anchorsY = [box.y, box.y + box.height / 2, box.y + box.height];

  // Nearest candidate across both sets; `smart` says which set won, so the
  // caller knows whether to highlight a guide or draw an alignment line.
  const nearest = (
    anchors: number[],
    guides: number[],
    smart: number[],
    tol: number,
  ) => {
    let delta = 0;
    let best = tol + 1;
    let hit: number | null = null;
    let fromSmart = false;
    const scan = (list: number[], isSmart: boolean) => {
      for (const a of anchors) {
        for (const g of list) {
          const d = g - a;
          if (Math.abs(d) < best) {
            best = Math.abs(d);
            delta = d;
            hit = g;
            fromSmart = isSmart;
          }
        }
      }
    };
    // Explicit guides win ties — they were placed on purpose.
    scan(guides, false);
    scan(smart, true);
    return best <= tol ? { delta, hit, fromSmart } : { delta: 0, hit: null, fromSmart: false };
  };

  const rx = nearest(anchorsX, lines.xs, lines.smartX, lines.tol);
  const ry = nearest(anchorsY, lines.ys, lines.smartY, lines.tol);
  return {
    dx: rx.delta,
    dy: ry.delta,
    hit: {
      xs: !rx.fromSmart && rx.hit != null ? [rx.hit] : [],
      ys: !ry.fromSmart && ry.hit != null ? [ry.hit] : [],
      smartX: rx.fromSmart && rx.hit != null ? [rx.hit] : [],
      smartY: ry.fromSmart && ry.hit != null ? [ry.hit] : [],
    },
  };
}

/**
 * The box a node occupies on its Konva layer. `localBox` (in the node's own
 * space, e.g. a compound shape's visible silhouette) replaces the node's
 * client rect when the node isn't rotated — so a combined shape snaps by
 * what it actually shows, not by hidden helper nodes.
 */
export function nodeSnapBox(node: Konva.Node, localBox?: SnapBox): SnapBox {
  if (localBox && !node.rotation()) {
    const sx = node.scaleX();
    const sy = node.scaleY();
    const x0 = node.x() + localBox.x * sx;
    const x1 = node.x() + (localBox.x + localBox.width) * sx;
    const y0 = node.y() + localBox.y * sy;
    const y1 = node.y() + (localBox.y + localBox.height) * sy;
    return { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) };
  }
  return node.getClientRect({ relativeTo: node.getLayer() ?? undefined });
}

// While dragging, nudge `node` so its nearest edge or centre lines up with a
// guide within `tol`. Mutates the node directly; the caller then commits.
// Returns the guide position it locked onto per axis (for the highlight).
export function snapNodeToGuides(node: Konva.Node, lines: SnapLines, localBox?: SnapBox): SnapHit {
  const { dx, dy, hit } = snapBox(nodeSnapBox(node, localBox), lines);
  node.x(node.x() + dx);
  node.y(node.y() + dy);
  return hit;
}

/** A Transformer box in absolute (stage) pixels: Konva's own shape for it. */
export interface TransformBox extends SnapBox {
  rotation: number;
}

/**
 * Snaps the edges a resize is moving onto the nearest guide / card edge /
 * layer edge. `anchor` is the Transformer's active handle ("top-left",
 * "middle-right" …); only the edges that handle moves are touched, the others
 * stay where they are. The box is in stage pixels, the lines in canvas px, so
 * `scale` (stage px per canvas px) converts between them — and the reach is
 * the snap strength in screen pixels. A corner drag that keeps the aspect
 * ratio keeps it: snapping one edge moves the other to match. A rotated box
 * is left alone.
 */
export function snapResizeBox(
  oldBox: TransformBox,
  newBox: TransformBox,
  anchor: string | null,
  lines: SnapLines,
  scale: number,
): { box: TransformBox; hit: SnapHit } {
  const none = { box: newBox, hit: { xs: [], ys: [], smartX: [], smartY: [] } as SnapHit };
  if (!anchor || Math.abs(newBox.rotation) > 1e-6 || Math.abs(oldBox.rotation) > 1e-6) return none;
  const L = anchor.includes("left");
  const R = anchor.includes("right");
  const T = anchor.includes("top");
  const B = anchor.includes("bottom");
  if (!L && !R && !T && !B) return none;
  const reach = lines.tol * scale; // stage px
  const find = (edge: number, guides: number[], smart: number[]) => {
    let best: { pos: number; d: number; smart: boolean } | null = null;
    const scan = (list: number[], isSmart: boolean) => {
      for (const g of list) {
        const d = Math.abs(g * scale - edge);
        if (d <= reach && (!best || d < best.d)) best = { pos: g, d, smart: isSmart };
      }
    };
    scan(guides, false); // placed on purpose: wins ties
    scan(smart, true);
    return best as { pos: number; d: number; smart: boolean } | null;
  };

  let { x, y, width, height } = newBox;
  const hit: SnapHit = { xs: [], ys: [], smartX: [], smartY: [] };
  const mark = (axis: "x" | "y", f: { pos: number; smart: boolean }) =>
    (axis === "x" ? (f.smart ? hit.smartX : hit.xs) : f.smart ? hit.smartY : hit.ys).push(f.pos);

  // Which edge of each axis moves (a corner moves one of each).
  const fx = L ? find(x, lines.xs, lines.smartX) : R ? find(x + width, lines.xs, lines.smartX) : null;
  const fy = T ? find(y, lines.ys, lines.smartY) : B ? find(y + height, lines.ys, lines.smartY) : null;
  const ratioKept =
    (L || R) && (T || B) && Math.abs(newBox.width / newBox.height - oldBox.width / oldBox.height) < 1e-3;
  const ratio = oldBox.width / oldBox.height;

  // With the ratio locked, only the nearer of the two snaps can be honoured.
  let useX = !!fx;
  let useY = !!fy;
  if (ratioKept && fx && fy) {
    if (fx.d <= fy.d) useY = false;
    else useX = false;
  }
  if (useX && fx) {
    const edge = fx.pos * scale;
    if (L) {
      width = x + width - edge;
      x = edge;
    } else width = edge - x;
    mark("x", fx);
    if (ratioKept) {
      const h = width / ratio;
      if (T) y = y + height - h;
      height = h;
    }
  }
  if (useY && fy) {
    const edge = fy.pos * scale;
    if (T) {
      height = y + height - edge;
      y = edge;
    } else height = edge - y;
    mark("y", fy);
    if (ratioKept) {
      const w = height * ratio;
      if (L) x = x + width - w;
      width = w;
    }
  }
  if (width < 8 || height < 8) return none;
  return { box: { ...newBox, x, y, width, height }, hit };
}

// The box a layer occupies before its own scale/rotation, for snap anchors.
export function layerBoxSize(l: TLayer): { w: number; h: number } | null {
  if (l.type === "text") return null; // height depends on wrapping
  if ("width" in l && "height" in l) return { w: l.width, h: l.height };
  return null;
}
