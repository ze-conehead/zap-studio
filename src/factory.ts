import { t } from "./i18n";
import { DEFAULT_BACKGROUND, DEFAULT_SHAPE_FILL, resolveBackground } from "./background";
import { CANVAS, TRIM_RECT } from "./card";
import { FONTS } from "./fonts";
import { getFormatId, isCard } from "./formats";
import { wsSuffix } from "./workspace";
import type {
  BackFace,
  BackgroundLayer,
  BackgroundSource,
  CardBackground,
  ConditionField,
  ConditionLayer,
  ImageLayer,
  Layer,
  MetaBadgeKind,
  MetaBadgeLayer,
  Project,
  ShapeKind,
  ShapeLayer,
  TextLayer,
} from "./types";
import { DEFAULT_BACKGROUND_SOURCE } from "./types";

export type { MetaBadgeKind };

export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const center = { x: CANVAS.w / 2, y: CANVAS.h / 2 };

export function newProject(name = t("New sticker design")): Project {
  const now = Date.now();
  return {
    id: uid(),
    name,
    format: getFormatId(),
    layers: [],
    createdAt: now,
    updatedAt: now,
  };
}

// A fresh, empty back face (its own layer stack — no background until one
// is added as a layer).
export function makeBackFace(): BackFace {
  return { layers: [] };
}

// Templates are per format and per workspace. The card in the original
// workspace keeps the unsuffixed ids so existing data is untouched; anything
// else gets a "--<format>" / "--w<workspace>" suffix.
const TPL_SUFFIX = (isCard() ? "" : `--${getFormatId()}`) + wsSuffix();
export const templateId = (consoleId: string) => `tpl-${consoleId}${TPL_SUFFIX}`;
export const GLOBAL_TEMPLATE_ID = `tpl-global${TPL_SUFFIX}`;

// The global template sits above every console: its layers are overlaid on
// every game sticker, no matter the console. It always carries a background
// layer — the shared card background every sticker falls back to.
export function newGlobalTemplate(): Project {
  const now = Date.now();
  return {
    id: GLOBAL_TEMPLATE_ID,
    name: t("Global template"),
    format: getFormatId(),
    layers: [makeBackgroundLayer()],
    createdAt: now,
    updatedAt: now,
    isTemplate: true,
    isGlobalTemplate: true,
  };
}

