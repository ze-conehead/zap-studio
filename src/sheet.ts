// "Cut sheet": several finished card designs packed onto one PNG at physical
// 300 DPI size — each card printed full-bleed (a rectangle), spaced apart —
// plus a matching SVG whose rounded paths cut each card at its trim edge.
// Paginated to the Cricut Explore Print-then-Cut area.

import { CANVAS, CORNER_RADIUS_PX, PX_PER_MM, TRIM_RECT } from "./card";
import { gameKeyOf, getCatalog } from "./data/catalog";
import { GLOBAL_TEMPLATE_ID, isBackground, templateId } from "./factory";
import { getGameProject } from "./gameIndex";
import { loadAllProjects, loadProject } from "./persist";
import { alphaMasksOf } from "./templates";
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
    (p?.layers ?? []).filter(
      (l) => !l.logoSlot && !isBackground(l), // alpha masks stay: they mark where a card's image slots in
    );

  const globalP = await loadProject(GLOBAL_TEMPLATE_ID);
  const globalBg = bgFill(globalP);
  const globalMasks = alphaMasksOf(globalP);
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
      masks: [...globalMasks, ...alphaMasksOf(consoleP)],
      // Own back, else the console template's, else the global one's —
      // same fallback as the overview. The cut sheet ignores it; the
      // all-cards export renders it as a second file.
      back: project.back ?? consoleP?.back ?? globalP?.back,
      holo: false,
    });
  }
  return out;
}

export type SheetTarget = "cricut" | "wmd";

// Outer bleed added around the whole wir-machen-druck sheet.
export const WMD_BLEED_MM = 2;

export interface SheetOptions {
  gapMM: number; // blank space between the full-bleed cards
  background: "transparent" | "white";
  target: SheetTarget;
  // Printed crop marks at every trim corner, in the gaps and a margin
  // around the sheet — for cutting by hand or at a print shop.
  cropMarks: boolean;
  // A second sheet per page with the cards' back faces, mirrored so a
  // long-edge duplex print lands each back behind its front …
  backs: boolean;
  // … shifted by this much (mm) to cancel the printer's duplex offset.
  duplexXMM: number;
  duplexYMM: number;
}

export const DEFAULT_SHEET_OPTIONS: SheetOptions = {
  gapMM: 3,
  background: "transparent",
  target: "cricut",
  cropMarks: false,
  backs: false,
  duplexXMM: 0,
  duplexYMM: 0,
};

// Crop marks: this long, this far off the bleed edge; the sheet gets this
// much margin so the outer cards get theirs too.
export const MARK_LEN_MM = 3;
export const MARK_GAP_MM = 0.5;
export const MARK_MARGIN_MM = MARK_LEN_MM + MARK_GAP_MM + 1;

export interface CutRect {
  xMM: number; // from the page's top-left (incl. outer bleed)
  yMM: number;
  wMM: number;
  hMM: number;
  rMM: number;
}

