// Per-kind properties: image, shape, text, QR, metadata badge, plus the
// effects, alignment and style-clipboard controls every layer gets.

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Braces,
  ClipboardCopy,
  ClipboardPaste,
  Italic,
  Loader2,
  MinusCircle,
  MoveHorizontal,
  MoveVertical,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { placeholderKeysFor, placeholderLabel, type PlaceholderKey } from "../../placeholders";
import { copyStyle, getStyleClipboardVersion, pasteStyle, styleClipboard, subscribeStyleClipboard } from "../../layerStyle";
import { cn } from "@/lib/utils";
import { useT } from "../../i18n";
import { croppedNatural, metaBadgeKind } from "../../factory";
import { getWorkspaceKind } from "../../workspace";
import {
  addCustomFont,
  getCustomFontsVersion,
  subscribeCustomFonts,
} from "../../customFonts";
import { allFontOptions } from "../../fonts";
import { DEFAULT_ADJUST, type AdjustMode, type ImageAdjust } from "../../imageAdjust";
import { DEFAULT_FLOW_GAP, DEFAULT_FLOW_HEIGHT } from "../../textFlow";
import {
  DEFAULT_SHADOW,
  type CombineOp,
  type CombineShape,
  type ImageCrop,
  type ImageLayer,
  type Layer,
  type LayerShadow,
  type MetaBadgeLayer,
  type PlayersIconStyle,
  type QrEcLevel,
  type QrLayer,
  type ShapeKind,
  type ShapeLayer,
  type TextLayer,
} from "../../types";
import { makeCombineShape } from "../../combineShape";
import { useStore } from "../../store";

import { ColorField, Field, IconToggle, NumberField, round, SliderField, trimOrigin, trimSpan, type Patch, FillEditor } from "./fields";

// Drop shadow / glow for image, text and shape layers. Renders through the
// same Konva props in the editor and the export (src/layerEffects.ts).
export function EffectsControls({ layer, patch }: { layer: Layer; patch: Patch }) {
  const t = useT();
  const s: LayerShadow = { ...DEFAULT_SHADOW, ...(layer.shadow ?? {}) };
  const on = !!layer.shadow?.enabled;
  const set = (p: Partial<LayerShadow>, history = true) =>
    patch({ shadow: { ...s, ...p } }, history);

  return (
    <div className="flex flex-col gap-2 rounded-md border p-2.5">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={on} onCheckedChange={(v) => set({ enabled: !!v })} />
        {t("Shadow / glow")}
      </label>

      {on && (
        <>
          <ColorField
            label={t("Shadow colour")}
            value={s.color}
            onChange={(v) => set({ color: v })}
          />
          <SliderField
            label={t("Blur {n}", { n: Math.round(s.blur) })}
            min={0}
            max={80}
            step={1}
            value={s.blur}
            onChange={(v, done) => set({ blur: Math.round(v) }, done)}
          />
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label={t("Offset X")}
              value={round(s.x)}
              onChange={(v) => set({ x: v })}
            />
            <NumberField
              label={t("Offset Y")}
              value={round(s.y)}
              onChange={(v) => set({ y: v })}
            />
          </div>
          <SliderField
            label={t("Opacity {n}%", { n: Math.round(s.opacity * 100) })}
            min={0}
            max={1}
            step={0.01}
            value={s.opacity}
            onChange={(v, done) => set({ opacity: v }, done)}
          />
          <p className="text-xs text-muted-foreground">
            {t("Offset 0 / 0 makes it an even glow.")}
          </p>
        </>
      )}
    </div>
  );
}

export function ImageProps({ layer, patch }: { layer: ImageLayer; patch: Patch }) {
  const t = useT();
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label={t("Width px")}
          value={round(layer.width)}
          onChange={(v) => {
            const ratio = layer.height / layer.width;
            patch({ width: v, height: v * ratio });
          }}
        />
        <NumberField
          label={t("Corner radius")}
          value={round(layer.cornerRadius)}
          onChange={(v) => patch({ cornerRadius: Math.max(0, v) })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t("Original: {w}\u00d7{h} px", { w: layer.naturalWidth, h: layer.naturalHeight })}
      </p>

      <CropControls layer={layer} patch={patch} />
      <AdjustControls layer={layer} patch={patch} />
    </>
  );
}

