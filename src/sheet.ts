// "Cut sheet": several finished card designs packed onto one PNG at physical
// 300 DPI size — each card printed full-bleed (a rectangle), spaced apart —
// plus a matching SVG whose rounded paths cut each card at its trim edge.
// Paginated to the Cricut Explore Print-then-Cut area.

import { CANVAS, CORNER_RADIUS_PX, PX_PER_MM, TRIM_RECT } from "./card";
import { gameKeyOf, getCatalog } from "./data/catalog";
import { GLOBAL_TEMPLATE_ID, isBackground, templateId } from "./factory";
import { getGameProject } from "./gameIndex";
import { loadAllProjects, loadProject } from "./persist";
import type { DemoCard } from "./demo";
import type { Project } from "./types";

// Cricut Explore "Print then Cut" printable area.
export const PRINT_W_MM = 171.45; // 6.75"
export const PRINT_H_MM = 234.95; // 9.25"

export interface SheetGame {
  gameKey: string;
  consoleName: string;
  gameTitle: string;
}

// Every catalogue game that has a saved sticker design.
export async function listGameDesigns(): Promise<SheetGame[]> {
  const projects = await loadAllProjects();
  const ids = new Set(projects.map((p) => p.id));
  const out: SheetGame[] = [];
  for (const c of getCatalog()) {
    for (const g of c.games) {
      const key = gameKeyOf(c, g);
      const pid = getGameProject(key);
      if (pid && ids.has(pid)) {
        out.push({ gameKey: key, consoleName: c.name, gameTitle: g.title });
      }
    }
  }
  return out;
}

// Load the finished design + its console/global template context for each
// selected game, shaped like a demo card so <CardStage> can render it.
export async function loadSheetCards(gameKeys: string[]): Promise<DemoCard[]> {
  const bgFill = (p?: Project) => {
    const bg = p?.layers.find(isBackground);
    return bg?.visible ? bg.fill : undefined;
  };
  const overlayable = (p?: Project) =>
    (p?.layers ?? []).filter((l) => !l.mainMask && !isBackground(l));

  const globalP = await loadProject(GLOBAL_TEMPLATE_ID);
  const globalBg = bgFill(globalP);
  const mainMask = globalP?.layers.find((l) => l.mainMask && l.visible);
  const globalLayers = overlayable(globalP);

  const meta = new Map<
    string,
    { consoleId: string; consoleName: string; gameTitle: string }
  >();
  for (const c of getCatalog()) {
    for (const g of c.games) {
      meta.set(gameKeyOf(c, g), {
        consoleId: c.id,
        consoleName: c.name,
        gameTitle: g.title,
      });
    }
  }

  const tplCache = new Map<string, Project | undefined>();
  const out: DemoCard[] = [];
  for (const gameKey of gameKeys) {
    const m = meta.get(gameKey);
    const pid = getGameProject(gameKey);
    if (!m || !pid) continue;
    const project = await loadProject(pid);
    if (!project) continue;
    if (!tplCache.has(m.consoleId)) {
      tplCache.set(m.consoleId, await loadProject(templateId(m.consoleId)));
    }
    const consoleP = tplCache.get(m.consoleId);
    out.push({
      key: gameKey,
      consoleName: m.consoleName,
      gameTitle: m.gameTitle,
      project,
      overlay: [...overlayable(consoleP), ...globalLayers],
      consoleBg: bgFill(consoleP),
      globalBg,
      mainMask,
      holo: false,
    });
  }
  return out;
}

export interface SheetOptions {
  gapMM: number; // blank space between the full-bleed cards
  background: "transparent" | "white";
}

export const DEFAULT_SHEET_OPTIONS: SheetOptions = {
  gapMM: 3,
  background: "transparent",
};

export interface SheetPage {
  dataUrl: string;
  cutSvg: string; // matching cut line: one rounded rect (trim edge) per card
  count: number; // cards on this page
  widthMM: number;
  heightMM: number;
}

export interface SheetResult {
  pages: SheetPage[];
  cols: number;
  rows: number;
  perPage: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("image failed to load"));
    img.src = src;
  });
}

// `cardImages` are full-canvas (trim + full bleed) PNGs, one per card.
export async function composeSheet(
  cardImages: string[],
  opts: SheetOptions,
): Promise<SheetResult> {
  if (!cardImages.length) throw new Error("no cards");

  const gap = Math.max(0, opts.gapMM) * PX_PER_MM;
  // Each printed cell is the whole card canvas — trim plus the full bleed on
  // every side, always visible.
  const cellW = CANVAS.w;
  const cellH = CANVAS.h;

  const printW = PRINT_W_MM * PX_PER_MM;
  const printH = PRINT_H_MM * PX_PER_MM;
  const cols = Math.max(0, Math.floor((printW + gap) / (cellW + gap)));
  const rows = Math.max(0, Math.floor((printH + gap) / (cellH + gap)));
  if (cols < 1 || rows < 1) {
    throw new Error("card-too-big");
  }
  const perPage = cols * rows;
  const pageCount = Math.ceil(cardImages.length / perPage);

  const imgs = await Promise.all(cardImages.map(loadImage));
  const pages: SheetPage[] = [];

  // px → mm, 3 decimals.
  const mm = (px: number) => +(px / PX_PER_MM).toFixed(3);
  const trimWmm = mm(TRIM_RECT.w);
  const trimHmm = mm(TRIM_RECT.h);
  const rMm = mm(CORNER_RADIUS_PX);

  for (let p = 0; p < pageCount; p++) {
    const slice = imgs.slice(p * perPage, p * perPage + perPage);
    const pcols = Math.min(cols, slice.length);
    const prows = Math.ceil(slice.length / cols);
    const pageW = Math.round(pcols * cellW + (pcols - 1) * gap);
    const pageH = Math.round(prows * cellH + (prows - 1) * gap);
    const cutRects: string[] = [];

    const canvas = document.createElement("canvas");
    canvas.width = pageW;
    canvas.height = pageH;
    const ctx = canvas.getContext("2d")!;
    if (opts.background === "white") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageW, pageH);
    }

    slice.forEach((img, i) => {
      const cx = (i % cols) * (cellW + gap);
      const cy = Math.floor(i / cols) * (cellH + gap);
      // Print: the full-bleed card, unclipped.
      ctx.drawImage(img, cx, cy, cellW, cellH);
      // Cut: the rounded trim edge inside the bleed.
      cutRects.push(
        `<rect x="${mm(cx + TRIM_RECT.x)}" y="${mm(cy + TRIM_RECT.y)}" ` +
          `width="${trimWmm}" height="${trimHmm}" rx="${rMm}" ry="${rMm}"/>`,
      );
    });

    const pageWmm = mm(pageW);
    const pageHmm = mm(pageH);
    const cutSvg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${pageWmm}mm" height="${pageHmm}mm" ` +
      `viewBox="0 0 ${pageWmm} ${pageHmm}">` +
      `<g fill="none" stroke="#22d3ee" stroke-width="0.2">${cutRects.join("")}</g>` +
      `</svg>`;

    pages.push({
      dataUrl: canvas.toDataURL("image/png"),
      cutSvg,
      count: slice.length,
      widthMM: pageWmm,
      heightMM: pageHmm,
    });
  }

  return { pages, cols, rows, perPage };
}
