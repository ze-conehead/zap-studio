// A minimal single-page print PDF for wir-machen-druck.de sticker sheets:
// a full-bleed RGB image plus a vector contour on the "kiss_cut" spot colour
// (100 % magenta), overprinting, as their data guidelines require. No PDF
// library — the file is assembled by hand.

import { zlibSync } from "fflate";
import isoCoatedUrl from "./assets/ISOcoated_v2_300_eci.icc?url";

const MM_TO_PT = 72 / 25.4;
const KAPPA = 0.5522847498307936; // circle → cubic-bézier control offset

export interface PdfCutRect {
  xMM: number; // from the top-left of the page (incl. bleed)
  yMM: number;
  wMM: number;
  hMM: number;
  rMM: number; // corner radius
}

interface PdfOptions {
  imageDataUrl: string; // the composed sheet, PNG, already at physical px size
  widthMM: number; // page size incl. the outer bleed
  heightMM: number;
  bleedMM: number; // outer bleed → TrimBox inset
  cutRects: PdfCutRect[];
  // Raw ISOcoated_v2_300_eci.icc bytes. When given, the profile is embedded as
  // the page's output intent (PDF/X-3 style); otherwise the output intent only
  // names the condition and the printer converts RGB to it.
  iccProfile?: Uint8Array;
}

// wir-machen-druck's standard print condition.
const OI_CONDITION = "ISO Coated v2 300% (ECI)";

// Escape a PDF literal string: (, ) and \ must be backslashed.
const pdfStr = (s: string) => `(${s.replace(/[\\()]/g, "\\$&")})`;

// The bundled ISOcoated_v2_300_eci profile (src/assets/). Returns null only if
// the fetch somehow fails or the file is not a valid ICC profile.
export async function loadIsoCoatedProfile(): Promise<Uint8Array | null> {
  try {
    const res = await fetch(isoCoatedUrl);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    // An ICC profile carries the signature "acsp" at byte offset 36.
    const sig = String.fromCharCode(...bytes.slice(36, 40));
    return bytes.length > 128 && sig === "acsp" ? bytes : null;
  } catch {
    return null;
  }
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("image failed to load"));
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

  // Output intent (obj 8), plus the embedded ICC profile (obj 9) when supplied.
  const icc = opts.iccProfile;
  const iccStream = icc ? zlibSync(icc, { level: 6 }) : null;
  const outputIntent = iccStream
    ? `<< /Type /OutputIntent /S /GTS_PDFX ` +
      `/OutputConditionIdentifier ${pdfStr(OI_CONDITION)} ` +
      `/Info ${pdfStr(OI_CONDITION)} /DestOutputProfile 9 0 R >>`
    : `<< /Type /OutputIntent /S /GTS_PDFX ` +
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
    enc(
      "[/Separation /kiss_cut /DeviceCMYK " +
        "<< /FunctionType 2 /Domain [0 1] /C0 [0 0 0 0] /C1 [0 1 0 0] /N 1 >>]",
    ),
    concat(
      enc(`<< /Length ${content.length} >>\nstream\n`),
      content,
      enc("\nendstream"),
    ),
    enc(outputIntent),
  ];
  if (iccStream) {
    objects.push(
      concat(
        enc(
          `<< /N 4 /Filter /FlateDecode /Length ${iccStream.length} >>\nstream\n`,
        ),
        iccStream,
        enc("\nendstream"),
      ),
    );
  }

  // Assemble with a cross-reference table. The header's binary comment must
  // be raw high bytes, so build it directly.
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
