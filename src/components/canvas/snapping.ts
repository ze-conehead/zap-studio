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

// While dragging, nudge `node` so its nearest edge or centre lines up with a
// guide within `tol`. Mutates the node directly; the caller then commits.
// Returns the guide position it locked onto per axis (for the highlight).
export function snapNodeToGuides(node: Konva.Node, lines: SnapLines): SnapHit {
  const box = node.getClientRect({ relativeTo: node.getLayer() ?? undefined });
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
  node.x(node.x() + rx.delta);
  node.y(node.y() + ry.delta);
  return {
    xs: !rx.fromSmart && rx.hit != null ? [rx.hit] : [],
    ys: !ry.fromSmart && ry.hit != null ? [ry.hit] : [],
    smartX: rx.fromSmart && rx.hit != null ? [rx.hit] : [],
    smartY: ry.fromSmart && ry.hit != null ? [ry.hit] : [],
  };
}

// The box a layer occupies before its own scale/rotation, for snap anchors.
export function layerBoxSize(l: TLayer): { w: number; h: number } | null {
  if (l.type === "text") return null; // height depends on wrapping
  if ("width" in l && "height" in l) return { w: l.width, h: l.height };
  return null;
}
