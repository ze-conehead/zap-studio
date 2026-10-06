// The Inspector's building blocks: labelled fields, number / colour /
// slider inputs, the fill editor — shared by every properties panel.

import {
  Minus,
  Pipette,
  Plus,
  Search,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { gradientStops } from "../../background";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { getRecentColorsVersion, recentColors, rememberColor, subscribeRecentColors } from "../../recentColors";
import { cn } from "@/lib/utils";
import { ACCENT_TOKEN, DEFAULT_ACCENT, isAccent } from "../../accent";
import { CONTRAST_TOKEN, isContrast } from "../../contrast";
import { useT } from "../../i18n";
import { PX_PER_MM, TRIM_RECT } from "../../card";
import { DEFAULT_ADJUST, type AdjustMode, type ImageAdjust } from "../../imageAdjust";
import {
  ensureLocalLogosLoaded,
  getLocalLogosVersion,
  listLocalLogos,
  localLogoUrl,
  subscribeLocalLogos,
} from "../../localLogos";
import { DEFAULT_PATTERN } from "../../repeatingPattern";
import {
  type CardBackground,
  type Layer,
} from "../../types";
import { LocalImagePickerDialog } from "../LocalImagePickerDialog";

export type Patch = (p: Partial<Layer>, history?: boolean) => void;

export const trimOrigin = (axis: "x" | "y") => (axis === "x" ? TRIM_RECT.x : TRIM_RECT.y);
export const trimSpan = (axis: "x" | "y") => (axis === "x" ? TRIM_RECT.w : TRIM_RECT.h);

export const pxToMm = (pos: number, axis: "x" | "y") =>
  (pos - trimOrigin(axis)) / PX_PER_MM;
export const mmToPxGuide = (mm: number, axis: "x" | "y") =>
  mm * PX_PER_MM + trimOrigin(axis);

export const pxToPct = (pos: number, axis: "x" | "y") =>
  ((pos - trimOrigin(axis)) / trimSpan(axis)) * 100;
export const pctToPxGuide = (pct: number, axis: "x" | "y") =>
  (pct / 100) * trimSpan(axis) + trimOrigin(axis);

// Solid / gradient + noise editor, shared by the card background and shapes.
export function FillEditor({
  value: f,
  onChange: set,
}: {
  value: CardBackground;
  onChange: (patch: Partial<CardBackground>, history?: boolean) => void;
}) {
  const t = useT();
  return (
    <>
      <div className="flex gap-2">
        {(["solid", "gradient", "none"] as const).map((k) => (
          <Button
            key={k}
            variant={f.kind === k ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => set({ kind: k })}
          >
            {k === "solid" ? t("Color") : k === "gradient" ? t("Gradient") : t("Transparent")}
          </Button>
        ))}
      </div>

      {f.kind === "none" ? (
        <p className="text-xs text-muted-foreground">
          {t("No fill — whatever's underneath shows through.")}
        </p>
      ) : f.kind === "solid" ? (
        <ColorField label={t("Color")} value={f.color} onChange={(v) => set({ color: v })} />
      ) : (
        <>
          <div className="flex gap-2">
            {(["linear", "radial"] as const).map((gk) => (
              <Button
                key={gk}
                variant={(f.gradientKind ?? "linear") === gk ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => set({ gradientKind: gk })}
              >
                {gk === "linear" ? t("Linear") : t("Radial")}
              </Button>
            ))}
          </div>

          <GradientStops
            stops={gradientStops(f)}
            onChange={(stops, done) =>
              set({ stops, color: stops[0], color2: stops[1] ?? stops[0] }, done)
            }
          />

          {(f.gradientKind ?? "linear") === "linear" && (
            <>
              <SliderField
                label={t("Direction {n}\u00b0", { n: Math.round(f.angle) })}
                min={0}
                max={360}
                step={5}
                value={f.angle}
                onChange={(v, done) => set({ angle: v }, done)}
              />
              <div className="flex gap-1.5">
                {(
                  [
                    ["↓", 90],
                    ["→", 0],
                    ["↘", 45],
                    ["↗", 315],
                  ] as const
                ).map(([label, a]) => (
                  <Button
                    key={a}
                    variant={f.angle === a ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => set({ angle: a })}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {f.kind !== "none" && (
        <SliderField
          label={t("Grain / noise {n}%", { n: Math.round(f.noise * 100) })}
          min={0}
          max={1}
          step={0.01}
          value={f.noise}
          onChange={(v, done) => set({ noise: v }, done)}
        />
      )}
    </>
  );
}

// The gradient's colour stops (2–6), with add / remove.
export function GradientStops({
  stops,
  onChange,
}: {
  stops: string[];
  onChange: (stops: string[], done?: boolean) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label>{t("Colors")}</Label>
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            disabled={stops.length <= 2}
            title={t("Remove color")}
            onClick={() => onChange(stops.slice(0, -1))}
          >
            <Minus className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            disabled={stops.length >= 6}
            title={t("Add color")}
            onClick={() => onChange([...stops, stops[stops.length - 1]])}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {stops.map((c, i) => (
          <ColorField
            key={i}
            label={`${i + 1}`}
            value={c}
            onChange={(v) => onChange(stops.map((x, j) => (j === i ? v : x)))}
          />
        ))}
      </div>
    </div>
  );
}

export function Panel({
  title,
  children,
  headerActions,
}: {
  title: string;
  children: ReactNode;
  headerActions?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-b p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {headerActions && <div className="flex gap-1">{headerActions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  // While typing, show exactly what was typed instead of the (possibly
  // clamped, e.g. Math.max(4, v)) committed value — otherwise typing "1"
  // toward "100" gets immediately overwritten by the min and can never be
  // finished. The draft is dropped on blur, falling back to the real value.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(Number.isFinite(value) ? value : 0);
  return (
    <Field label={label}>
      <Input
        type="number"
        step={step}
        value={shown}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isFinite(v)) onChange(v);
        }}
        onBlur={() => setDraft(null)}
      />
    </Field>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useT();
  useSyncExternalStore(subscribeRecentColors, getRecentColorsVersion, getRecentColorsVersion);
  const recent = recentColors();
  const ref = useRef<HTMLInputElement>(null);
  const accent = isAccent(value);
  const contrast = isContrast(value);
  const token = accent || contrast;
  // The native "change" fires once the picker closes — that's a pick worth
  // remembering, unlike every "input" while dragging through the wheel.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const done = () => rememberColor(el.value);
    el.addEventListener("change", done);
    return () => el.removeEventListener("change", done);
  }, [token]);
  const pickFromScreen = async () => {
    if (!window.EyeDropper) return;
    try {
      const { sRGBHex } = await new window.EyeDropper().open();
      onChange(sRGBHex);
      rememberColor(sRGBHex);
    } catch {
      // Cancelled (Escape or a stray click) — leave the colour as it was.
    }
  };
  return (
    <Field label={label}>
      <div className="flex gap-1">
        {token ? (
          // The card's accent (src/accent.ts) or contrast colour
          // (src/contrast.ts) — no fixed colour to pick. Clicking turns it
          // back into a plain colour to edit.
          <button
            type="button"
            className="flex h-8 min-w-0 flex-1 items-center gap-1.5 truncate rounded-md border border-input px-2 text-xs"
            title={
              accent
                ? t("Accent color of each card, taken from its cover. Click for a fixed color instead.")
                : t("Black or white, whichever reads better on what's underneath. Click for a fixed color instead.")
            }
            onClick={() => onChange(accent ? DEFAULT_ACCENT : "#ffffff")}
          >
            <span className={cn("size-4 shrink-0 rounded-sm", accent ? "accent-swatch" : "contrast-swatch")} />
            <span className="truncate">{accent ? t("Accent") : t("Contrast")}</span>
          </button>
        ) : (
          <input
            ref={ref}
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 min-w-0 flex-1 cursor-pointer rounded-md border border-input bg-transparent p-1"
          />
        )}
        {typeof window !== "undefined" && window.EyeDropper && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            title={t("Pick a color from anywhere on screen")}
            onClick={() => void pickFromScreen()}
          >
            <Pipette className="size-4" />
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1" title={t("Recent colors")}>
        <button
          type="button"
          className={cn(
            "accent-swatch grid size-4 place-items-center rounded-sm border border-black/20 text-[9px] font-bold leading-none text-white ring-offset-1 hover:ring-1 hover:ring-primary",
            accent && "ring-1 ring-primary",
          )}
          title={t("Accent color (from the card's cover)")}
          onClick={() => onChange(ACCENT_TOKEN)}
        >
          A
        </button>
        <button
          type="button"
          className={cn(
            "contrast-swatch size-4 rounded-sm border border-black/20 ring-offset-1 hover:ring-1 hover:ring-primary",
            contrast && "ring-1 ring-primary",
          )}
          title={t("Contrast: black or white, whichever reads better on what's underneath")}
          onClick={() => onChange(CONTRAST_TOKEN)}
        />
        {recent.map((c) => (
          <button
            key={c}
            type="button"
            className={cn(
              "size-4 rounded-sm border border-black/20 ring-offset-1 hover:ring-1 hover:ring-primary",
              c === value.toLowerCase() && "ring-1 ring-primary",
            )}
            style={{ background: c }}
            title={c}
            onClick={() => {
              onChange(c);
              rememberColor(c);
            }}
          />
        ))}
      </div>
    </Field>
  );
}

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number, done: boolean) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <Field label={label}>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v, false)}
        onValueCommit={([v]) => onChange(v, true)}
      />
    </Field>
  );
}

export function IconToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="icon"
      className={cn("flex-1")}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export const round = (n: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

// Greyscale / threshold. Lets a colourful cover or logo be reduced to pure
// black and white, or to a one-colour silhouette on transparency. Shared by
// an image layer's own adjustment and a repeating pattern's logo.
export function AdjustControls({
  value,
  onChange,
}: {
  value: ImageAdjust | undefined;
  onChange: (adjust: ImageAdjust | undefined, history?: boolean) => void;
}) {
  const t = useT();
  const adj: ImageAdjust = { ...DEFAULT_ADJUST, ...(value ?? {}) };
  const set = (p: Partial<ImageAdjust>, history = true) =>
    onChange({ ...adj, ...p }, history);

  const modes: [AdjustMode, string][] = [
    ["none", t("Original")],
    ["grayscale", t("Greyscale")],
    ["threshold", t("Threshold")],
  ];

  return (
    <div className="flex flex-col gap-2 rounded-md border p-2.5">
      <Label>{t("Color reduction")}</Label>
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
            <>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <ColorField
                    label={t("Color")}
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

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={adj.overlay}
                  onCheckedChange={(v) => set({ overlay: !!v })}
                />
                {t("Overlay color (paint the rest instead of leaving it transparent)")}
              </label>
              {adj.overlay && (
                <ColorField
                  label={t("Overlay color")}
                  value={adj.overlayColor}
                  onChange={(v) => set({ overlayColor: v })}
                />
              )}
            </>
          )}
        </>
      )}

      {adj.mode !== "none" && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => onChange(undefined)}
        >
          {t("Reset")}
        </Button>
      )}
    </div>
  );
}