// Trim the picture from each side. The layer's box follows the crop at
// the same pixel scale, so cropping 20 % off the left shows the remaining
// 80 % at the size it had — nothing stretches.
function CropControls({ layer, patch }: { layer: ImageLayer; patch: Patch }) {
  const t = useT();
  const c = layer.crop ?? { l: 0, t: 0, r: 0, b: 0 };
  const cropped = !!layer.crop && (c.l || c.t || c.r || c.b);
  const setSide = (side: keyof ImageCrop, v: number, done: boolean) => {
    const next = { ...c, [side]: v };
    // Never let opposite sides meet.
    if (next.l + next.r > 0.9) next[side === "l" ? "l" : "r"] = 0.9 - (side === "l" ? next.r : next.l);
    if (next.t + next.b > 0.9) next[side === "t" ? "t" : "b"] = 0.9 - (side === "t" ? next.b : next.t);
    const before = croppedNatural(layer);
    const scale = layer.width / before.w;
    const after = croppedNatural({ ...layer, crop: next });
    patch({ crop: next, width: after.w * scale, height: after.h * scale }, done);
  };
  const reset = () => {
    const before = croppedNatural(layer);
    const scale = layer.width / before.w;
    patch({ crop: undefined, width: layer.naturalWidth * scale, height: layer.naturalHeight * scale });
  };
  const nat = croppedNatural(layer);
  const pct = (v: number) => Math.round(v * 100);
  return (
    <Field label={t("Crop")}>
      <div className="grid grid-cols-2 gap-x-3">
        {(["l", "r", "t", "b"] as const).map((side) => (
          <SliderField
            key={side}
            label={`${side === "l" ? t("Left") : side === "r" ? t("Right") : side === "t" ? t("Top") : t("Bottom")} ${pct(c[side])} %`}
            min={0}
            max={0.9}
            step={0.01}
            value={c[side]}
            onChange={(v, done) => setSide(side, v, done)}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {t("Shows {w}\u00d7{h} px", { w: Math.round(nat.w), h: Math.round(nat.h) })}
        </span>
        {cropped ? (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={reset}>
            {t("Reset crop")}
          </Button>
        ) : null}
      </div>
    </Field>
  );
}

// Greyscale / threshold. Lets a colourful cover or logo be reduced to pure
// black and white, or to a one-colour silhouette on transparency.
export function AdjustControls({ layer, patch }: { layer: ImageLayer; patch: Patch }) {
  const t = useT();
  const adj: ImageAdjust = { ...DEFAULT_ADJUST, ...(layer.adjust ?? {}) };
  const set = (p: Partial<ImageAdjust>, history = true) =>
    patch({ adjust: { ...adj, ...p } }, history);

  const modes: [AdjustMode, string][] = [
    ["none", t("Original")],
    ["grayscale", t("Greyscale")],
    ["threshold", t("Threshold")],
  ];

  return (
    <div className="flex flex-col gap-2 rounded-md border p-2.5">
      <Label>{t("Colour reduction")}</Label>
      <div className="flex gap-1">
        {modes.map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => set({ mode: m })}
            className={cn(
              "flex-1 rounded px-2 py-1 text-xs font-medium",
              adj.mode === m
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {adj.mode === "threshold" && (
        <SliderField
          label={t("Threshold {n}", { n: adj.threshold })}
          min={1}
          max={254}
          step={1}
          value={adj.threshold}
          onChange={(v, done) => set({ threshold: Math.round(v) }, done)}
        />
      )}

      {adj.mode !== "none" && (
        <>
          <SliderField
            label={t("Brightness {n}", { n: adj.brightness })}
            min={-100}
            max={100}
            step={1}
            value={adj.brightness}
            onChange={(v, done) => set({ brightness: Math.round(v) }, done)}
          />
          <SliderField
            label={t("Contrast {n}", { n: adj.contrast })}
            min={-100}
            max={100}
            step={1}
            value={adj.contrast}
            onChange={(v, done) => set({ contrast: Math.round(v) }, done)}
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={adj.invert}
              onCheckedChange={(v) => set({ invert: !!v })}
            />
            {t("Invert")}
          </label>
        </>
      )}

      {adj.mode === "threshold" && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={adj.silhouette}
              onCheckedChange={(v) => set({ silhouette: !!v })}
            />
            {t("Silhouette (one colour, rest transparent)")}
          </label>
          {adj.silhouette && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <ColorField
                  label={t("Colour")}
                  value={adj.color}
                  onChange={(v) => set({ color: v })}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => set({ color: "#ffffff" })}
              >
                {t("White")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => set({ color: "#000000" })}
              >
                {t("Black")}
              </Button>
            </div>
          )}
        </>
      )}

      {adj.mode !== "none" && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => patch({ adjust: undefined })}
        >
          {t("Reset")}
        </Button>
      )}
    </div>
  );
}

