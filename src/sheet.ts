// "Cut sheet": several finished card designs packed onto one PNG at physical
// 300 DPI size — each card printed full-bleed (a rectangle), spaced apart —
// plus a matching SVG whose rounded paths cut each card at its trim edge.
// Paginated to the Cricut Explore Print-then-Cut area.

import { BLEED_PX, CANVAS, CORNER_RADIUS_PX, PX_PER_MM, TRIM_RECT } from "./card";
import { gameKeyOf, getCatalog } from "./data/catalog";
import { GLOBAL_TEMPLATE_ID, isBackground, templateId } from "./factory";
import { backgroundFillOverride } from "./fillOverrides";
import { buildOverlay } from "./faceLayers";
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
  // A console's / a card's own pick for an ancestor's editableFill shape or
  // background — see src/fillOverrides.ts.
  const bgFill = (p?: Project, descendant?: Project) => {
    const bg = p?.layers.find(isBackground);
    return bg?.visible ? backgroundFillOverride(bg, descendant) : undefined;
  };
  const globalP = await loadProject(GLOBAL_TEMPLATE_ID);
  const globalMasks = alphaMasksOf(globalP);

  const meta = new Map<
    string,
    { consoleId: string; consoleName: string; gameTitle: string; index: number; count: number }
  >();
  for (const c of getCatalog()) {
    for (const [index, g] of c.games.entries()) {
      meta.set(gameKeyOf(c, g), {
        consoleId: c.id,
        consoleName: c.name,
        gameTitle: g.title,
        index,
        count: c.games.length,
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
      overlay: buildOverlay(consoleP, project, globalP, consoleP, {
        index: m.index,
        count: m.count,
      }),
      consoleBg: bgFill(consoleP, project),
      globalBg: bgFill(globalP, consoleP),
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

export type SheetTarget = "cricut" | "wmd" | "a4" | "letter";

// Plain paper sheets for an office printer: the page is the whole sheet,
// the cards sit centred inside a margin the printer can reach.
export const PAPER = {
  a4: { wMM: 210, hMM: 297 },
  letter: { wMM: 215.9, hMM: 279.4 },
} as const;
export const isPaper = (t: SheetTarget): t is keyof typeof PAPER => t === "a4" || t === "letter";

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
  // Paper sheets only: unprinted border on every side.
  marginMM: number;
  // Paper sheets only: which way the page lies. "auto" takes whichever fits
  // more cards (or, with a fixed grid, the one the grid fits on).
  orientation: "auto" | "portrait" | "landscape";
  // Paper sheets only: a fixed grid — e.g. 5 × 2 on US Letter — instead of
  // as many cards as fit. Cards then sit at their trim size, `gapMM` apart;
  // each one's bleed is only printed as far as that gap leaves room for.
  grid: { cols: number; rows: number } | null;
}

export const DEFAULT_SHEET_OPTIONS: SheetOptions = {
  gapMM: 3,
  background: "transparent",
  target: "cricut",
  cropMarks: false,
  backs: false,
  duplexXMM: 0,
  duplexYMM: 0,
  marginMM: 8,
  orientation: "auto",
  grid: null,
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

export interface PaperPlan {
  orientation: "portrait" | "landscape";
  pageWMM: number;
  pageHMM: number;
  cols: number;
  rows: number;
}

export interface PaperPlanResult {
  plan?: PaperPlan;
  // For a fixed grid that doesn't fit: what it needs vs. what the page
  // (in the best orientation) leaves inside the margin, in mm.
  need?: { w: number; h: number };
  avail?: { w: number; h: number };
  // The widest margin (mm) at which the grid would fit — absent when even a
  // margin of 0 isn't enough.
  maxMargin?: number;
}

/**
 * How cards are laid out on a paper sheet: the orientation and the grid.
 * `plan` is absent when nothing fits — the card is bigger than the printable
 * area, or the fixed grid doesn't fit in either allowed orientation.
 */
export function planPaperSheet(opts: SheetOptions): PaperPlanResult {
  if (!isPaper(opts.target)) return {};
  const paper = PAPER[opts.target];
  const gap = Math.max(0, opts.gapMM);
  const margin = Math.max(0, opts.marginMM);
  const trimW = TRIM_RECT.w / PX_PER_MM;
  const trimH = TRIM_RECT.h / PX_PER_MM;
  const cellW = CANVAS.w / PX_PER_MM;
  const cellH = CANVAS.h / PX_PER_MM;
  const orients: ("portrait" | "landscape")[] =
    opts.orientation === "auto" ? ["portrait", "landscape"] : [opts.orientation];
  const eps = 0.01;

  const tries = orients.map((o) => {
    const pageWMM = o === "portrait" ? paper.wMM : paper.hMM;
    const pageHMM = o === "portrait" ? paper.hMM : paper.wMM;
    const availW = pageWMM - 2 * margin;
    const availH = pageHMM - 2 * margin;
    if (opts.grid) {
      const cols = Math.max(1, Math.round(opts.grid.cols));
      const rows = Math.max(1, Math.round(opts.grid.rows));
      const needW = cols * trimW + (cols - 1) * gap;
      const needH = rows * trimH + (rows - 1) * gap;
      const fits = needW <= availW + eps && needH <= availH + eps;
      return { o, pageWMM, pageHMM, cols, rows, fits, needW, needH, availW, availH };
    }
    const cols = Math.floor((availW + gap) / (cellW + gap) + eps);
    const rows = Math.floor((availH + gap) / (cellH + gap) + eps);
    return { o, pageWMM, pageHMM, cols, rows, fits: cols >= 1 && rows >= 1, needW: cellW, needH: cellH, availW, availH };
  });

  // Most cards wins; a tie keeps portrait (it comes first).
  const best = tries
    .filter((x) => x.fits)
    .reduce<(typeof tries)[number] | undefined>(
      (a, x) => (!a || x.cols * x.rows > a.cols * a.rows ? x : a),
      undefined,
    );
  if (best) {
    return {
      plan: { orientation: best.o, pageWMM: best.pageWMM, pageHMM: best.pageHMM, cols: best.cols, rows: best.rows },
    };
  }
  // Nothing fits: report against the orientation it comes closest to fitting.
  const closeness = (x: (typeof tries)[number]) => Math.min(x.availW / x.needW, x.availH / x.needH);
  const roomiest = tries.reduce((a, x) => (closeness(x) > closeness(a) ? x : a));
  const maxMargin = Math.max(
    ...tries.map((x) => Math.min((x.pageWMM - x.needW) / 2, (x.pageHMM - x.needH) / 2)),
  );
  return {
    need: { w: roomiest.needW, h: roomiest.needH },
    avail: { w: roomiest.availW, h: roomiest.availH },
    maxMargin: maxMargin >= 0 ? Math.floor(maxMargin * 10) / 10 : undefined,
  };
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
  const paper = isPaper(opts.target) ? PAPER[opts.target] : null;
  const paperPlan = paper ? planPaperSheet(opts).plan : undefined;
  if (paper && !paperPlan) throw new Error(opts.grid ? "grid-too-big" : "card-too-big");
  // A fixed grid puts the cards at their trim size, not the full-bleed cell.
  const gridMode = !!paper && !!opts.grid;
  const gap = Math.max(0, opts.gapMM) * PX_PER_MM;
  // Each printed cell is the whole card canvas — trim plus the full bleed on
  // every side, always visible.
  const cellW = CANVAS.w;
  const cellH = CANVAS.h;
  // The sheet's margin: the wmd outer bleed, or room for the crop marks.
  const outerBleed = paper
    ? Math.max(0, opts.marginMM) * PX_PER_MM
    : wmd
      ? WMD_BLEED_MM * PX_PER_MM
      : opts.cropMarks
        ? MARK_MARGIN_MM * PX_PER_MM
        : 0;
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
  } else if (paperPlan) {
    cols = paperPlan.cols;
    rows = paperPlan.rows;
    perPage = cols * rows;
    pageCount = Math.ceil(cardImages.length / perPage);
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
    // A paper page is the whole sheet with the full grid centred on it — the
    // same spots on every page, even a half-empty last one. Otherwise the
    // page hugs the cards.
    const pcols = paper ? cols : Math.min(cols, slice.length);
    const prows = paper ? rows : Math.ceil(slice.length / pcols);
    const unitW = gridMode ? TRIM_RECT.w : cellW;
    const unitH = gridMode ? TRIM_RECT.h : cellH;
    const gridW = pcols * unitW + (pcols - 1) * gap;
    const gridH = prows * unitH + (prows - 1) * gap;
    const pageW = paperPlan ? Math.round(paperPlan.pageWMM * PX_PER_MM) : Math.round(gridW + outerBleed * 2);
    const pageH = paperPlan ? Math.round(paperPlan.pageHMM * PX_PER_MM) : Math.round(gridH + outerBleed * 2);
    const originX = paper ? Math.round((pageW - gridW) / 2) : outerBleed;
    const originY = paper ? Math.round((pageH - gridH) / 2) : outerBleed;
    const cutRects: CutRect[] = [];

    const canvas = document.createElement("canvas");
    canvas.width = pageW;
    canvas.height = pageH;
    const ctx = canvas.getContext("2d")!;
    if (whiteBg) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageW, pageH);
    }

    // Top-left of card i's full-bleed canvas. In a fixed grid it's the trim
    // that sits on the grid, so the canvas starts that far up and to the left.
    const cellPos = (i: number) => ({
      cx: originX + (i % pcols) * (unitW + gap) - (gridMode ? TRIM_RECT.x : 0),
      cy: originY + Math.floor(i / pcols) * (unitH + gap) - (gridMode ? TRIM_RECT.y : 0),
    });
    // One card's picture: whole when it has its own cell, in a fixed grid
    // clipped to its trim plus as much bleed as the gap leaves room for.
    const bleedExt = Math.min(BLEED_PX, gap / 2);
    const drawCard = (c: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number) => {
      if (!gridMode) {
        c.drawImage(img, x, y, cellW, cellH);
        return;
      }
      c.save();
      c.beginPath();
      c.rect(x + TRIM_RECT.x - bleedExt, y + TRIM_RECT.y - bleedExt, TRIM_RECT.w + 2 * bleedExt, TRIM_RECT.h + 2 * bleedExt);
      c.clip();
      c.drawImage(img, x, y, cellW, cellH);
      c.restore();
    };
    slice.forEach((img, i) => {
      const { cx, cy } = cellPos(i);
      drawCard(ctx, img, cx, cy);
      // Cut: the rounded trim edge inside the bleed.
      cutRects.push({
        xMM: mm(cx + TRIM_RECT.x),
        yMM: mm(cy + TRIM_RECT.y),
        wMM: trimWmm,
        hMM: trimHmm,
        rMM: rMm,
      });
    });
    const grid = { l: originX, t: originY, r: originX + gridW, b: originY + gridH };
    if (opts.cropMarks) {
      if (gridMode) drawGridMarks(ctx, slice.length, pcols, originX, originY, gap, pageW, pageH);
      else drawCropMarks(ctx, slice.length, cellPos, cellW, cellH, gap, grid, pageW, pageH);
    }

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
        drawCard(bctx, back, pageW - cx - cellW + dx, cy + dy);
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
  // The grid's outer edges: a mark beyond them may reach the sheet's edge.
  grid: { l: number; t: number; r: number; b: number },
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
    const lRoom = room(cx, cx <= grid.l + 0.5 ? 0 : cx - gap);
    const rRoom = room(cx + cellW, cx + cellW >= grid.r - 0.5 ? pageW : cx + cellW + gap);
    const tRoom = room(cy, cy <= grid.t + 0.5 ? 0 : cy - gap);
    const bRoom = room(cy + cellH, cy + cellH >= grid.b - 0.5 ? pageH : cy + cellH + gap);
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

// Crop marks for a fixed grid of cards sitting at their trim size: ticks in
// the page margin only, lined up with every column's left / right trim edge
// (above and below the grid) and every row's top / bottom edge (left and
// right of it) — between the cards there's no room for any.
function drawGridMarks(
  ctx: CanvasRenderingContext2D,
  count: number,
  pcols: number,
  originX: number,
  originY: number,
  gap: number,
  pageW: number,
  pageH: number,
): void {
  const colsUsed = Math.min(pcols, count);
  const rowsUsed = Math.ceil(count / pcols);
  const right = originX + colsUsed * TRIM_RECT.w + (colsUsed - 1) * gap;
  const bottom = originY + rowsUsed * TRIM_RECT.h + (rowsUsed - 1) * gap;
  const off = MARK_GAP_MM * PX_PER_MM;
  // As long as the margin allows, up to the usual length.
  const room = Math.min(originX, originY, pageW - right, pageH - bottom) - off;
  const len = Math.min(MARK_LEN_MM * PX_PER_MM, room);
  if (len < 1 * PX_PER_MM) return; // no margin to speak of
  ctx.save();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = Math.max(1, 0.15 * PX_PER_MM);
  ctx.beginPath();
  for (let c = 0; c < colsUsed; c++) {
    const x1 = originX + c * (TRIM_RECT.w + gap);
    for (const x of [x1, x1 + TRIM_RECT.w]) {
      ctx.moveTo(x, originY - off);
      ctx.lineTo(x, originY - off - len);
      ctx.moveTo(x, bottom + off);
      ctx.lineTo(x, bottom + off + len);
    }
  }
  for (let r = 0; r < rowsUsed; r++) {
    const y1 = originY + r * (TRIM_RECT.h + gap);
    for (const y of [y1, y1 + TRIM_RECT.h]) {
      ctx.moveTo(originX - off, y);
      ctx.lineTo(originX - off - len, y);
      ctx.moveTo(right + off, y);
      ctx.lineTo(right + off + len, y);
    }
  }
  ctx.stroke();
  ctx.restore();
}