// A logo from "Manage logos" tiled across a shape's or the background's
// fill — rotated in place, evenly spaced, optionally offset into a brick
// pattern. Always the last box in Properties (see Inspector.tsx / panels.tsx).
export function RepeatingPatternControls({
  value,
  onChange,
}: {
  value: CardBackground;
  onChange: (patch: Partial<CardBackground>, history?: boolean) => void;
}) {
  const t = useT();
  useSyncExternalStore(subscribeLocalLogos, getLocalLogosVersion, getLocalLogosVersion);
  useEffect(() => {
    void ensureLocalLogosLoaded();
  }, []);
  const logos = listLocalLogos();
  const p = { ...DEFAULT_PATTERN, ...(value.pattern ?? {}) };
  const set = (fp: Partial<typeof p>, history = true) =>
    onChange({ pattern: { ...p, ...fp } }, history);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickedName = logos.find((l) => l.id === p.logoId)?.name;

  const [thumb, setThumb] = useState<string | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    if (!p.logoId) {
      setThumb(undefined);
      return;
    }
    void localLogoUrl(p.logoId).then((u) => {
      if (alive) setThumb(u);
    });
    return () => {
      alive = false;
    };
  }, [p.logoId]);

  return (
    <div className="flex flex-col gap-2 rounded-md border p-2.5">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={p.enabled} onCheckedChange={(v) => set({ enabled: !!v })} />
        {t("Repeating image")}
      </label>

      {p.enabled && (
        <>
          {logos.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("No logos yet — add some in Settings ▸ Manage logos …")}
            </p>
          ) : (
            <Field label={t("Logo")}>
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-9 justify-start gap-2 px-2 py-1.5 font-normal"
                onClick={() => setPickerOpen(true)}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    className="size-8 shrink-0 rounded border bg-muted/30 object-contain"
                  />
                ) : (
                  <Search className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate text-left">
                  {pickedName ?? t("Pick a logo …")}
                </span>
              </Button>
              <LocalImagePickerDialog
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                onPick={(logoId) => {
                  set({ logoId });
                  setPickerOpen(false);
                }}
              />
            </Field>
          )}

          {p.logoId && (
            <AdjustControls
              value={p.adjust}
              onChange={(adjust, history) => set({ adjust }, history)}
            />
          )}

          <SliderField
            label={t("Size {n} px", { n: Math.round(p.size) })}
            min={4}
            max={300}
            step={1}
            value={p.size}
            onChange={(v, done) => set({ size: Math.round(v) }, done)}
          />
          <SliderField
            label={t("Spacing {n} px", { n: Math.round(p.spacing) })}
            min={0}
            max={300}
            step={1}
            value={p.spacing}
            onChange={(v, done) => set({ spacing: Math.round(v) }, done)}
          />
          <SliderField
            label={t("Rotation {n}°", { n: Math.round(p.rotation) })}
            min={0}
            max={360}
            step={1}
            value={p.rotation}
            onChange={(v, done) => set({ rotation: Math.round(v) }, done)}
          />
          <SliderField
            label={t("Stagger {n}%", { n: Math.round(p.stagger) })}
            min={0}
            max={100}
            step={1}
            value={p.stagger}
            onChange={(v, done) => set({ stagger: Math.round(v) }, done)}
          />
          <SliderField
            label={t("Opacity {n}%", { n: Math.round(p.opacity * 100) })}
            min={0}
            max={1}
            step={0.01}
            value={p.opacity}
            onChange={(v, done) => set({ opacity: v }, done)}
          />
        </>
      )}
    </div>
  );
}
