// A minimal single-page print PDF for wir-machen-druck.de sticker sheets:
// a full-bleed RGB image plus a vector contour on the "kiss_cut" spot colour
// (100 % magenta), overprinting, as their data guidelines require. No PDF
// library — the file is assembled by hand.

import { zlibSync } from "fflate";
import type { SpotColor } from "./spotColors";

const MM_TO_PT = 72 / 25.4;
const KAPPA = 0.5522847498307936; // circle → cubic-bézier control offset

export interface PdfCutRect {
  xMM: number; // from the top-left of the page (incl. bleed)
  yMM: number;
  wMM: number;
  hMM: number;
  rMM: number; // corner radius
}

// A PDF /Separation name may not contain whitespace or the delimiter
// characters — anything a user might type into the settings field gets
// collapsed to something safe instead of producing a broken file.
function pdfName(name: string): string {
  return name.replace(/[^A-Za-z0-9_.-]+/g, "_").replace(/^$/, "spot");
}

function separationObj(spot: SpotColor): string {
  return (
    `[/Separation /${pdfName(spot.name)} /DeviceCMYK ` +
    `<< /FunctionType 2 /Domain [0 1] /C0 [0 0 0 0] ` +
    `/C1 [${spot.c} ${spot.m} ${spot.y} ${spot.k}] /N 1 >>]`
  );
}

interface PdfOptions {
  imageDataUrl: string; // the composed sheet, PNG, already at physical px size
  widthMM: number; // page size incl. the outer bleed
  heightMM: number;
  bleedMM: number; // outer bleed → TrimBox inset
  cutRects: PdfCutRect[];
}

// wir-machen-druck's standard print condition.
const OI_CONDITION = "ISO Coated v2 300% (ECI)";

// Escape a PDF literal string: (, ) and \ must be backslashed.
const pdfStr = (s: string) => `(${s.replace(/[\\()]/g, "\\$&")})`;

const LOAD_IMG_TIMEOUT_MS = 8000;

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    // A request can end up stuck with neither load nor error ever firing
    // (seen in the packaged app even for a data: URL) — without this, one
    // bad image hangs the whole PDF build forever with no feedback at all.
    const timer = setTimeout(() => {
      rej(new Error("image timed out loading"));
    }, LOAD_IMG_TIMEOUT_MS);
    i.onload = () => {
      clearTimeout(timer);
      res(i);
    };
    i.onerror = () => {
      clearTimeout(timer);
      rej(new Error("image failed to load"));
    };
    i.src = src;
  });
}

// Rounded-rect path operators, bottom-left origin (PDF space).
function roundedRectOps(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  const k = rad * KAPPA;
  const n = (v: number) => v.toFixed(3);
  return (
    `${n(x + rad)} ${n(y)} m ` +
    `${n(x + w - rad)} ${n(y)} l ` +
    `${n(x + w - rad + k)} ${n(y)} ${n(x + w)} ${n(y + rad - k)} ${n(x + w)} ${n(y + rad)} c ` +
    `${n(x + w)} ${n(y + h - rad)} l ` +
    `${n(x + w)} ${n(y + h - rad + k)} ${n(x + w - rad + k)} ${n(y + h)} ${n(x + w - rad)} ${n(y + h)} c ` +
    `${n(x + rad)} ${n(y + h)} l ` +
    `${n(x + rad - k)} ${n(y + h)} ${n(x)} ${n(y + h - rad + k)} ${n(x)} ${n(y + h - rad)} c ` +
    `${n(x)} ${n(y + rad)} l ` +
    `${n(x)} ${n(y + rad - k)} ${n(x + rad - k)} ${n(y)} ${n(x + rad)} ${n(y)} c ` +
    `h S`
  );
}

