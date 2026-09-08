// Text that flows around the alpha mask frames instead of running under
// them: a text layer with `flow` set is a frame of width × height, and each
// line is broken into the horizontal gaps the frames leave free at that
// height. A frame sitting in the middle of a line splits it in two.
//
// Everything here works in the text layer's own box coordinates: (0,0) is
// the frame's top-left corner, (width, height) the bottom-right.

import Konva from "konva";
import { fontStyleString } from "./textUtil";
import type { Layer, TextLayer } from "./types";

/** Clearance kept around each obstacle, in canvas px (≈ 1 mm at 300 dpi). */
export const DEFAULT_FLOW_GAP = 12;

/** Frame height a text layer gets the first time flow is switched on. */
export const DEFAULT_FLOW_HEIGHT = 420;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One run of text: a whole line, or a piece of one beside an obstacle. */
export interface FlowPiece {
  x: number;
  y: number;
  w: number;
  text: string;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * The obstacles as axis-aligned boxes in `layer`'s frame coordinates,
 * already grown by the clearance. Rotated obstacles (or a rotated frame)
 * are approximated by their bounding box, which only ever keeps text
 * further away.
 */
export function obstacleBoxes(layer: TextLayer, obstacles: Layer[]): Box[] {
  const W = layer.width;
  const H = layer.height ?? DEFAULT_FLOW_HEIGHT;
  const gap = layer.flowGap ?? DEFAULT_FLOW_GAP;
  const cos = Math.cos(-rad(layer.rotation));
  const sin = Math.sin(-rad(layer.rotation));
  const sx = layer.scaleX || 1;
  const sy = layer.scaleY || 1;

  const out: Box[] = [];
  for (const o of obstacles) {
    if (!o.visible) continue;
    if (!("width" in o) || !("height" in o) || o.height === undefined) continue;
    const hw = Math.abs(o.width * o.scaleX) / 2;
    const hh = Math.abs(o.height * o.scaleY) / 2;
    if (!hw || !hh) continue;

    const oc = Math.cos(rad(o.rotation));
    const os = Math.sin(rad(o.rotation));
    let x1 = Infinity;
    let y1 = Infinity;
    let x2 = -Infinity;
    let y2 = -Infinity;
    for (const [px, py] of [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ]) {
      // corner → canvas space
      const cx = o.x + px * oc - py * os;
      const cy = o.y + px * os + py * oc;
      // canvas space → the frame's own coordinates
      const dx = cx - layer.x;
      const dy = cy - layer.y;
      const bx = (dx * cos - dy * sin) / sx + W / 2;
      const by = (dx * sin + dy * cos) / sy + H / 2;
      x1 = Math.min(x1, bx);
      y1 = Math.min(y1, by);
      x2 = Math.max(x2, bx);
      y2 = Math.max(y2, by);
    }

    const box = {
      x: x1 - gap,
      y: y1 - gap,
      w: x2 - x1 + gap * 2,
      h: y2 - y1 + gap * 2,
    };
    // Ignore anything that misses the frame entirely.
    if (box.x >= W || box.y >= H || box.x + box.w <= 0 || box.y + box.h <= 0) {
      continue;
    }
    out.push(box);
  }
  return out;
}

/** The free horizontal runs of the band [y0, y1) across a frame `W` wide. */
function freeSegments(
  y0: number,
  y1: number,
  W: number,
  boxes: Box[],
): { x: number; w: number }[] {
  const blocked = boxes
    .filter((b) => b.y < y1 && b.y + b.h > y0)
    .map((b) => [Math.max(0, b.x), Math.min(W, b.x + b.w)])
    .filter(([a, z]) => z > a)
    .sort((p, q) => p[0] - q[0]);

  const out: { x: number; w: number }[] = [];
  let cur = 0;
  for (const [a, z] of blocked) {
    if (a > cur) out.push({ x: cur, w: a - cur });
    cur = Math.max(cur, z);
  }
  if (cur < W) out.push({ x: cur, w: W - cur });
  return out.filter((s) => s.w >= 1);
}

// Konva measures a string as the canvas width plus the letter spacing it
// inserts between characters; mirrored here so the break points match what
// is drawn.
function measurer(layer: TextLayer, fontSize: number): (s: string) => number {
  const probe = new Konva.Text({
    fontFamily: layer.fontFamily,
    fontStyle: fontStyleString(layer),
    fontSize,
  });
  const ls = layer.letterSpacing;
  return (s) => (s ? probe.measureSize(s).width + ls * (s.length - 1) : 0);
}

/**
 * Breaks `layer.text` into pieces that avoid `boxes`. Lines run from the top
 * of the frame down; text that outgrows the frame keeps going below it
 * rather than disappearing.
 */
export function flowLayout(
  layer: TextLayer,
  fontSize: number,
  boxes: Box[],
): FlowPiece[] {
  const W = layer.width;
  const H = layer.height ?? DEFAULT_FLOW_HEIGHT;
  const lineH = fontSize * layer.lineHeight;
  if (W < 1 || lineH < 1) return [];

  const width = measurer(layer, fontSize);
  const pieces: FlowPiece[] = [];
  // A line can be fully blocked, so lines are not bounded by the word count
  // alone — this caps a pathological layout instead of looping forever.
  const maxLines = Math.ceil(H / lineH) + layer.text.length + 32;
  let y = 0;
  let lines = 0;

  for (const para of layer.text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      y += lineH;
      lines++;
      continue;
    }
    let i = 0;
    while (i < words.length && lines < maxLines) {
      for (const seg of freeSegments(y, y + lineH, W, boxes)) {
        if (i >= words.length) break;
        let line = "";
        while (i < words.length) {
          const cand = line ? `${line} ${words[i]}` : words[i];
          if (width(cand) > seg.w) break;
          line = cand;
          i++;
        }
        // A word too long for even the full width would stall the layout —
        // let it overhang instead.
        if (!line && seg.w >= W - 0.5) {
          line = words[i];
          i++;
        }
        if (line) pieces.push({ x: seg.x, y, w: seg.w, text: line });
      }
      y += lineH;
      lines++;
    }
  }
  return pieces;
}

/** Height the flowed text actually takes up, for the overflow warning. */
export const flowHeight = (pieces: FlowPiece[], lineH: number): number =>
  pieces.length ? Math.max(...pieces.map((p) => p.y)) + lineH : 0;