export function ShapeProps({
  layer,
  patch,
  frame = false,
}: {
  layer: ShapeLayer;
  patch: Patch;
  // Alpha masks and logo slots are placement frames: size only, no fill
  // or stroke — they always draw as a dashed outline.
  frame?: boolean;
}) {
  const t = useT();
  const { state } = useStore();
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label={t("Width px")}
          value={round(layer.width)}
          onChange={(v) => patch({ width: Math.max(4, v) })}
        />
        <NumberField
          label={t("Height px")}
          value={round(layer.height)}
          onChange={(v) => patch({ height: Math.max(4, v) })}
        />
      </div>

      {layer.shape === "rect" && (
        <NumberField
          label={t("Corner radius")}
          value={round(layer.cornerRadius)}
          onChange={(v) => patch({ cornerRadius: Math.max(0, v) })}
        />
      )}

      <CombineEditor layer={layer} patch={patch} />

      {frame ? (
        <p className="text-xs text-muted-foreground">
          {t("A placement frame — it always shows as a dashed outline.")}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Label>{t("Fill")}</Label>
            <FillEditor
              value={layer.fill}
              onChange={(fp, history) =>
                patch({ fill: { ...layer.fill, ...fp } }, history)
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ColorField
              label={t("Stroke")}
              value={layer.stroke}
              onChange={(v) => patch({ stroke: v })}
            />
            <NumberField
              label={t("Stroke width")}
              value={round(layer.strokeWidth)}
              onChange={(v) => patch({ strokeWidth: Math.max(0, v) })}
            />
          </div>

          {state.project.isTemplate && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={!!layer.editableFill}
                onCheckedChange={(v) => patch({ editableFill: !!v })}
              />
              {state.project.isGlobalTemplate
                ? t("Fill editable per console")
                : t("Fill editable per game")}
            </label>
          )}
        </>
      )}
    </>
  );
}

const COMBINE_SHAPES: { id: ShapeKind; label: string }[] = [
  { id: "rect", label: "Square" },
  { id: "circle", label: "Circle" },
  { id: "capsule", label: "Capsule" },
];

