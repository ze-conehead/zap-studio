export type LayerType = "image" | "text" | "shape";

export type ShapeKind = "rect" | "circle" | "capsule";

export interface CardBackground {
  kind: "solid" | "gradient";
  color: string; // solid fill, or first gradient stop
  color2: string; // second gradient stop
  angle: number; // gradient direction in degrees (0 = →, 90 = ↓)
  noise: number; // grain overlay strength, 0..1 (0 = off)
}

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

export type Layer = ImageLayer | TextLayer | ShapeLayer;

export interface Project {
  id: string;
  name: string;
  backgroundColor: string; // legacy / primary colour mirror
  background?: CardBackground;
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
