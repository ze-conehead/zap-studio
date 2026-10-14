// Moving shapes into and out of a combined shape (src/combineShape.ts). A
// combined shape is a container; the shapes in it are `combine` parts, which
// carry no fill of their own — the container's fill, stroke and shadow paint
// the whole union.

import { recenterCombined } from "./combineShape";
import { makeShapeLayer } from "./factory";
import type { CombineShape, ShapeLayer } from "./types";

const newId = () =>
  crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const rotate = (x: number, y: number, deg: number) => {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
};

/** A shape layer's parts, in that layer's own local space (a plain shape has one: itself). */
function partsOf(l: ShapeLayer): CombineShape[] {
  if (l.shape === "combined") return l.combine ?? [];
  return [
    {
      id: newId(),
      shape: l.shape,
      op: "add",
      x: 0,
      y: 0,
      width: l.width,
      height: l.height,
      rotation: 0,
      cornerRadius: l.cornerRadius,
      name: l.name,
    },
  ];
}

/** A shape (plain, or another combined one) can join a combined shape. */
export const canJoin = (container: ShapeLayer, other: ShapeLayer): boolean =>
  container.shape === "combined" &&
  container.id !== other.id &&
  !other.alphaMask &&
  !other.logoSlot &&
  !other.mask;

/**
 * The container with `other`'s shapes added as parts, placed exactly where
 * `other` sat on the card. Everything is converted into the container's own
 * local space (its position, rotation and scale), then the container is
 * recentred. `other` itself is for the caller to delete.
 */
export function mergeIntoCombined(container: ShapeLayer, other: ShapeLayer): ShapeLayer {
  const sx = container.scaleX || 1;
  const sy = container.scaleY || 1;
  const dRot = other.rotation - container.rotation;
  const fx = Math.abs(other.scaleX / sx);
  const fy = Math.abs(other.scaleY / sy);
  // Where `other`'s origin is, in the container's local space.
  const o = rotate(other.x - container.x, other.y - container.y, -container.rotation);
  const parts = partsOf(other).map((p): CombineShape => {
    const v = rotate(p.x * other.scaleX, p.y * other.scaleY, dRot);
    return {
      ...p,
      id: newId(),
      x: o.x / sx + v.x / sx,
      y: o.y / sy + v.y / sy,
      width: p.width * fx,
      height: p.height * fy,
      rotation: p.rotation + dRot,
    };
  });
  return recenterCombined({ ...container, combine: [...(container.combine ?? []), ...parts] });
}

/**
 * Takes part `index` out of a combined shape as a shape layer of its own,
 * standing where the part stood and painted like the container. Returns the
 * container without it and that new layer.
 */
export function extractPart(
  container: ShapeLayer,
  index: number,
): { container: ShapeLayer; shape: ShapeLayer } | null {
  const part = container.combine?.[index];
  if (!part || container.shape !== "combined") return null;
  const sx = container.scaleX || 1;
  const sy = container.scaleY || 1;
  const at = rotate(part.x * sx, part.y * sy, container.rotation);
  const shape: ShapeLayer = {
    ...makeShapeLayer(part.shape),
    name: part.name || makeShapeLayer(part.shape).name,
    x: container.x + at.x,
    y: container.y + at.y,
    rotation: container.rotation + part.rotation,
    width: Math.max(1, part.width * Math.abs(sx)),
    height: Math.max(1, part.height * Math.abs(sy)),
    cornerRadius: part.shape === "rect" ? part.cornerRadius * Math.min(Math.abs(sx), Math.abs(sy)) : 0,
    fill: container.fill,
    stroke: container.stroke,
    strokeWidth: container.strokeWidth,
    opacity: container.opacity,
    shadow: container.shadow,
  };
  const rest = recenterCombined({
    ...container,
    combine: (container.combine ?? []).filter((_, i) => i !== index),
  });
  return { container: rest, shape };
}