export async function stickerSheetPdf(opts: PdfOptions): Promise<Blob> {
  // Decode the sheet PNG to raw RGB flattened on white.
  const img = await loadImg(opts.imageDataUrl);
  const cw = img.naturalWidth;
  const ch = img.naturalHeight;
  const cvs = document.createElement("canvas");
  cvs.width = cw;
  cvs.height = ch;
  const ctx = cvs.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, 0, 0);
  const rgba = ctx.getImageData(0, 0, cw, ch).data;
  const rgb = new Uint8Array(cw * ch * 3);
  for (let s = 0, d = 0; s < rgba.length; s += 4, d += 3) {
    rgb[d] = rgba[s];
    rgb[d + 1] = rgba[s + 1];
    rgb[d + 2] = rgba[s + 2];
  }
  const imgStream = zlibSync(rgb, { level: 6 });

  const pageW = opts.widthMM * MM_TO_PT;
  const pageH = opts.heightMM * MM_TO_PT;
  const b = opts.bleedMM * MM_TO_PT;

  // Content: full-page image, then the kiss-cut contour(s).
  const ops: string[] = [
    `q ${pageW.toFixed(3)} 0 0 ${pageH.toFixed(3)} 0 0 cm /Im0 Do Q`,
    `q /GScut gs /CScut CS 1 SCN 0.25 w`,
  ];
  for (const r of opts.cutRects) {
    const x = r.xMM * MM_TO_PT;
    // flip: mm-from-top → pt-from-bottom
    const yBottom = pageH - (r.yMM + r.hMM) * MM_TO_PT;
    ops.push(
      roundedRectOps(
        x,
        yBottom,
        r.wMM * MM_TO_PT,
        r.hMM * MM_TO_PT,
        r.rMM * MM_TO_PT,
      ),
    );
  }
  ops.push("Q");
  const content = new TextEncoder().encode(ops.join("\n"));

  const enc = (s: string) => new TextEncoder().encode(s);
  const box = (x0: number, y0: number, x1: number, y1: number) =>
    `[${x0.toFixed(3)} ${y0.toFixed(3)} ${x1.toFixed(3)} ${y1.toFixed(3)}]`;

  // Output intent (obj 8): names the print condition by its ICC registry
  // entry rather than embedding the profile's own bytes — ECI's ISOcoated_v2
  // profiles may be used/embedded/exchanged freely but not *redistributed*
  // without ECI's written permission, which rules out shipping the file in
  // this repo. The printer maps the name to their own copy instead.
  const outputIntent =
    `<< /Type /OutputIntent /S /GTS_PDFX ` +
    `/OutputConditionIdentifier (FOGRA39) ` +
    `/RegistryName (http://www.color.org) /Info ${pdfStr(OI_CONDITION)} >>`;

  const objects: Uint8Array[] = [
    enc("<< /Type /Catalog /Pages 2 0 R /OutputIntents [8 0 R] >>"),
    enc("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    enc(
      `<< /Type /Page /Parent 2 0 R ` +
        `/MediaBox ${box(0, 0, pageW, pageH)} ` +
        `/BleedBox ${box(0, 0, pageW, pageH)} ` +
        `/TrimBox ${box(b, b, pageW - b, pageH - b)} ` +
        `/Resources << /XObject << /Im0 4 0 R >> ` +
        `/ExtGState << /GScut 5 0 R >> ` +
        `/ColorSpace << /CScut 6 0 R >> >> ` +
        `/Contents 7 0 R >>`,
    ),
    concat(
      enc(
        `<< /Type /XObject /Subtype /Image /Width ${cw} /Height ${ch} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode ` +
          `/Length ${imgStream.length} >>\nstream\n`,
      ),
      imgStream,
      enc("\nendstream"),
    ),
    enc("<< /Type /ExtGState /OP true /op true /OPM 1 >>"),
    // Fixed, not user-configurable: this is wir-machen-druck's own required
    // spot name and tint, not the cover PDF's configurable cut/score lines.
    enc(separationObj({ name: "kiss_cut", c: 0, m: 1, y: 0, k: 0 })),
    concat(
      enc(`<< /Length ${content.length} >>\nstream\n`),
      content,
      enc("\nendstream"),
    ),
    enc(outputIntent),
  ];

  return buildPdf(objects);
}

// ── plain card-tray PDF ─────────────────────────────────────────────────────
// One page per face, no colour management. Meant for printing straight onto
// a blank card through a printer's own disc/card tray (e.g. Canon's "Disc
// Tray G/J/K/M" or "MP Tray" media): the tray is usually much bigger than
// the card itself, so the page is the *tray's* media size, with the card
// drawn at whatever offset that tray places it — everything else on the
// page stays white. Print at "actual size / 100 %" with the matching media
// picked in the print dialog — never "fit to page", which would rescale it.
// A straight score/fold line — one or more vertical cuts at fixed x
// positions, spanning the same y range (a wrap format's panel boundaries
// all run the card's full height).
export interface PdfScoreLines {
  xsMM: number[];
  yMM: number;
  hMM: number;
}

