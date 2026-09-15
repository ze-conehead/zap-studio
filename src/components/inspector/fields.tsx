// The Inspector's building blocks: labelled fields, number / colour /
// slider inputs, the fill editor — shared by every properties panel.

import {
  Minus,
  Plus,
} from "lucide-react";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { gradientStops } from "../../background";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { getRecentColorsVersion, recentColors, rememberColor, subscribeRecentColors } from "../../recentColors";
import { cn } from "@/lib/utils";
import { useT } from "../../i18n";
import { PX_PER_MM, TRIM_RECT } from "../../card";
import {
  type CardBackground,
  type Layer,
} from "../../types";

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
        {(["solid", "gradient"] as const).map((k) => (
          <Button
            key={k}
            variant={f.kind === k ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => set({ kind: k })}
          >
            {k === "solid" ? t("Color") : t("Gradient")}
          </Button>
        ))}
      </div>

      {f.kind === "solid" ? (
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

      <SliderField
        label={t("Grain / noise {n}%", { n: Math.round(f.noise * 100) })}
        min={0}
        max={1}
        step={0.01}
        value={f.noise}
        onChange={(v, done) => set({ noise: v }, done)}
      />
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

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
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
  return (
    <Field label={label}>
      <Input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
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
  // The native "change" fires once the picker closes — that's a pick worth
  // remembering, unlike every "input" while dragging through the wheel.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const done = () => rememberColor(el.value);
    el.addEventListener("change", done);
    return () => el.removeEventListener("change", done);
  }, []);
  return (
    <Field label={label}>
      <input
        ref={ref}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full cursor-pointer rounded-md border border-input bg-transparent p-1"
      />
      {recent.length > 0 && (
        <div className="flex flex-wrap gap-1" title={t("Recent colors")}>
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
      )}
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
