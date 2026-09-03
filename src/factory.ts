import { DEFAULT_BACKGROUND } from "./background";
import { CANVAS, TRIM_RECT } from "./card";
import { FONTS } from "./fonts";
import type { ImageLayer, Layer, Project, TextLayer } from "./types";

export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const center = { x: CANVAS.w / 2, y: CANVAS.h / 2 };

export function newProject(name = "Neues Sticker-Design"): Project {
  const now = Date.now();
  return {
    id: uid(),
    name,
    backgroundColor: DEFAULT_BACKGROUND.color,
    background: { ...DEFAULT_BACKGROUND },
    layers: [],
    createdAt: now,
    updatedAt: now,
  };
}

export const templateId = (consoleId: string) => `tpl-${consoleId}`;
export const GLOBAL_TEMPLATE_ID = "tpl-global";

// The global template sits above every console: its layers are overlaid on
// every game sticker, no matter the console. No own card background.
export function newGlobalTemplate(): Project {
  const now = Date.now();
  return {
    id: GLOBAL_TEMPLATE_ID,
    name: "Globale Vorlage",
    backgroundColor: "transparent",
    layers: [],
    createdAt: now,
    updatedAt: now,
    isTemplate: true,
    isGlobalTemplate: true,
  };
}

// A console template is an ordinary project whose layers are overlaid on every
// game sticker of that console. It has no own card background.
export function newConsoleTemplate(consoleId: string, consoleName: string): Project {
  const now = Date.now();
  return {
    id: templateId(consoleId),
    name: `${consoleName} – Vorlage`,
    backgroundColor: "transparent",
    layers: [],
    createdAt: now,
    updatedAt: now,
    isTemplate: true,
    consoleId,
    consoleName,
  };
}

const base = (name: string) => ({
  id: uid(),
  name,
  x: center.x,
  y: center.y,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  visible: true,
  locked: false,
});

export function makeImageLayer(opts: {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  name: string;
  fit?: "cover" | "contain";
}): ImageLayer {
  const { src, naturalWidth, naturalHeight, name, fit = "contain" } = opts;
  const maxW = fit === "cover" ? CANVAS.w : TRIM_RECT.w * 0.6;
  const maxH = fit === "cover" ? CANVAS.h : TRIM_RECT.h * 0.6;
  const ratio = naturalWidth / naturalHeight;
  let width = maxW;
  let height = width / ratio;
  if (fit === "cover" ? height < maxH : height > maxH) {
    height = maxH;
    width = height * ratio;
  }
  return {
    ...base(name),
    type: "image",
    src,
    naturalWidth,
    naturalHeight,
    width,
    height,
    cornerRadius: 0,
  };
}

export function makeTextLayer(text = "Dein Text"): TextLayer {
  return {
    ...base(text.slice(0, 24) || "Text"),
    type: "text",
    text,
    fontFamily: FONTS[4].value, // Oswald
    fontSize: 48,
    bold: true,
    italic: false,
    fill: "#f8fafc",
    align: "center",
    lineHeight: 1.1,
    letterSpacing: 0,
    stroke: "#000000",
    strokeWidth: 0,
    width: TRIM_RECT.w * 0.8,
  };
}

export function isImage(l: Layer): l is ImageLayer {
  return l.type === "image";
}
export function isText(l: Layer): l is TextLayer {
  return l.type === "text";
}