// Extra shapes unioned / subtracted onto this one's own outline — see
// src/combineShape.ts. Works the same for a plain shape and an alpha mask
// (frame) or a "As mask" clipping shape: whatever consumes this layer's
// alpha sees the combined result.
function CombineEditor({ layer, patch }: { layer: ShapeLayer; patch: Patch }) {
  const t = useT();
  const combine = layer.combine ?? [];

  const update = (id: string, p: Partial<CombineShape>) =>
    patch({ combine: combine.map((c) => (c.id === id ? { ...c, ...p } : c)) });
  const remove = (id: string) => patch({ combine: combine.filter((c) => c.id !== id) });
  const add = (shape: ShapeKind, op: CombineOp) =>
    patch({ combine: [...combine, makeCombineShape(shape, op, layer.width, layer.height)] });

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label>{t("Combine shapes")}</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs">
              <Plus className="size-3.5" /> {t("Add shape")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {COMBINE_SHAPES.map((s) => (
              <DropdownMenuItem key={s.id} onClick={() => add(s.id, "add")}>
                {t(s.label)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {combine.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t(
            "Add another shape to union or subtract onto this one – several simple shapes can combine into one alpha mask (or one visual shape) this way.",
          )}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {combine.map((c) => (
            <li key={c.id} className="flex flex-col gap-1.5 rounded-md border p-2">
              <div className="flex items-center gap-1.5">
                <Select value={c.shape} onValueChange={(v) => update(c.id, { shape: v as ShapeKind })}>
                  <SelectTrigger className="h-7 flex-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMBINE_SHAPES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {t(s.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex rounded-md border">
                  <button
                    className={cn(
                      "px-2 py-1 text-xs",
                      c.op === "add" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                    )}
                    onClick={() => update(c.id, { op: "add" })}
                    title={t("Add")}
                  >
                    <Plus className="size-3.5" />
                  </button>
                  <button
                    className={cn(
                      "border-l px-2 py-1 text-xs",
                      c.op === "subtract" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                    )}
                    onClick={() => update(c.id, { op: "subtract" })}
                    title={t("Subtract")}
                  >
                    <MinusCircle className="size-3.5" />
                  </button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  title={t("Remove")}
                  onClick={() => remove(c.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <NumberField label="X" value={round(c.x)} onChange={(v) => update(c.id, { x: v })} />
                <NumberField label="Y" value={round(c.y)} onChange={(v) => update(c.id, { y: v })} />
                <NumberField
                  label={t("W")}
                  value={round(c.width)}
                  onChange={(v) => update(c.id, { width: Math.max(4, v) })}
                />
                <NumberField
                  label={t("H")}
                  value={round(c.height)}
                  onChange={(v) => update(c.id, { height: Math.max(4, v) })}
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <NumberField
                  label={t("Rotation °")}
                  value={round(c.rotation)}
                  onChange={(v) => update(c.id, { rotation: v })}
                />
                {c.shape === "rect" && (
                  <NumberField
                    label={t("Radius")}
                    value={round(c.cornerRadius)}
                    onChange={(v) => update(c.id, { cornerRadius: Math.max(0, v) })}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const META_BADGE_BLURB: Record<MetaBadgeLayer["kind"], string> = {
  combo:
    "Shows the rating, release year and player count of the currently open game from its gamelist.xml. Best placed in a console or the global template.",
  rating:
    "Shows the star rating of the currently open game from its gamelist.xml. Best placed in a console or the global template.",
  year:
    "Shows the release year of the currently open game from its gamelist.xml. Best placed in a console or the global template.",
  players:
    "Shows the player count of the currently open game from its gamelist.xml. Best placed in a console or the global template.",
};

export function MetaBadgeProps({ layer, patch }: { layer: MetaBadgeLayer; patch: Patch }) {
  const t = useT();
  const kind = metaBadgeKind(layer);
  return (
    <>
      <p className="text-xs text-muted-foreground">{t(META_BADGE_BLURB[kind])}</p>

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label={t("Width px")}
          value={round(layer.width)}
          onChange={(v) => patch({ width: Math.max(20, v) })}
        />
        <NumberField
          label={t("Height px")}
          value={round(layer.height)}
          onChange={(v) => patch({ height: Math.max(12, v) })}
        />
        <NumberField
          label={t("Text size")}
          value={round(layer.fontSize)}
          onChange={(v) => patch({ fontSize: Math.max(6, v) })}
        />
      </div>

      {layer.showPlayers && (
        <Field label={t("Players icon")}>
          <Select
            value={layer.playersIcon}
            onValueChange={(v) => patch({ playersIcon: v as PlayersIconStyle })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">{t("Automatic (1 = single player)")}</SelectItem>
              <SelectItem value="single">{t("Always single player")}</SelectItem>
              <SelectItem value="group">{t("Always multiplayer")}</SelectItem>
              <SelectItem value="controller">{t("Controller")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2">
        <ColorField label={t("Text color")} value={layer.color} onChange={(v) => patch({ color: v })} />
        {(kind === "combo" || kind === "rating") && (
          <ColorField
            label={t("Star color")}
            value={layer.starColor}
            onChange={(v) => patch({ starColor: v })}
          />
        )}
      </div>
    </>
  );
}

export function TextProps({ layer, patch }: { layer: TextLayer; patch: Patch }) {
  const t = useT();
  useSyncExternalStore(subscribeCustomFonts, getCustomFontsVersion, getCustomFontsVersion);
  const fonts = allFontOptions();
  const builtIn = fonts.filter((f) => !f.custom);
  const custom = fonts.filter((f) => f.custom);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const uploadFont = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const font = await addCustomFont(file);
      patch({ fontFamily: font.family });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const kind = getWorkspaceKind();
  return (
    <>
      {layer.metaField ? (
        <Field label={t("Property")}>
          <Select
            value={layer.metaField}
            onValueChange={(v) => {
              const key = v as PlaceholderKey;
              patch({
                metaField: key,
                text: `{${key}}`,
                name: `${t("Property")} · ${placeholderLabel(key, kind)}`,
              });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {placeholderKeysFor(kind).map((k) => (
                <SelectItem key={k} value={k}>
                  {placeholderLabel(k, kind)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            {t("Shows this value from the card's metadata; nothing is drawn where the entry has none.")}
          </p>
        </Field>
      ) : (
        <Field label={t("Text")}>
          <Textarea
            rows={2}
            value={layer.text}
            onChange={(e) => patch({ text: e.target.value }, false)}
            onBlur={(e) => patch({ text: e.target.value })}
          />
          <PlaceholderPicker
            onPick={(key) =>
              patch({ text: `${layer.text}${layer.text && !/\s$/.test(layer.text) ? " " : ""}{${key}}` })
            }
          />
        </Field>
      )}

      <Field label={t("Font")}>
        <div className="flex gap-1.5">
          <Select value={layer.fontFamily} onValueChange={(v) => patch({ fontFamily: v })}>
            <SelectTrigger style={{ fontFamily: layer.fontFamily }} className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {builtIn.map((f) => (
                <SelectItem key={f.label} value={f.value} style={{ fontFamily: f.value }}>
                  {f.label}
                </SelectItem>
              ))}
              {custom.length > 0 && (
                <>
                  <SelectSeparator />
                  <SelectLabel>{t("Uploaded")}</SelectLabel>
                  {custom.map((f) => (
                    <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                      {f.label}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            disabled={busy}
            title={t("Upload a font file (.ttf, .otf, .woff, .woff2)")}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Upload />}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".ttf,.otf,.woff,.woff2"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFont(f);
              e.target.value = "";
            }}
          />
        </div>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label={t("Size px")}
          value={round(layer.fontSize)}
          onChange={(v) => patch({ fontSize: Math.max(4, v) })}
        />
        <NumberField
          label={t("Box width")}
          value={round(layer.width)}
          onChange={(v) => patch({ width: Math.max(20, v) })}
        />
        <NumberField
          label={t("Line height")}
          step={0.05}
          value={round(layer.lineHeight, 2)}
          onChange={(v) => patch({ lineHeight: v })}
        />
        <NumberField
          label={t("Letter spacing")}
          value={round(layer.letterSpacing)}
          onChange={(v) => patch({ letterSpacing: v })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={!!layer.flow}
            onCheckedChange={(v) =>
              patch({
                flow: !!v,
                height: layer.height ?? DEFAULT_FLOW_HEIGHT,
                ...(v ? { autoFit: false } : null),
              })
            }
          />
          {t("Flow around alpha masks")}
        </label>
        {layer.flow ? (
          <>
            <p className="text-xs text-muted-foreground">
              {t(
                "The text becomes a frame: lines break around the alpha mask frames instead of running under the images. Drag its handles to resize the frame.",
              )}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label={t("Frame height")}
                value={round(layer.height ?? DEFAULT_FLOW_HEIGHT)}
                onChange={(v) => patch({ height: Math.max(24, v) })}
              />
              <NumberField
                label={t("Clearance")}
                value={round(layer.flowGap ?? DEFAULT_FLOW_GAP)}
                onChange={(v) => patch({ flowGap: Math.max(0, v) })}
              />
            </div>
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            disabled={!!layer.flow}
            checked={!!layer.autoFit && !layer.flow}
            onCheckedChange={(v) => patch({ autoFit: !!v })}
          />
          {t("Shrink to fit")}
        </label>
        {layer.autoFit && !layer.flow && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {t("max.")}
            <input
              type="number"
              min={1}
              max={8}
              className="h-7 w-14 rounded border bg-transparent px-2"
              value={layer.autoFitLines ?? 2}
              onChange={(e) =>
                patch({
                  autoFitLines: Math.min(8, Math.max(1, Number(e.target.value) || 2)),
                })
              }
            />
            {t("line(s)")}
          </label>
        )}
      </div>
      {layer.autoFit && (
        <p className="text-xs text-muted-foreground">
          {t("“Size px” is the largest it may get — long titles shrink to fit the box width.")}
        </p>
      )}

      <div className="flex gap-1.5">
        <IconToggle active={layer.bold} onClick={() => patch({ bold: !layer.bold })}>
          <Bold />
        </IconToggle>
        <IconToggle active={layer.italic} onClick={() => patch({ italic: !layer.italic })}>
          <Italic />
        </IconToggle>
        {(
          [
            ["left", AlignLeft],
            ["center", AlignCenter],
            ["right", AlignRight],
          ] as const
        ).map(([a, Icon]) => (
          <IconToggle key={a} active={layer.align === a} onClick={() => patch({ align: a })}>
            <Icon />
          </IconToggle>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ColorField
          label={t("Text color")}
          value={layer.fill}
          onChange={(v) => patch({ fill: v })}
        />
        <ColorField
          label={t("Stroke color")}
          value={layer.stroke}
          onChange={(v) => patch({ stroke: v })}
        />
      </div>
      <NumberField
        label={t("Stroke width")}
        value={round(layer.strokeWidth)}
        onChange={(v) => patch({ strokeWidth: Math.max(0, v) })}
      />
    </>
  );
}

/* ---------- small building blocks ---------- */

// Align the layer to the trimmed card: its edges or its middle. A layer's
// box is its width × height times scale; a plain text layer has no fixed
// height (it wraps), so it only aligns horizontally and to the middle.
export function AlignButtons({ layer, patch }: { layer: Layer; patch: Patch }) {
  const t = useT();
  const box =
    "width" in layer && "height" in layer && layer.type !== "text"
      ? { w: Math.abs(layer.width * layer.scaleX), h: Math.abs(layer.height * layer.scaleY) }
      : layer.type === "text"
        ? { w: Math.abs(layer.width * layer.scaleX), h: layer.flow && layer.height ? Math.abs(layer.height * layer.scaleY) : 0 }
        : { w: 0, h: 0 };
  const hasH = box.h > 0;
  const row = (axis: "x" | "y") => {
    const origin = trimOrigin(axis);
    const span = trimSpan(axis);
    const half = (axis === "x" ? box.w : box.h) / 2;
    const items: [string, () => ReactNode, number, boolean][] =
      axis === "x"
        ? [
            [t("Left"), () => <AlignLeft />, origin + half, true],
            [t("Center"), () => <MoveHorizontal />, origin + span / 2, true],
            [t("Right"), () => <AlignRight />, origin + span - half, true],
          ]
        : [
            [t("Top"), () => <AlignLeft className="rotate-90" />, origin + half, hasH],
            [t("Middle"), () => <MoveVertical />, origin + span / 2, true],
            [t("Bottom"), () => <AlignRight className="rotate-90" />, origin + span - half, hasH],
          ];
    return (
      <div className="flex gap-1">
        {items.map(([label, icon, pos, enabled]) => (
          <Button
            key={label}
            variant="outline"
            size="sm"
            className="h-7 flex-1 px-1"
            title={label}
            disabled={!enabled}
            onClick={() => patch({ [axis]: pos } as Partial<Layer>)}
          >
            {icon()}
          </Button>
        ))}
      </div>
    );
  };
  return (
    <Field label={t("Align to card")}>
      <div className="grid grid-cols-2 gap-1.5">
        {row("x")}
        {row("y")}
      </div>
    </Field>
  );
}

// Copy the look of one layer onto another (colours, font, stroke, shadow,
// opacity) — ⌘⌥C / ⌘⌥V do the same.
export function StyleClipboard({ layer, patch }: { layer: Layer; patch: Patch }) {
  const t = useT();
  useSyncExternalStore(subscribeStyleClipboard, getStyleClipboardVersion, getStyleClipboardVersion);
  const clip = styleClipboard();
  const canPaste = !!clip && Object.keys(pasteStyle(layer)).length > 0;
  return (
    <div className="flex gap-1.5">
      <Button variant="outline" size="sm" className="h-7 flex-1" onClick={() => copyStyle(layer)}>
        <ClipboardCopy /> {t("Copy style")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 flex-1"
        disabled={!canPaste}
        title={clip && !canPaste ? t("Nothing in the copied style applies to this layer.") : undefined}
        onClick={() => patch(pasteStyle(layer))}
      >
        <ClipboardPaste /> {t("Paste style")}
      </Button>
    </div>
  );
}

// "{title}", "{year}" … — filled in per card at render time (src/placeholders.ts).
export function PlaceholderPicker({ onPick }: { onPick: (key: PlaceholderKey) => void }) {
  const t = useT();
  const kind = getWorkspaceKind();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="mt-1 h-6 self-start px-1.5 text-xs">
          <Braces className="size-3.5" /> {t("Insert placeholder")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
        {placeholderKeysFor(kind).map((k) => (
          <DropdownMenuItem key={k} onClick={() => onPick(k)} className="justify-between gap-4">
            {placeholderLabel(k, kind)}
            <span className="font-mono text-[11px] text-muted-foreground">{`{${k}}`}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function QrProps({ layer, patch }: { layer: QrLayer; patch: Patch }) {
  const t = useT();
  const levels: { id: QrEcLevel; label: string }[] = [
    { id: "L", label: t("Low (7 %)") },
    { id: "M", label: t("Medium (15 %)") },
    { id: "Q", label: t("Quartile (25 %)") },
    { id: "H", label: t("High (30 %)") },
  ];
  return (
    <>
      <Field label={t("Content (URL or text)")}>
        <Textarea
          rows={2}
          value={layer.text}
          onChange={(e) => patch({ text: e.target.value }, false)}
          onBlur={(e) => patch({ text: e.target.value })}
        />
        <PlaceholderPicker
          onPick={(key) => patch({ text: `${layer.text}{${key}}` })}
        />
      </Field>

      <NumberField
        label={t("Size px")}
        value={round(layer.width)}
        onChange={(v) => patch({ width: Math.max(24, v), height: Math.max(24, v) })}
      />

      <div className="grid grid-cols-2 gap-2">
        <ColorField label={t("Modules")} value={layer.fg} onChange={(v) => patch({ fg: v })} />
        <ColorField label={t("Background")} value={layer.bg} onChange={(v) => patch({ bg: v })} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={layer.bgEnabled}
          onCheckedChange={(v) => patch({ bgEnabled: !!v })}
        />
        {t("Draw background (quiet zone)")}
      </label>

      <Field label={t("Error correction")}>
        <Select value={layer.ecLevel} onValueChange={(v) => patch({ ecLevel: v as QrEcLevel })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {levels.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {t("Higher levels survive more damage but need more modules. Keep the code at least 15 mm wide for a phone to read it.")}
        </p>
      </Field>
    </>
  );
}
