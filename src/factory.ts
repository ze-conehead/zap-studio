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
// every game sticker, no matter the console. Its own background is always
// active (it's the base layer for every card).
export function newGlobalTemplate(): Project {
  const now = Date.now();
  return {
    id: GLOBAL_TEMPLATE_ID,
    name: "Globale Vorlage",
    backgroundColor: DEFAULT_BACKGROUND.color,
    background: { ...DEFAULT_BACKGROUND, enabled: true },
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

// "Alle Konsolen": the shared alpha frame every card's main image is
// clipped to. Starts as a rounded rectangle covering most of the trim area.
export function makeMainMaskLayer(): ShapeLayer {
  return {
    ...base("Haupt-Alpha-Maske"),
    type: "shape",
    shape: "rect",
    width: TRIM_RECT.w * 0.9,
    height: TRIM_RECT.h * 0.62,
    cornerRadius: 40,
    fill: { ...DEFAULT_SHAPE_FILL },
    stroke: "#000000",
    strokeWidth: 0,
    mainMask: true,
  };
}

// Which pieces a newly-created metadata badge starts with — either all
// three combined, or one standalone element placeable on its own.
export type MetaBadgeKind = "combo" | "rating" | "year" | "players";

const META_BADGE_PRESET: Record<
  MetaBadgeKind,
  { name: string; widthFactor: number; showRating: boolean; showYear: boolean; showPlayers: boolean }
> = {
  combo: { name: "Bewertung & Infos", widthFactor: 0.72, showRating: true, showYear: true, showPlayers: true },
  rating: { name: "Bewertung", widthFactor: 0.26, showRating: true, showYear: false, showPlayers: false },
  year: { name: "Erscheinungsjahr", widthFactor: 0.26, showRating: false, showYear: true, showPlayers: false },
  players: { name: "Spieleranzahl", widthFactor: 0.28, showRating: false, showYear: false, showPlayers: true },
};

// A console-level badge showing rating/year/players read from gamelist.xml
// for whichever game the card ends up belonging to. `kind` only seeds which
// piece(s) start visible — the Inspector can toggle any combination after.
export function makeMetaBadgeLayer(kind: MetaBadgeKind = "combo"): MetaBadgeLayer {
  const preset = META_BADGE_PRESET[kind];
  return {
    ...base(preset.name),
    type: "metabadge",
    width: TRIM_RECT.w * preset.widthFactor,
    height: 46,
    fontSize: 20,
    color: "#f8fafc",
    starColor: "#fbbf24",
    showRating: preset.showRating,
    showYear: preset.showYear,
    showPlayers: preset.showPlayers,
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
