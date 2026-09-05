export type LayerType = "image" | "text" | "shape" | "metabadge";

export type ShapeKind = "rect" | "circle" | "capsule";

// How the player-count icon is chosen on a metadata badge.
export type PlayersIconStyle = "auto" | "single" | "group" | "controller";

export interface CardBackground {
  kind: "solid" | "gradient";
  color: string; // solid fill, or first gradient stop
  color2: string; // second gradient stop
  angle: number; // gradient direction in degrees (0 = →, 90 = ↓)
  noise: number; // grain overlay strength, 0..1 (0 = off)
  enabled?: boolean; // templates only: false => contributes no background
}

// On a game card: which background actually shows.
export type BackgroundSource = "card" | "console" | "global";

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
  mainMask?: boolean; // "Alle Konsolen" only: the shared alpha frame for every card's main image
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
  width: number;
  height: number;
  fontSize: number;
  color: string; // text + players-icon colour
  starColor: string; // rating star colour
  showRating: boolean;
  showYear: boolean;
  showPlayers: boolean;
  playersIcon: PlayersIconStyle;
  background: boolean;
  backgroundColor: string;
  backgroundOpacity: number; // 0..1
  cornerRadius: number; // background chip
}

export type Layer = ImageLayer | TextLayer | ShapeLayer | MetaBadgeLayer;

export interface Project {
  id: string;
  name: string;
  backgroundColor: string; // legacy / primary colour mirror
  background?: CardBackground;
  backgroundSource?: BackgroundSource; // game cards only; default "card"
  layers: Layer[]; // index 0 = bottom of the stack
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
