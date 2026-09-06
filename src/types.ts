import type { FormatId } from "./formats";

export type LayerType = "image" | "text" | "shape" | "metabadge" | "background";

export type ShapeKind = "rect" | "circle" | "capsule";

// Which gamelist.xml field(s) a metadata badge shows. "combo" is the only
// one whose pieces stay individually toggleable in the Inspector.
export type MetaBadgeKind = "combo" | "rating" | "year" | "players";

// How the player-count icon is chosen on a metadata badge.
export type PlayersIconStyle = "auto" | "single" | "group" | "controller";

export interface CardBackground {
  kind: "solid" | "gradient";
  color: string; // solid fill (also kept in sync with the first gradient stop)
  color2: string; // legacy second gradient stop (mirrors stops[1])
  stops?: string[]; // gradient stops, >= 2; falls back to [color, color2]
  gradientKind?: "linear" | "radial"; // default "linear"
  angle: number; // linear gradient direction in degrees (0 = →, 90 = ↓)
  noise: number; // grain overlay strength, 0..1 (0 = off)
  enabled?: boolean; // templates only: false => contributes no background
}

// A background layer on a game card can inherit its fill from a template.
export type BackgroundSource = "card" | "console" | "global";

// Migrated background layers (from the old project.background field) keep
// the previous default: inherit from the global template.
export const DEFAULT_BACKGROUND_SOURCE: BackgroundSource = "global";

export interface BaseLayer {
  id: string;
  type: LayerType;
  name: string;
  x: number; // center x in canvas px
  y: number; // center y in canvas px
  rotation: number; // degrees
  scaleX: number;
  scaleY: number;
  opacity: number; // 0..1
  visible: boolean;
  locked: boolean;
  mask?: boolean; // this layer's alpha clips the clipped layers directly below it
  clipped?: boolean; // this layer is clipped by the mask layer directly above it
  groupTransform?: boolean; // mask only: moving/scaling it also moves its clipped layers
  main?: boolean; // game card: the card's main image, clipped by the global main mask
  mainMask?: boolean; // "All consoles" only: the shared alpha frame for every card's main image
}

export interface ImageLayer extends BaseLayer {
  type: "image";
  src: string; // data URL
  naturalWidth: number;
  naturalHeight: number;
  width: number; // unscaled display size
  height: number;
  cornerRadius: number;
}

export interface TextLayer extends BaseLayer {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  fill: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number;
  stroke: string;
  strokeWidth: number;
  width: number; // wrap width in px
}

export interface ShapeLayer extends BaseLayer {
  type: "shape";
  shape: ShapeKind;
  width: number;
  height: number;
  cornerRadius: number; // rect only; capsule rounds automatically
  fill: CardBackground; // solid / gradient + noise, same model as the card
  stroke: string;
  strokeWidth: number;
}

// Console-level "smart" badge: shows the rating, release year and player
// count read from the gamelist.xml entry of whichever game the card is
// for. Usually placed once in a console (or the global) template.
export interface MetaBadgeLayer extends BaseLayer {
  type: "metabadge";
  kind: MetaBadgeKind;
  width: number;
  height: number;
  fontSize: number;
  color: string; // text + players-icon colour
  starColor: string; // rating star colour
  showRating: boolean;
  showYear: boolean;
  showPlayers: boolean;
  playersIcon: PlayersIconStyle;
}

// Always layer 0 of a face's stack (pinned to the bottom, not reorderable).
// Fills the whole canvas. `source` lets a game card inherit its fill from
// the console / global template.
export interface BackgroundLayer extends BaseLayer {
  type: "background";
  fill: CardBackground;
  source?: BackgroundSource;
}

export type Layer =
  | ImageLayer
  | TextLayer
  | ShapeLayer
  | MetaBadgeLayer
  | BackgroundLayer;

// Which face of the card is being edited / shown.
export type CardSide = "front" | "back";

// The optional back of the card: its own layer stack. No template overlay
// and no main alpha mask (front-only). `background`/`backgroundColor` are
// legacy — migrated into a BackgroundLayer.
export interface BackFace {
  layers: Layer[];
  background?: CardBackground;
  backgroundColor?: string;
}

export interface Project {
  id: string;
  name: string;
  format?: FormatId; // sticker format; absent = "card"
  backgroundColor?: string; // legacy — migrated into a BackgroundLayer
  background?: CardBackground; // legacy — migrated into a BackgroundLayer
  backgroundSource?: BackgroundSource; // legacy — migrated into a BackgroundLayer
  layers: Layer[]; // index 0 = bottom of the stack (front face)
  back?: BackFace; // present once the user adds a back side
  createdAt: number;
  updatedAt: number;
  gameKey?: string; // catalogue link: "console-id/game-id"
  consoleName?: string;
  isTemplate?: boolean; // true => shared layer set (console or global)
  consoleId?: string; // set on a per-console template
  isGlobalTemplate?: boolean; // true => layers shown on every card of every console
}

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
  thumbnail?: string;
}