// A console template is an ordinary project whose layers are overlaid on every
// game sticker of that console.
export function newConsoleTemplate(consoleId: string, consoleName: string): Project {
  const now = Date.now();
  return {
    id: templateId(consoleId),
    name: t("{name} – template", { name: consoleName }),
    format: getFormatId(),
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

// Sizes a freshly-inserted main image so it fully covers the global main
// alpha mask's box (fills width *and* height, aspect ratio kept, overflow
// gets cropped by the mask). No-op unless the layer is the main image and a
// mask exists. `mask` is the alpha mask the image was dropped into.
export function fitImageToMask(
  layer: ImageLayer,
  mask: Layer | undefined,
): ImageLayer {
  if (!mask) return layer;
  if (mask.type !== "shape" && mask.type !== "image") return layer;
  const mw = Math.abs(mask.width * mask.scaleX);
  const mh = Math.abs(mask.height * mask.scaleY);
  if (!mw || !mh || !layer.width || !layer.height) return layer;
  const s = Math.max(mw / layer.width, mh / layer.height);
  return {
    ...layer,
    x: mask.x,
    y: mask.y,
    rotation: mask.rotation,
    width: layer.width * s,
    height: layer.height * s,
  };
}

export function makeTextLayer(text = t("Your text")): TextLayer {
  return {
    ...base(text.slice(0, 24) || t("Text")),
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
  rect: "Square",
  circle: "Circle",
  capsule: "Capsule",
};

export function makeShapeLayer(shape: ShapeKind): ShapeLayer {
  const square = TRIM_RECT.w * 0.4;
  const size =
    shape === "capsule"
      ? { w: TRIM_RECT.w * 0.62, h: TRIM_RECT.w * 0.22 }
      : { w: square, h: square };
  return {
    ...base(t(SHAPE_NAME[shape])),
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

// "All consoles": the shared alpha frame every card's main image is
// clipped to. Starts as a rounded rectangle covering most of the trim area.
// A placement frame for logos, living in the global template beside the main
// alpha mask. Unlike the mask it never draws — it only says where an inserted
// logo goes and how big it may be.
export function makeLogoSlotLayer(): ShapeLayer {
  return {
    ...base(t("Logo slot")),
    type: "shape",
    shape: "rect",
    width: TRIM_RECT.w * 0.76,
    height: TRIM_RECT.h * 0.16,
    cornerRadius: 0,
    fill: { ...DEFAULT_SHAPE_FILL },
    stroke: "#000000",
    strokeWidth: 0,
    logoSlot: true,
  };
}

// Sizes a logo to sit inside `slot` — contained, so the whole wordmark stays
// visible, where the main image covers its mask instead.
export function fitImageToSlot(
  layer: ImageLayer,
  slot: Layer | undefined,
): ImageLayer {
  if (!slot) return layer;
  if (slot.type !== "shape" && slot.type !== "image") return layer;
  const sw = Math.abs(slot.width * slot.scaleX);
  const sh = Math.abs(slot.height * slot.scaleY);
  if (!sw || !sh || !layer.width || !layer.height) return layer;
  const s = Math.min(sw / layer.width, sh / layer.height);
  return {
    ...layer,
    x: slot.x,
    y: slot.y,
    rotation: slot.rotation,
    width: layer.width * s,
    height: layer.height * s,
  };
}

// An alpha mask: a frame in the global or a console template. A card image
// pointing at it is clipped to its alpha and fitted to its box; the frame
// itself is never drawn on a card. `index` only shapes the default name and
// where it lands, so several don't stack on top of each other.
export function makeAlphaMaskLayer(index: number): ShapeLayer {
  // 4:3 by default — a screenshot cover-fitted into a letterbox frame would
  // lose most of its height.
  const w = TRIM_RECT.w * 0.42;
  const h = w * 0.75;
  return {
    ...base(t("Alpha mask {n}", { n: index })),
    type: "shape",
    shape: "rect",
    width: w,
    height: h,
    y: TRIM_RECT.y + TRIM_RECT.h * 0.38 + (index - 1) * (h + TRIM_RECT.h * 0.012),
    cornerRadius: 12,
    fill: { ...DEFAULT_SHAPE_FILL },
    stroke: "#000000",
    strokeWidth: 0,
    alphaMask: true,
  };
}

// Which pieces a newly-created metadata badge starts with — either all
// three combined, or one standalone element placeable on its own.
const META_BADGE_PRESET: Record<
  MetaBadgeKind,
  { name: string; widthFactor: number; showRating: boolean; showYear: boolean; showPlayers: boolean }
> = {
  combo: { name: "Rating & info", widthFactor: 0.72, showRating: true, showYear: true, showPlayers: true },
  rating: { name: "Rating", widthFactor: 0.26, showRating: true, showYear: false, showPlayers: false },
  year: { name: "Release year", widthFactor: 0.26, showRating: false, showYear: true, showPlayers: false },
  players: { name: "Player count", widthFactor: 0.28, showRating: false, showYear: false, showPlayers: true },
};

// A console-level badge showing rating/year/players read from gamelist.xml
// for whichever game the card ends up belonging to. `kind` only seeds which
// piece(s) start visible — the Inspector can toggle any combination after.
export function makeMetaBadgeLayer(kind: MetaBadgeKind = "combo"): MetaBadgeLayer {
  const preset = META_BADGE_PRESET[kind];
  return {
    ...base(t(preset.name)),
    type: "metabadge",
    kind,
    width: TRIM_RECT.w * preset.widthFactor,
    height: 46,
    fontSize: 20,
    color: "#f8fafc",
    starColor: "#fbbf24",
    showRating: preset.showRating,
    showYear: preset.showYear,
    showPlayers: preset.showPlayers,
    playersIcon: "auto",
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

// `kind` was added later; for older badges fall back to whichever preset
// their visible pieces match (all three / none → "combo").
export function metaBadgeKind(l: MetaBadgeLayer): MetaBadgeKind {
  if (l.kind) return l.kind;
  const { showRating: r, showYear: y, showPlayers: p } = l;
  if (r && !y && !p) return "rating";
  if (!r && y && !p) return "year";
  if (!r && !y && p) return "players";
  return "combo";
}
export function isBackground(l: Layer): l is BackgroundLayer {
  return l.type === "background";
}
export function isCondition(l: Layer): l is ConditionLayer {
  return l.type === "condition";
}

// A metadata switch. Draws nothing — see src/conditions.ts.
export function makeConditionLayer(field: ConditionField = "genre"): ConditionLayer {
  return { ...base(t("Condition")), type: "condition", field };
}

// The full-canvas background layer. Always layer 0 of a face's stack.
export function makeBackgroundLayer(
  fill?: CardBackground,
  source: BackgroundSource = "card",
): BackgroundLayer {
  return {
    ...base(t("Background")),
    type: "background",
    fill: fill ? { ...fill } : { ...DEFAULT_BACKGROUND },
    source,
  };
}

// Upgrades pre-layer projects: the old project.background / .backgroundColor
// (and the same on `back`) become a BackgroundLayer at the bottom of the
// stack. Idempotent — a face that already has a background layer is left
// alone, and a disabled legacy background (console-template opt-out) adds
// nothing.
export function migrateProject(p: Project): Project {
  const faceLayers = (
    layers: Layer[],
    legacy: Pick<Project, "background" | "backgroundColor">,
    source: BackgroundSource,
  ): Layer[] => {
    if (layers.some(isBackground)) return layers;
    if (legacy.background == null && legacy.backgroundColor == null) return layers;
    const resolved = resolveBackground(legacy);
    if (!resolved.enabled) return layers;
    const { enabled: _e, ...fill } = resolved;
    return [makeBackgroundLayer(fill, source), ...layers];
  };

  // "Main alpha mask" and the numbered screenshot frames became one kind of
  // frame; the flags are rewritten here so old projects keep working. Only a
  // shape can be an alpha frame, so the flag is cleared off anything else —
  // images could carry it while the UI still offered them the checkbox.
  const toAlphaMask = (layers: Layer[]): Layer[] => {
    const stale = layers.some(
      (l) =>
        l.mainMask ||
        l.shotMask ||
        ((l.alphaMask || l.mainMask || l.shotMask) && l.type !== "shape"),
    );
    if (!stale) return layers;
    return layers.map((l) => {
      if (l.type !== "shape") {
        if (!l.alphaMask && !l.mainMask && !l.shotMask) return l;
        return { ...l, alphaMask: undefined, mainMask: undefined, shotMask: undefined };
      }
      return l.mainMask || l.shotMask
        ? { ...l, alphaMask: true, mainMask: undefined, shotMask: undefined }
        : l;
    });
  };

  // Templates never inherit; a game card keeps its previous source default.
  const frontSource = p.isTemplate
    ? "card"
    : p.backgroundSource ?? DEFAULT_BACKGROUND_SOURCE;
  const migrated = toAlphaMask(faceLayers(p.layers, p, frontSource));
  // The global template always keeps a background layer — backfill one for
  // templates saved before that became the default.
  const nextLayers =
    p.isGlobalTemplate && !migrated.some(isBackground)
      ? [makeBackgroundLayer(), ...migrated]
      : migrated;
  const nextBack = p.back
    ? { ...p.back, layers: toAlphaMask(faceLayers(p.back.layers, p.back, "card")) }
    : p.back;

  if (nextLayers === p.layers && nextBack === p.back) return p;
  return { ...p, layers: nextLayers, back: nextBack };
}
