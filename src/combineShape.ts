// Combined shapes: a shape layer whose `shape` is "combined" has no outline
// of its own — its `combine` entries (ShapeLayer.combine) are simple shapes
// unioned or subtracted together to form one alpha mask, or one visual
// shape. Pure geometry only; the actual
// Konva rendering (silhouette compositing, fill-then-cut) lives in
// src/components/canvas/layerInner.tsx.

import type { CombineOp, CombineShape, Layer, ShapeKind, ShapeLayer } from "./types";

/** A shape layer that is a container of parts rather than one outline. */
export const isCombined = (l: Layer): l is ShapeLayer => l.type === "shape" && l.shape === "combined";

// One shape to composite: a plain shape's own box, or one of a combined
// shape's parts, normalised to the same form.
export interface ShapeOperand {
  shape: ShapeKind;
  op: CombineOp;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  cornerRadius: number;
}

const newId = () =>
  crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** A new part, sized to sit inside `parentW × parentH`, centred. */
export function makeCombineShape(
  shape: ShapeKind,
  op: CombineOp,
  parentW: number,
  parentH: number,
): CombineShape {
  const w = shape === "capsule" ? parentW * 0.55 : Math.min(parentW, parentH) * 0.5;
  const h = shape === "capsule" ? parentH * 0.3 : w;
  return {
    id: newId(),
    shape,
    op,
    x: 0,
    y: 0,
    width: w,
    height: h,
    rotation: 0,
    cornerRadius: shape === "rect" ? Math.min(w, h) * 0.15 : 0,
  };
}

// A capsule's ends are fully rounded — same convention as a plain shape
// layer (src/components/canvas/layerInner.tsx's ShapeInner).
const cornerRadiusOf = (shape: ShapeKind, w: number, h: number, own: number) =>
  shape === "capsule" ? Math.min(w, h) / 2 : own;

/**
 * What a shape layer is made of, in draw order: a combined shape's parts
 * (operand i is `combine[i]`), or just its own box for a plain shape.
 */
export function operandsOf(layer: {
  shape: ShapeKind | "combined";
  width: number;
  height: number;
  cornerRadius: number;
  combine?: CombineShape[];
}): ShapeOperand[] {
  if (layer.shape !== "combined") {
    return [
      {
        shape: layer.shape,
        op: "add",
        x: 0,
        y: 0,
        width: layer.width,
        height: layer.height,
        rotation: 0,
        cornerRadius: cornerRadiusOf(layer.shape, layer.width, layer.height, layer.cornerRadius),
      },
    ];
  }
  return (layer.combine ?? []).map(
    (c): ShapeOperand => ({
      shape: c.shape,
      op: c.op,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
      rotation: c.rotation,
      cornerRadius: cornerRadiusOf(c.shape, c.width, c.height, c.cornerRadius),
    }),
  );
}

