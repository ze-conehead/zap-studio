import { DEFAULT_BACKGROUND, DEFAULT_SHAPE_FILL } from "./background";
import { CANVAS, TRIM_RECT } from "./card";
import { FONTS } from "./fonts";
import type {
  ImageLayer,
  Layer,
  MetaBadgeLayer,
  Project,
  ShapeKind,
  ShapeLayer,
  TextLayer,
} from "./types";

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

const TEMPLATE_BG = { ...DEFAULT_BACKGROUND, enabled: false };

// The global template sits above every console: its layers are overlaid on
// every game sticker, no matter the console. Background is opt-in.
export function newGlobalTemplate(): Project {
  const now = Date.now();
  return {
    id: GLOBAL_TEMPLATE_ID,
    name: "Globale Vorlage",
    backgroundColor: "transparent",
    background: { ...TEMPLATE_BG },
    layers: [],
    createdAt: now,
    updatedAt: now,
    isTemplate: true,
    isGlobalTemplate: true,
  };
}

// A console template is an ordinary project whose layers are overlaid on every
// game sticker of that console. Background is opt-in.
export function newConsoleTemplate(consoleId: string, consoleName: string): Project {
  const now = Date.now();
  return {
    id: templateId(consoleId),
    name: `${consoleName} – Vorlage`,
    backgroundColor: "transparent",
    background: { ...TEMPLATE_BG },
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

const SHAPE_NAME: Record<ShapeKind, string> = {
  rect: "Quadrat",
  circle: "Kreis",
  capsule: "Kapsel",
};

export function makeShapeLayer(shape: ShapeKind): ShapeLayer {
  const square = TRIM_RECT.w * 0.4;
  const size =
    shape === "capsule"
      ? { w: TRIM_RECT.w * 0.62, h: TRIM_RECT.w * 0.22 }
      : { w: square, h: square };
  return {
    ...base(SHAPE_NAME[shape]),
    type: "shape",
    shape,
    width: size.w,
    height: size.h,
    cornerRadius: shape === "rect" ? 28 : 0,
    fill: { ...DEFAULT_SHAPE_FILL },
    stroke: "#000000",
    strokeWidth: 0,
  };
}

// A console-level badge showing rating/year/players read from gamelist.xml
// for whichever game the card ends up belonging to.
export function makeMetaBadgeLayer(): MetaBadgeLayer {
  return {
    ...base("Bewertung & Infos"),
    type: "metabadge",
    width: TRIM_RECT.w * 0.72,
    height: 46,
    fontSize: 20,
    color: "#f8fafc",
    starColor: "#fbbf24",
    showRating: true,
    showYear: true,
    showPlayers: true,
    playersIcon: "auto",
    background: true,
    backgroundColor: "#000000",
    backgroundOpacity: 0.45,
    cornerRadius: 12,
  };
}

export function isImage(l: Layer): l is ImageLayer {
  return l.type === "image";
}
export function isText(l: Layer): l is TextLayer {
  return l.type === "text";
}
export function isShape(l: Layer): l is ShapeLayer {
  return l.type === "shape";
}
export function isMetaBadge(l: Layer): l is MetaBadgeLayer {
  return l.type === "metabadge";
}