export interface SheetPage {
  dataUrl: string;
  backDataUrl?: string; // the mirrored back sheet, when asked for
  cutSvg: string; // matching cut line: one rounded rect (trim edge) per card
  cutRects: CutRect[];
  // Bounding box of the whole cut line, measured from the page's top-left.
  // `xMM` / `yMM` are the margin to leave to the left of / above the cut line
  // so it lines up with the image.
  cutBox: { xMM: number; yMM: number; wMM: number; hMM: number };
  bleedMM: number; // outer sheet bleed (wir-machen-druck) / 0 for Cricut
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

// `cardImages` are full-canvas (trim + full bleed) PNGs, one per card;
// `backImages` (same order, "" for a card without a back) feed the back
// sheets when opts.backs is on.
export async function composeSheet(
  cardImages: string[],
  opts: SheetOptions,
  backImages: string[] = [],
): Promise<SheetResult> {
  if (!cardImages.length) throw new Error("no cards");

  const wmd = opts.target === "wmd";
  const gap = Math.max(0, opts.gapMM) * PX_PER_MM;
  // Each printed cell is the whole card canvas — trim plus the full bleed on
  // every side, always visible.
  const cellW = CANVAS.w;
  const cellH = CANVAS.h;
  // The sheet's margin: the wmd outer bleed, or room for the crop marks.
  const outerBleed = wmd ? WMD_BLEED_MM * PX_PER_MM : opts.cropMarks ? MARK_MARGIN_MM * PX_PER_MM : 0;
  const whiteBg = wmd || opts.background === "white";

  let cols: number;
  let rows: number;
  let perPage: number;
  let pageCount: number;
  if (wmd) {
    // One sheet, free size — a roughly square grid of every card.
    cols = Math.max(1, Math.ceil(Math.sqrt(cardImages.length)));
    rows = Math.ceil(cardImages.length / cols);
    perPage = cardImages.length;
    pageCount = 1;
  } else {
    const printW = PRINT_W_MM * PX_PER_MM - outerBleed * 2;
    const printH = PRINT_H_MM * PX_PER_MM - outerBleed * 2;
    cols = Math.floor((printW + gap) / (cellW + gap));
    rows = Math.floor((printH + gap) / (cellH + gap));
    if (cols < 1 || rows < 1) throw new Error("card-too-big");
    perPage = cols * rows;
    pageCount = Math.ceil(cardImages.length / perPage);
  }

  const imgs = await Promise.all(cardImages.map(loadImage));
  const backs = opts.backs
    ? await Promise.all(backImages.map((src) => (src ? loadImage(src) : Promise.resolve(null))))
    : [];
  const pages: SheetPage[] = [];

  // px → mm, 3 decimals.
  const mm = (px: number) => +(px / PX_PER_MM).toFixed(3);
  const trimWmm = mm(TRIM_RECT.w);
  const trimHmm = mm(TRIM_RECT.h);
  const rMm = mm(CORNER_RADIUS_PX);

  for (let p = 0; p < pageCount; p++) {
    const slice = imgs.slice(p * perPage, p * perPage + perPage);
    const pcols = Math.min(cols, slice.length);
    const prows = Math.ceil(slice.length / pcols);
    const pageW = Math.round(pcols * cellW + (pcols - 1) * gap + outerBleed * 2);
    const pageH = Math.round(prows * cellH + (prows - 1) * gap + outerBleed * 2);
    const cutRects: CutRect[] = [];

    const canvas = document.createElement("canvas");
    canvas.width = pageW;
    canvas.height = pageH;
    const ctx = canvas.getContext("2d")!;
    if (whiteBg) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageW, pageH);
    }

    const cellPos = (i: number) => ({
      cx: outerBleed + (i % pcols) * (cellW + gap),
      cy: outerBleed + Math.floor(i / pcols) * (cellH + gap),
    });
    slice.forEach((img, i) => {
      const { cx, cy } = cellPos(i);
      // Print: the full-bleed card, unclipped.
      ctx.drawImage(img, cx, cy, cellW, cellH);
      // Cut: the rounded trim edge inside the bleed.
      cutRects.push({
        xMM: mm(cx + TRIM_RECT.x),
        yMM: mm(cy + TRIM_RECT.y),
        wMM: trimWmm,
        hMM: trimHmm,
        rMM: rMm,
      });
    });
    if (opts.cropMarks) drawCropMarks(ctx, slice.length, cellPos, cellW, cellH, gap, outerBleed, pageW, pageH);

    // The back sheet: the same grid mirrored left ↔ right (a long-edge
    // duplex flip), each back nudged by the duplex offset. No marks — the
    // front's marks are what gets cut.
    let backDataUrl: string | undefined;
    if (opts.backs) {
      const bc = document.createElement("canvas");
      bc.width = pageW;
      bc.height = pageH;
      const bctx = bc.getContext("2d")!;
      if (whiteBg) {
        bctx.fillStyle = "#ffffff";
        bctx.fillRect(0, 0, pageW, pageH);
      }
      const dx = opts.duplexXMM * PX_PER_MM;
      const dy = opts.duplexYMM * PX_PER_MM;
      slice.forEach((_, i) => {
        const back = backs[p * perPage + i];
        if (!back) return;
        const { cx, cy } = cellPos(i);
        bctx.drawImage(back, pageW - cx - cellW + dx, cy + dy, cellW, cellH);
      });
      backDataUrl = bc.toDataURL("image/png");
    }