// The 4 corners of an operand's box, rotated around its own centre and
// placed at (x, y) — a safe bounding shape for a circle/capsule too.
function corners(op: ShapeOperand): { x: number; y: number }[] {
  const hw = op.width / 2;
  const hh = op.height / 2;
  const rad = (op.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return (
    [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ] as const
  ).map(([lx, ly]) => ({
    x: op.x + lx * cos - ly * sin,
    y: op.y + lx * sin + ly * cos,
  }));
}

/**
 * The combine entries after the main shape was resized by (fx, fy): each
 * entry's position and size grow with it, so the compound keeps its look.
 * For a rotated entry the new width / height follow how the scale stretches
 * its own axes (exact for quarter turns and uniform scaling). Corner radii
 * stay as they are, like the main shape's own.
 */
export function scaleCombine(combine: CombineShape[], fx: number, fy: number): CombineShape[] {
  if (!Number.isFinite(fx) || !Number.isFinite(fy) || (fx === 1 && fy === 1)) return combine;
  return combine.map((c) => {
    const rad = (c.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
      ...c,
      x: c.x * fx,
      y: c.y * fy,
      width: Math.max(1, c.width * Math.hypot(fx * cos, fy * sin)),
      height: Math.max(1, c.height * Math.hypot(fx * sin, fy * cos)),
    };
  });
}

/**
 * What a patch to a combined shape's width / height should do to its combine
 * entries: the scaled list, or undefined when nothing changes (no resize, no
 * entries, or the patch sets the entries itself).
 */
export function combineAfterResize(
  before: { width: number; height: number; combine?: CombineShape[] },
  patch: { width?: number; height?: number; combine?: CombineShape[] },
): CombineShape[] | undefined {
  if (!before.combine?.length || "combine" in patch) return undefined;
  if (before.width <= 0 || before.height <= 0) return undefined;
  const fx = (patch.width ?? before.width) / before.width;
  const fy = (patch.height ?? before.height) / before.height;
  const scaled = scaleCombine(before.combine, fx, fy);
  return scaled === before.combine ? undefined : scaled;
}

/**
 * One part of a combined shape as a layer standing where that part is drawn
 * on the card — position and rotation resolved through the container's own
 * transform. Only for looking at it (the hover outline), never stored.
 */
export function partAsLayer(parent: ShapeLayer, part: CombineShape): ShapeLayer {
  const rad = (parent.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const lx = part.x * parent.scaleX;
  const ly = part.y * parent.scaleY;
  return {
    ...parent,
    id: part.id,
    name: part.name || parent.name,
    shape: part.shape,
    x: parent.x + lx * cos - ly * sin,
    y: parent.y + lx * sin + ly * cos,
    rotation: parent.rotation + part.rotation,
    width: part.width,
    height: part.height,
    cornerRadius: part.cornerRadius,
    combine: undefined,
  };
}

/** An operand's rotated bounding box in the parent's local space. */
export function operandBounds(op: ShapeOperand): { x: number; y: number; w: number; h: number } {
  return combinedBounds([op]);
}

/**
 * The box (parent-local space) the combined shape actually shows: the union
 * of its "add" operands. Subtract operands only ever cut, so unlike
 * combinedBounds they never widen it — what snapping should align.
 */
export function visibleBounds(ops: ShapeOperand[]): { x: number; y: number; w: number; h: number } {
  const adds = ops.filter((o) => o.op === "add");
  return combinedBounds(adds.length ? adds : ops);
}

/**
 * A box (in the parent's own local space) that fully contains every
 * operand — including subtract ones, a harmlessly generous superset since
 * cutting only ever shrinks what shows. Empty when there are no operands.
 */
export function combinedBounds(ops: ShapeOperand[]): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const op of ops) {
    for (const c of corners(op)) {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x);
      maxY = Math.max(maxY, c.y);
    }
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

const EPS = 1e-6;

/**
 * Keeps a combined shape's layer box honest: its position becomes the centre
 * of what its parts show and width / height their size, with the parts
 * shifted the other way so nothing moves on screen. Everything that treats a
 * shape as a box centred on x / y (alignment, snapping, the selection box,
 * hover, preflight, fitting an image into a frame) then works unchanged.
 * Other layers, and a combined shape with no parts, come back as they were.
 */
export function recenterCombined<L extends Layer>(l: L): L {
  if (!isCombined(l) || !l.combine?.length) return l;
  const b = visibleBounds(operandsOf(l));
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const w = Math.max(1, b.w);
  const h = Math.max(1, b.h);
  if (
    Math.abs(cx) < EPS &&
    Math.abs(cy) < EPS &&
    Math.abs(w - l.width) < EPS &&
    Math.abs(h - l.height) < EPS
  ) {
    return l;
  }
  // The new origin is the local point (cx, cy): node transform is
  // position + rotate(scale ⊙ local).
  const rad = (l.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = l.scaleX * cx;
  const dy = l.scaleY * cy;
  return {
    ...l,
    x: l.x + dx * cos - dy * sin,
    y: l.y + dx * sin + dy * cos,
    width: w,
    height: h,
    combine: l.combine.map((c) => ({ ...c, x: c.x - cx, y: c.y - cy })),
  };
}

/**
 * Older projects let any shape carry extra combined shapes on top of its own
 * outline. Such a shape becomes a combined shape of its own outline plus
 * those parts — it looks exactly as before.
 */
export function legacyToCombined<L extends Layer>(l: L): L {
  if (l.type !== "shape" || l.shape === "combined" || !l.combine?.length) return l;
  const own: CombineShape = {
    id: newId(),
    shape: l.shape,
    op: "add",
    x: 0,
    y: 0,
    width: l.width,
    height: l.height,
    rotation: 0,
    cornerRadius: l.cornerRadius,
  };
  return recenterCombined({ ...l, shape: "combined", cornerRadius: 0, combine: [own, ...l.combine] } as L);
}
