import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  MoveHorizontal,
  MoveVertical,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { resolveBackground } from "../background";
import { CANVAS } from "../card";
import { isImage, isText } from "../factory";
import { FONTS } from "../fonts";
import { useStore } from "../store";
import type { CardBackground, ImageLayer, Layer, TextLayer } from "../types";

type Patch = (p: Partial<Layer>, history?: boolean) => void;

export function Inspector() {
  const { state, selected, dispatch } = useStore();

  const patch: Patch = (p, history = true) =>
    selected && dispatch({ type: "PATCH_LAYER", id: selected.id, patch: p, history });

  if (!selected) {
    if (state.project.isTemplate) {
      return (
        <Panel title="Konsolen-Vorlage">
          <p className="text-xs text-muted-foreground">
            Diese Ebenen erscheinen automatisch auf <strong>allen</strong>{" "}
            Spiel-Karten von {state.project.consoleName}. Kein eigener
            Kartenhintergrund – füge Bilder, Logos oder Texte hinzu.
          </p>
        </Panel>
      );
    }
    return (
      <Panel title="Kartenhintergrund">
        <BackgroundControls />
        <p className="text-xs text-muted-foreground">
          Wähle eine Ebene aus, um sie zu bearbeiten.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Eigenschaften">
      <Field label="Name">
        <Input
          value={selected.name}
          onChange={(e) => patch({ name: e.target.value }, false)}
          onBlur={(e) => patch({ name: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X" value={round(selected.x)} onChange={(v) => patch({ x: v })} />
        <NumberField label="Y" value={round(selected.y)} onChange={(v) => patch({ y: v })} />
        <NumberField
          label="Drehung °"
          value={round(selected.rotation)}
          onChange={(v) => patch({ rotation: v })}
        />
        <NumberField
          label="Größe %"
          value={round(selected.scaleX * 100)}
          onChange={(v) => patch({ scaleX: v / 100, scaleY: v / 100 })}
        />
      </div>

      <SliderField
        label={`Deckkraft ${Math.round(selected.opacity * 100)}%`}
        min={0}
        max={1}
        step={0.01}
        value={selected.opacity}
        onChange={(v, done) => patch({ opacity: v }, done)}
      />

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => patch({ x: CANVAS.w / 2 })}
        >
          <MoveHorizontal /> Zentr.
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => patch({ y: CANVAS.h / 2 })}
        >
          <MoveVertical /> Zentr.
        </Button>
      </div>

      {isImage(selected) && <ImageProps layer={selected} patch={patch} />}
      {isText(selected) && <TextProps layer={selected} patch={patch} />}
    </Panel>
  );
}

function BackgroundControls() {
  const { state, dispatch } = useStore();
  const bg = resolveBackground(state.project);
  const set = (patch: Partial<CardBackground>, history = true) =>
    dispatch({ type: "SET_BACKGROUND", patch, history });

  return (
    <>
      <div className="flex gap-2">
        {(["solid", "gradient"] as const).map((k) => (
          <Button
            key={k}
            variant={bg.kind === k ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => set({ kind: k })}
          >
            {k === "solid" ? "Farbe" : "Verlauf"}
          </Button>
        ))}
      </div>

      {bg.kind === "solid" ? (
        <ColorField label="Farbe" value={bg.color} onChange={(v) => set({ color: v })} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="Von" value={bg.color} onChange={(v) => set({ color: v })} />
            <ColorField label="Nach" value={bg.color2} onChange={(v) => set({ color2: v })} />
          </div>
          <SliderField
            label={`Richtung ${Math.round(bg.angle)}°`}
            min={0}
            max={360}
            step={5}
            value={bg.angle}
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
                variant={bg.angle === a ? "default" : "outline"}
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

      <SliderField
        label={`Körnung / Noise ${Math.round(bg.noise * 100)}%`}
        min={0}
        max={1}
        step={0.01}
        value={bg.noise}
        onChange={(v, done) => set({ noise: v }, done)}
      />
    </>
  );
}

function ImageProps({ layer, patch }: { layer: ImageLayer; patch: Patch }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Breite px"
          value={round(layer.width)}
          onChange={(v) => {
            const ratio = layer.height / layer.width;
            patch({ width: v, height: v * ratio });
          }}
        />
        <NumberField
          label="Ecken-Radius"
          value={round(layer.cornerRadius)}
          onChange={(v) => patch({ cornerRadius: Math.max(0, v) })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Original: {layer.naturalWidth}×{layer.naturalHeight} px
      </p>
    </>
  );
}

function TextProps({ layer, patch }: { layer: TextLayer; patch: Patch }) {
  return (
    <>
      <Field label="Text">
        <Textarea
          rows={2}
          value={layer.text}
          onChange={(e) => patch({ text: e.target.value }, false)}
          onBlur={(e) => patch({ text: e.target.value })}
        />
      </Field>

      <Field label="Schriftart">
        <Select value={layer.fontFamily} onValueChange={(v) => patch({ fontFamily: v })}>
          <SelectTrigger style={{ fontFamily: layer.fontFamily }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONTS.map((f) => (
              <SelectItem key={f.label} value={f.value} style={{ fontFamily: f.value }}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Größe px"
          value={round(layer.fontSize)}
          onChange={(v) => patch({ fontSize: Math.max(4, v) })}
        />
        <NumberField
          label="Box-Breite"
          value={round(layer.width)}
          onChange={(v) => patch({ width: Math.max(20, v) })}
        />
        <NumberField
          label="Zeilenhöhe"
          step={0.05}
          value={round(layer.lineHeight, 2)}
          onChange={(v) => patch({ lineHeight: v })}
        />
        <NumberField
          label="Laufweite"
          value={round(layer.letterSpacing)}
          onChange={(v) => patch({ letterSpacing: v })}
        />
      </div>

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
          label="Textfarbe"
          value={layer.fill}
          onChange={(v) => patch({ fill: v })}
        />
        <ColorField
          label="Konturfarbe"
          value={layer.stroke}
          onChange={(v) => patch({ stroke: v })}
        />
      </div>
      <NumberField
        label="Konturstärke"
        value={round(layer.strokeWidth)}
        onChange={(v) => patch({ strokeWidth: Math.max(0, v) })}
      />
    </>
  );
}

/* ---------- small building blocks ---------- */

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function NumberField({
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

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full cursor-pointer rounded-md border border-input bg-transparent p-1"
      />
    </Field>
  );
}

function SliderField({
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

function IconToggle({
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

const round = (n: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
