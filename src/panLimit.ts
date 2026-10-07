// Panning a zoomed preview: how far the object may be dragged off-centre.
// Past the object's own edge, on purpose — until only a piece you can still
// grab (PAN_KEEP px) is left on screen, so it can never be lost.

export const PAN_KEEP = 140;

/** The largest |offset| along one axis: `view` is the viewport extent, `size` the object's on-screen extent. */
export function panLimit(view: number, size: number): number {
  return Math.max(0, view / 2 + size / 2 - Math.min(size, PAN_KEEP));
}

export function clampPan(offset: number, view: number, size: number): number {
  const l = panLimit(view, size);
  return Math.max(-l, Math.min(l, offset));
}

/** Zoom range of the 3D previews. */
export const PREVIEW_MIN_ZOOM = 0.5;
export const PREVIEW_MAX_ZOOM = 6;
