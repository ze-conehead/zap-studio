// Combining shapes: a shape layer's own outline plus its `combine` entries
// (ShapeLayer.combine) — simple shapes unioned or subtracted together to
// form one alpha mask, or one visual shape. Pure geometry only; the actual
// Konva rendering (silhouette compositing, fill-then-cut) lives in
// src/components/canvas/layerInner.tsx.

import type { CombineOp, CombineShape, ShapeKind } from "./types";

// One shape to composite: the parent's own box (always first, always
// "add") or one of its `combine` entries, normalised to the same shape.
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

/** A new combine entry, sized to sit inside `parentW × parentH`, centred. */
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

/** The parent's own box plus its `combine` entries, in draw order. */
export function operandsOf(layer: {
  shape: ShapeKind;
  width: number;
  height: number;
  cornerRadius: number;
  combine?: CombineShape[];
}): ShapeOperand[] {
  const base: ShapeOperand = {
    shape: layer.shape,
    op: "add",
    x: 0,
    y: 0,
    width: layer.width,
    height: layer.height,
    rotation: 0,
    cornerRadius: cornerRadiusOf(layer.shape, layer.width, layer.height, layer.cornerRadius),
  };
  const rest = (layer.combine ?? []).map(
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
  return [base, ...rest];
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