export interface CardPdfPage {
  imageDataUrl: string; // the face, already at physical px size (no bleed)
  cardWidthMM: number;
  cardHeightMM: number;
  // The full tray media page, and where the card's top-left corner sits on
  // it. Defaults to the card's own size at (0, 0) — i.e. no tray margin —
  // when omitted, so a page-less caller still gets a plain card-sized page.
  pageWidthMM?: number;
  pageHeightMM?: number;
  offsetXMM?: number;
  offsetYMM?: number;
  // Optional vector marks, page-relative mm, each on its own configurable
  // spot colour — for a page that needs trimming/folding after print,
  // unlike the tray use case this file was originally built for.
  cutRect?: PdfCutRect;
  cutSpot?: SpotColor;
  scoreLines?: PdfScoreLines;
  scoreSpot?: SpotColor;
}

export async function cardTrayPdf(pages: CardPdfPage[]): Promise<Blob> {
  if (!pages.length) throw new Error("cardTrayPdf: no pages");
  const enc = (s: string) => new TextEncoder().encode(s);
  const box = (x0: number, y0: number, x1: number, y1: number) =>
    `[${x0.toFixed(3)} ${y0.toFixed(3)} ${x1.toFixed(3)} ${y1.toFixed(3)}]`;

  // obj 1 = Catalog, obj 2 = Pages; each face after that is 3 objects
  // (Page, Image, Content), filled in as they're rendered.
  const objects: Uint8Array[] = [enc(""), enc("")];
  const kids: string[] = [];

  // Shared across every page that has a cut/score mark, added once up
  // front so their object numbers are fixed before the per-page loop below
  // (which numbers its own objects off objects.length as it goes). The
  // overprint ExtGState doesn't reference a colour, so cut and score marks
  // share the same one; each spot colour still gets its own /Separation.
  const anyCut = pages.some((p) => p.cutRect);
  const anyScore = pages.some((p) => p.scoreLines);
  let gsNum = 0;
  let cutCsNum = 0;
  let scoreCsNum = 0;
  if (anyCut || anyScore) {
    gsNum = objects.length + 1;
    objects.push(enc("<< /Type /ExtGState /OP true /op true /OPM 1 >>"));
  }
  if (anyCut) {
    cutCsNum = objects.length + 1;
    const spot = pages.find((p) => p.cutRect)!.cutSpot ?? {
      name: "kiss_cut",
      c: 0,
      m: 1,
      y: 0,
      k: 0,
    };
    objects.push(enc(separationObj(spot)));
  }
  if (anyScore) {
    scoreCsNum = objects.length + 1;
    const spot = pages.find((p) => p.scoreLines)!.scoreSpot ?? {
      name: "kiss_score",
      c: 1,
      m: 0,
      y: 0,
      k: 0,
    };
    objects.push(enc(separationObj(spot)));
  }

  for (const p of pages) {
    const img = await loadImg(p.imageDataUrl);
    const cw = img.naturalWidth;
    const ch = img.naturalHeight;
    const cvs = document.createElement("canvas");
    cvs.width = cw;
    cvs.height = ch;
    const ctx = cvs.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0);
    const rgba = ctx.getImageData(0, 0, cw, ch).data;
    const rgb = new Uint8Array(cw * ch * 3);
    for (let s = 0, d = 0; s < rgba.length; s += 4, d += 3) {
      rgb[d] = rgba[s];
      rgb[d + 1] = rgba[s + 1];
      rgb[d + 2] = rgba[s + 2];
    }
    const imgStream = zlibSync(rgb, { level: 6 });

    const pageWMM = p.pageWidthMM ?? p.cardWidthMM;
    const pageHMM = p.pageHeightMM ?? p.cardHeightMM;
    const offXMM = p.offsetXMM ?? 0;
    const offYMM = p.offsetYMM ?? 0;

    const pageW = pageWMM * MM_TO_PT;
    const pageH = pageHMM * MM_TO_PT;
    const cardW = p.cardWidthMM * MM_TO_PT;
    const cardH = p.cardHeightMM * MM_TO_PT;
    const x = offXMM * MM_TO_PT;
    // flip: mm-from-top-left of the page → pt-from-bottom (PDF space)
    const y = pageH - (offYMM * MM_TO_PT + cardH);

    const pageNum = objects.length + 1;
    const imageNum = pageNum + 1;
    const contentNum = pageNum + 2;
    kids.push(`${pageNum} 0 R`);

    let contentStr = `q ${cardW.toFixed(3)} 0 0 ${cardH.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm /Im0 Do Q`;
    let resources = `/XObject << /Im0 ${imageNum} 0 R >>`;
    const colorSpaces: string[] = [];
    if (p.cutRect) {
      const r = p.cutRect;
      const rx = r.xMM * MM_TO_PT;
      const ryBottom = pageH - (r.yMM + r.hMM) * MM_TO_PT;
      contentStr +=
        `\nq /GS0 gs /CScut CS 1 SCN 0.25 w ` +
        roundedRectOps(rx, ryBottom, r.wMM * MM_TO_PT, r.hMM * MM_TO_PT, r.rMM * MM_TO_PT) +
        ` Q`;
      colorSpaces.push(`/CScut ${cutCsNum} 0 R`);
    }
    if (p.scoreLines) {
      const s = p.scoreLines;
      const yTop = pageH - s.yMM * MM_TO_PT;
      const yBottom = pageH - (s.yMM + s.hMM) * MM_TO_PT;
      let ops = "q /GS0 gs /CSscore CS 1 SCN 0.25 w";
      for (const xMM of s.xsMM) {
        const lx = (xMM * MM_TO_PT).toFixed(3);
        ops += ` ${lx} ${yTop.toFixed(3)} m ${lx} ${yBottom.toFixed(3)} l S`;
      }
      ops += " Q";
      contentStr += `\n${ops}`;
      colorSpaces.push(`/CSscore ${scoreCsNum} 0 R`);
    }
    if (p.cutRect || p.scoreLines) resources += ` /ExtGState << /GS0 ${gsNum} 0 R >>`;
    if (colorSpaces.length) resources += ` /ColorSpace << ${colorSpaces.join(" ")} >>`;
    const content = enc(contentStr);

    objects.push(
      enc(
        `<< /Type /Page /Parent 2 0 R /MediaBox ${box(0, 0, pageW, pageH)} ` +
          `/Resources << ${resources} >> ` +
          `/Contents ${contentNum} 0 R >>`,
      ),
      concat(
        enc(
          `<< /Type /XObject /Subtype /Image /Width ${cw} /Height ${ch} ` +
            `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode ` +
            `/Length ${imgStream.length} >>\nstream\n`,
        ),
        imgStream,
        enc("\nendstream"),
      ),
      concat(enc(`<< /Length ${content.length} >>\nstream\n`), content, enc("\nendstream")),
    );
  }

  objects[0] = enc("<< /Type /Catalog /Pages 2 0 R >>");
  objects[1] = enc(`<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`);

  return buildPdf(objects);
}

// Assembles a cross-reference table + trailer around already-built indirect
// objects (1-indexed, in order) and returns the finished file. The header's
// binary comment must be raw high bytes, so it's built directly.
function buildPdf(objects: Uint8Array[]): Blob {
  const enc = (s: string) => new TextEncoder().encode(s);
  const header = Uint8Array.from([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35, 0x0a, // %PDF-1.5\n
    0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a, // %<bin>\n
  ]);
  const chunks: Uint8Array[] = [header];
  let offset = header.length;
  const xref: number[] = [];
  objects.forEach((body, i) => {
    xref.push(offset);
    const open = enc(`${i + 1} 0 obj\n`);
    const close = enc("\nendobj\n");
    chunks.push(open, body, close);
    offset += open.length + body.length + close.length;
  });

  const xrefStart = offset;
  let xrefStr = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of xref) {
    xrefStr += `${o.toString().padStart(10, "0")} 00000 n \n`;
  }
  xrefStr +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefStart}\n%%EOF`;
  chunks.push(enc(xrefStr));

  return new Blob([concat(...chunks)], { type: "application/pdf" });
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(new ArrayBuffer(total));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
