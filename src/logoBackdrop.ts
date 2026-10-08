// What a logo is previewed on. A logo ends up on the card, so its tile shows
// the card's own background — the console template's, else the global one's
// (with the console's pick for it) — which is the honest way to see whether
// it will read. With no background to go by, the tile is chosen from the
// logo itself: a dark logo gets a light tile, a light one a dark tile, so
// that black and white logos are visible at all.

import { useEffect, useState } from "react";
import { DEFAULT_ACCENT } from "./accent";
import { gradientStops } from "./background";
import { getCatalog, findGame } from "./data/catalog";
import { GLOBAL_TEMPLATE_ID, isBackground, templateId } from "./factory";
import { backgroundFillOverrides } from "./fillOverrides";
import { loadProject } from "./persist";
import { useStore } from "./store";
import type { CardBackground, Project } from "./types";

// ── the card's background as CSS ───────────────────────────────────────────

// A colour the browser can paint — a template may hold an {accent} /
// {contrast} token, which has no colour until a card is known.
const paintable = (c: string) => (/^(#|rgb|hsl|oklch|oklab|color\()/i.test(c.trim()) ? c : DEFAULT_ACCENT);

/** A card background as a CSS `background` value; null for "transparent". */
export function fillToCss(fill: CardBackground | undefined | null): string | null {
  if (!fill || fill.kind === "none") return null;
  if (fill.kind === "solid") return paintable(fill.color);
  const stops = gradientStops(fill).map(paintable).join(", ");
  // The app's angle: 0 = →, 90 = ↓ — CSS counts from "up", clockwise.
  return (fill.gradientKind ?? "linear") === "radial"
    ? `radial-gradient(circle, ${stops})`
    : `linear-gradient(${Math.round(fill.angle) + 90}deg, ${stops})`;
}

const visibleBg = (p: Project | undefined) => {
  const bg = p?.layers.find(isBackground);
  return bg?.visible && bg.type === "background" ? bg : undefined;
};

/**
 * The background a card of `consoleId` shows: the console template's own,
 * else the global template's — as the console overrides it. Null when
 * neither has a visible one.
 */
export async function loadCardBackdrop(consoleId?: string): Promise<string | null> {
  const [globalP, consoleP] = await Promise.all([
    loadProject(GLOBAL_TEMPLATE_ID),
    consoleId ? loadProject(templateId(consoleId)) : Promise.resolve(undefined),
  ]);
  const own = visibleBg(consoleP);
  if (own) return fillToCss(own.fill);
  const global = visibleBg(globalP);
  return global ? fillToCss(backgroundFillOverrides(global, [consoleP])) : null;
}

/** The console a project belongs to: its template's, or its game's. */
export function consoleIdOf(project: Pick<Project, "consoleId" | "gameKey">): string | undefined {
  return project.consoleId ?? findGame(project.gameKey)?.console.id;
}

export const consoleIdByName = (name: string | undefined): string | undefined =>
  name ? getCatalog().find((c) => c.name === name)?.id : undefined;

/**
 * The backdrop for logo tiles: `undefined` while loading, null when there's
 * no background to show, else the CSS. Pass the console, or leave it out for
 * the open project's own.
 */
export function useCardBackdrop(consoleId?: string, fromProject = false): string | null | undefined {
  const { state } = useStore();
  const id = fromProject ? consoleIdOf(state.project) : consoleId;
  const [css, setCss] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    setCss(undefined);
    loadCardBackdrop(id).then(
      (v) => alive && setCss(v),
      () => alive && setCss(null),
    );
    return () => {
      alive = false;
    };
  }, [id]);
  return css;
}

// ── a logo's own lightness ─────────────────────────────────────────────────

const lumCache = new Map<string, Promise<number | null>>();

/**
 * Mean lightness (0 black … 1 white) of a picture's visible pixels, weighted
 * by their opacity; null when it can't be read (a cross-origin picture) or
 * is empty. Cached per source.
 */
export function imageLightness(src: string): Promise<number | null> {
  const hit = lumCache.get(src);
  if (hit) return hit;
  const p = new Promise<number | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const N = 48;
        const c = document.createElement("canvas");
        c.width = N;
        c.height = N;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, N, N);
        resolve(lightnessOf(ctx.getImageData(0, 0, N, N).data));
      } catch {
        resolve(null); // tainted
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
  lumCache.set(src, p);
  return p;
}

/** Opacity-weighted mean lightness of RGBA pixel data; null if nothing is visible. */
export function lightnessOf(data: ArrayLike<number>): number | null {
  let sum = 0;
  let weight = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    if (a < 0.15) continue;
    sum += ((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255) * a;
    weight += a;
  }
  return weight ? sum / weight : null;
}

// Where a logo counts as dark / light. In between (colourful logos) the
// normal checkerboard stays.
export const DARK_LOGO = 0.35;
export const LIGHT_LOGO = 0.62;

/**
 * The tile background for a logo with no card background to go by: a light
 * tile for a dark logo, a dark one for a light logo, null (= the ordinary
 * checkerboard) otherwise.
 */
export function tileForLightness(l: number | null): string | null {
  if (l === null) return null;
  if (l <= DARK_LOGO) return "#e5e7eb";
  if (l >= LIGHT_LOGO) return "#1f2937";
  return null;
}

/** Hook around imageLightness(); undefined until measured. */
export function useImageLightness(src: string | undefined, enabled = true): number | null | undefined {
  const [l, setL] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    setL(undefined);
    if (!src || !enabled) return;
    let alive = true;
    void imageLightness(src).then((v) => alive && setL(v));
    return () => {
      alive = false;
    };
  }, [src, enabled]);
  return l;
}