    const cutMinX = Math.min(...cutRects.map((r) => r.xMM));
    const cutMinY = Math.min(...cutRects.map((r) => r.yMM));
    const cutMaxX = Math.max(...cutRects.map((r) => r.xMM + r.wMM));
    const cutMaxY = Math.max(...cutRects.map((r) => r.yMM + r.hMM));
    const cutBox = {
      xMM: +cutMinX.toFixed(3),
      yMM: +cutMinY.toFixed(3),
      wMM: +(cutMaxX - cutMinX).toFixed(3),
      hMM: +(cutMaxY - cutMinY).toFixed(3),
    };

    const pageWmm = mm(pageW);
    const pageHmm = mm(pageH);
    const cutSvg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${pageWmm}mm" height="${pageHmm}mm" ` +
      `viewBox="0 0 ${pageWmm} ${pageHmm}">` +
      `<g fill="none" stroke="#22d3ee" stroke-width="0.2">` +
      cutRects
        .map(
          (r) =>
            `<rect x="${r.xMM}" y="${r.yMM}" width="${r.wMM}" height="${r.hMM}" rx="${r.rMM}" ry="${r.rMM}"/>`,
        )
        .join("") +
      `</g></svg>`;

    pages.push({
      dataUrl: canvas.toDataURL("image/png"),
      backDataUrl,
      cutSvg,
      cutRects,
      cutBox,
      bleedMM: mm(outerBleed),
      count: slice.length,
      widthMM: pageWmm,
      heightMM: pageHmm,
    });
  }

  return { pages, cols, rows, perPage };
}

// Short lines at every trim corner, pointing away from the card along the
// trim edges, kept out of the neighbours' bleed: each mark is as long as
// the room beside it allows (the gap between cells, the sheet margin).
function drawCropMarks(
  ctx: CanvasRenderingContext2D,
  count: number,
  cellPos: (i: number) => { cx: number; cy: number },
  cellW: number,
  cellH: number,
  gap: number,
  margin: number,
  pageW: number,
  pageH: number,
): void {
  const len = MARK_LEN_MM * PX_PER_MM;
  const off = MARK_GAP_MM * PX_PER_MM;
  ctx.save();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = Math.max(1, 0.15 * PX_PER_MM);
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  for (let i = 0; i < count; i++) {
    const { cx, cy } = cellPos(i);
    const left = cx + TRIM_RECT.x;
    const right = cx + TRIM_RECT.x + TRIM_RECT.w;
    const top = cy + TRIM_RECT.y;
    const bottom = cy + TRIM_RECT.y + TRIM_RECT.h;
    // Room beyond the bleed on each side: the margin at the sheet edge,
    // else the gap to the next cell.
    const room = (edge: number, limit: number) => Math.max(0, Math.min(len, Math.abs(limit - edge) - off));
    const lRoom = room(cx, cx <= margin + 0.5 ? 0 : cx - gap);
    const rRoom = room(cx + cellW, cx + cellW >= pageW - margin - 0.5 ? pageW : cx + cellW + gap);
    const tRoom = room(cy, cy <= margin + 0.5 ? 0 : cy - gap);
    const bRoom = room(cy + cellH, cy + cellH >= pageH - margin - 0.5 ? pageH : cy + cellH + gap);
    const minLen = 1 * PX_PER_MM;
    // Horizontal marks (along the top / bottom trim line), left and right.
    if (lRoom >= minLen) {
      line(cx - off, top, cx - off - lRoom, top);
      line(cx - off, bottom, cx - off - lRoom, bottom);
    }
    if (rRoom >= minLen) {
      line(cx + cellW + off, top, cx + cellW + off + rRoom, top);
      line(cx + cellW + off, bottom, cx + cellW + off + rRoom, bottom);
    }
    // Vertical marks (along the left / right trim line), top and bottom.
    if (tRoom >= minLen) {
      line(left, cy - off, left, cy - off - tRoom);
      line(right, cy - off, right, cy - off - tRoom);
    }
    if (bRoom >= minLen) {
      line(left, cy + cellH + off, left, cy + cellH + off + bRoom);
      line(right, cy + cellH + off, right, cy + cellH + off + bRoom);
    }
  }
  ctx.restore();
}
