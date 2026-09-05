import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CornerDownRight,
  Crop,
  Italic,
  MoveHorizontal,
  MoveVertical,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useT } from "../i18n";
import type { GuideApi } from "../App";
import { resolveBackground } from "../background";
import { CANVAS, PX_PER_MM, TRIM_RECT } from "../card";
import {
  getCatalog,
  getCatalogVersion,
  subscribeCatalog,
} from "../data/catalog";
import { isImage, isMetaBadge, isShape, isText } from "../factory";
import { FONTS } from "../fonts";
import { clearGamelist, loadGamelist, parseGamelistXml, saveGamelist } from "../gamelist";
import { canBeClipped, maskGroupStart } from "../masking";
import { useStore } from "../store";
import { DEFAULT_BACKGROUND_SOURCE } from "../types";
import type {
  BackgroundSource,
  CardBackground,
  ImageLayer,
  Layer,
  MetaBadgeLayer,
  PlayersIconStyle,
  ShapeLayer,
  TextLayer,
} from "../types";

type Patch = (p: Partial<Layer>, history?: boolean) => void;

interface InspectorProps {
  consoleBg?: CardBackground;
  globalBg?: CardBackground;
  guides: GuideApi;
}

export function Inspector({ consoleBg, globalBg, guides }: InspectorProps) {
  const t = useT();
  const { state, selected, dispatch } = useStore();

  // Follow console renames from the tree without a reload.
  useSyncExternalStore(subscribeCatalog, getCatalogVersion, getCatalogVersion);
  const consoleLabel =
    (state.project.consoleId &&
      getCatalog().find((c) => c.id === state.project.consoleId)?.name) ||
    state.project.consoleName ||
    state.project.name;

  const patch: Patch = (p, history = true) =>
    selected && dispatch({ type: "PATCH_LAYER", id: selected.id, patch: p, history });

  if (!selected) {
    if (state.project.isTemplate) {
      const global = state.project.isGlobalTemplate;
      return (
        <>
          <Panel title={global ? t("Global template") : t("Console template")}>
            <p className="text-xs text-muted-foreground">
              {global ? (
                <>
                  {t("These layers automatically appear on ")}
                  <strong>{t("all")}</strong>
                  {t(" cards \u2013 above every console and above the console templates.")}
                </>
              ) : (
                <>
                  {t("These layers automatically appear on ")}
                  <strong>{t("all")}</strong>
                  {t(" game cards for {name}.", { name: consoleLabel })}
                </>
              )}
            </p>
            <TemplateBackgroundControls />
            {!global && state.project.consoleId && (
              <GamelistControls
                consoleId={state.project.consoleId}
                consoleName={consoleLabel}
              />
            )}
          </Panel>
          {global && <GuidesPanel guides={guides} />}
        </>
      );
    }
    return (
      <Panel title={t("Card background")}>
        <BackgroundSourceControl consoleBg={consoleBg} globalBg={globalBg} />
        <p className="text-xs text-muted-foreground">
          {t("Select a layer to edit it.")}
        </p>
      </Panel>
    );
  }

  return (
    <Panel title={t("Properties")}>
      <Field label={t("Name")}>
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
          label={t("Rotation \u00b0")}
          value={round(selected.rotation)}
          onChange={(v) => patch({ rotation: v })}
        />
        <NumberField
          label={t("Size %")}
          value={round(selected.scaleX * 100)}
          onChange={(v) => patch({ scaleX: v / 100, scaleY: v / 100 })}
        />
      </div>

      <SliderField
        label={t("Opacity {n}%", { n: Math.round(selected.opacity * 100) })}
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
          <MoveHorizontal /> {t("Center")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => patch({ y: CANVAS.h / 2 })}
        >
          <MoveVertical /> {t("Center")}
        </Button>
      </div>

      <MainRoleControls patch={patch} />
      <MaskControls patch={patch} />

      {isImage(selected) && <ImageProps layer={selected} patch={patch} />}
      {isText(selected) && <TextProps layer={selected} patch={patch} />}
      {isShape(selected) && <ShapeProps layer={selected} patch={patch} />}
      {isMetaBadge(selected) && <MetaBadgeProps layer={selected} patch={patch} />}
    </Panel>
  );
}

// "Main image" (per game card) and "Main alpha mask" (on "All consoles").
// The card's main image is always clipped by the global main mask.
function MainRoleControls({ patch }: { patch: Patch }) {
  const t = useT();
  const { state, selected } = useStore();
  if (!selected) return null;
  const { isTemplate, isGlobalTemplate } = state.project;

  if (isGlobalTemplate) {
    if (selected.type !== "shape" && selected.type !== "image") return null;
    return (
      <div className="flex flex-col gap-1.5 border-t pt-3">
        <Label>{t("Main alpha mask")}</Label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={!!selected.mainMask}
            onCheckedChange={(v) => patch({ mainMask: !!v })}
          />
          {t("Use as shared alpha mask")}
        </label>
        <p className="text-xs text-muted-foreground">
          {t("This layer's alpha channel clips the main image on ")}
          <strong>{t("every")}</strong>
          {t(" card. The shape itself is not drawn on the cards.")}
        </p>
      </div>
    );
  }

  if (!isTemplate && selected.type === "image") {
    return (
      <div className="flex flex-col gap-1.5 border-t pt-3">
        <Label>{t("Main image")}</Label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={!!selected.main}
            onCheckedChange={(v) => patch({ main: !!v })}
          />
          {t("This is the card's main image")}
        </label>
        <p className="text-xs text-muted-foreground">
          {t("Clipped by the main alpha mask from \u201cAll consoles\u201d (if set there). Without a mark, the card's only image counts as the main image automatically.")}
        </p>
      </div>
    );
  }

  return null;
}

function MaskControls({ patch }: { patch: Patch }) {
  const t = useT();
  const { state, selected, dispatch } = useStore();
  if (!selected) return null;
  const layers = state.project.layers;
  const idx = layers.findIndex((l) => l.id === selected.id);
  const canClip = selected.clipped || canBeClipped(layers, idx);

  const patchMany = (
    ps: { id: string; patch: Partial<Layer> }[],
    history = true,
  ) => dispatch({ type: "PATCH_LAYERS", patches: ps, history });

  if (selected.mask) {
    const start = maskGroupStart(layers, idx);
    const childIds = layers.slice(start, idx).map((l) => l.id);
    const nextBelow = layers[start - 1]; // candidate to pull into the group
    return (
      <div className="flex flex-col gap-1.5 border-t pt-3">
        <Label>{t("Mask")}</Label>
        <Button
          variant="default"
          size="sm"
          onClick={() =>
            patchMany([
              { id: selected.id, patch: { mask: false } },
              ...childIds.map((id) => ({ id, patch: { clipped: false } })),
            ])
          }
        >
          <Crop /> {t("Dissolve mask")}
        </Button>

        <p className="text-xs text-muted-foreground">
          {t("{n} layer(s) in this mask.", { n: childIds.length })}
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={!nextBelow || nextBelow.mask}
            onClick={() =>
              nextBelow &&
              patchMany([{ id: nextBelow.id, patch: { clipped: true, mask: false } }])
            }
          >
            <CornerDownRight /> {t("Add layer")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={childIds.length === 0}
            onClick={() =>
              patchMany(
                childIds.slice(-1).map((id) => ({ id, patch: { clipped: false } })),
              )
            }
          >
            {t("Release top")}
          </Button>
        </div>

        <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={!!selected.groupTransform}
            onCheckedChange={(v) => patch({ groupTransform: !!v })}
          />
          {t("Move layers along (moving / scaling / rotating the mask affects all layers in it)")}
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 border-t pt-3">
      <Label>{t("Alpha mask")}</Label>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => patch({ mask: true, clipped: false })}
        >
          <Crop /> {t("As mask")}
        </Button>
        <Button
          variant={selected.clipped ? "default" : "outline"}
          size="sm"
          className="flex-1"
          disabled={!canClip}
          onClick={() => patch({ clipped: !selected.clipped, mask: false })}
        >
          <CornerDownRight /> {t("Into mask")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {selected.clipped
          ? t("This layer is clipped by the mask above it. Set other layers in between to \u00abInto mask\u00bb to place them in the same mask.")
          : t("\u00abAs mask\u00bb makes this layer the alpha channel for the layer(s) below it. \u00abInto mask\u00bb places it into the mask above.")}
      </p>
    </div>
  );
}

function BackgroundControls() {
  const { state, dispatch } = useStore();
  return (
    <FillEditor
      value={resolveBackground(state.project)}
      onChange={(patch, history) => dispatch({ type: "SET_BACKGROUND", patch, history })}
    />
  );
}

// Global guide lines — the same set on every card.
function GuidesPanel({ guides }: { guides: GuideApi }) {
  const t = useT();
  const { items, on } = guides.state;
  return (
    <Panel title={t("Guides")}>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => guides.add("x")}>
          {t("+ Vertical")}
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => guides.add("y")}>
          {t("+ Horizontal")}
        </Button>
      </div>

      {items.length > 0 && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox checked={on} onCheckedChange={() => guides.toggle()} />
          {t("Show guides")}
        </label>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("Editable only here (\u201cAll consoles\u201d), but they appear on every card. Drag on the card to position, drag past the edge to delete.")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((g) => (
            <li key={g.id} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-xs text-muted-foreground">
                {g.axis === "x" ? t("Vertical") : t("Horiz.")}
              </span>
              <Input
                type="number"
                className="h-7"
                value={round(pxToMm(g.pos, g.axis))}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) guides.update(g.id, mmToPxGuide(v, g.axis));
                }}
              />
              <span className="text-xs text-muted-foreground">mm</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                title={t("Delete")}
                onClick={() => guides.remove(g.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const pxToMm = (pos: number, axis: "x" | "y") =>
  (pos - (axis === "x" ? TRIM_RECT.x : TRIM_RECT.y)) / PX_PER_MM;
const mmToPxGuide = (mm: number, axis: "x" | "y") =>
  mm * PX_PER_MM + (axis === "x" ? TRIM_RECT.x : TRIM_RECT.y);

// Card: pick whose background paints, then edit the card's own background.
function BackgroundSourceControl({
  consoleBg,
  globalBg,
}: {
  consoleBg?: CardBackground;
  globalBg?: CardBackground;
}) {
  const t = useT();
  const { state, dispatch } = useStore();
  const src = state.project.backgroundSource ?? DEFAULT_BACKGROUND_SOURCE;
  const options: { value: BackgroundSource; label: string; disabled?: boolean }[] = [
    { value: "card", label: t("Own background") },
    { value: "console", label: t("From the console template"), disabled: !consoleBg?.enabled },
    { value: "global", label: t("From the global template"), disabled: !globalBg?.enabled },
  ];

  return (
    <>
      <Field label={t("Background source")}>
        <Select
          value={src}
          onValueChange={(v) => dispatch({ type: "SET_BG_SOURCE", source: v as BackgroundSource })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
                {o.disabled && o.value !== "card" ? t(" (not set)") : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {src === "card" ? (
        <BackgroundControls />
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("The background comes from the ")}
          {src === "console" ? t("console template") : t("global template")}
          {t(". Edit it there (click the console / \u201cAll consoles\u201d in the tree).")}
        </p>
      )}
    </>
  );
}

// Template background editor. The console template's background is opt-in;
// the global template ("All consoles") always has its own background on.
function TemplateBackgroundControls() {
  const t = useT();
  const { state, dispatch } = useStore();
  const global = !!state.project.isGlobalTemplate;
  const bg = resolveBackground(state.project);

  // Older global templates may have been saved with the background off.
  useEffect(() => {
    if (global && !bg.enabled) {
      dispatch({ type: "SET_BACKGROUND", patch: { enabled: true } });
    }
  }, [global, bg.enabled, dispatch]);

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      {global ? (
        <p className="text-xs font-medium text-muted-foreground">{t("Background")}</p>
      ) : (
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Checkbox
            checked={!!bg.enabled}
            onCheckedChange={(v) =>
              dispatch({ type: "SET_BACKGROUND", patch: { enabled: !!v } })
            }
          />
          {t("Own background for this template")}
        </label>
      )}
      {(global || bg.enabled) && (
        <FillEditor
          value={bg}
          onChange={(patch, history) => dispatch({ type: "SET_BACKGROUND", patch, history })}
        />
      )}
      <p className="text-xs text-muted-foreground">
        {t("Cards can choose in their properties whether to use this background.")}
      </p>
    </div>
  );
}

// Console template: upload a gamelist.xml (EmulationStation format) whose
// entries are matched by title and shown in the "Metadata" tab.
function GamelistControls({
  consoleId,
  consoleName,
}: {
  consoleId: string;
  consoleName: string;
}) {
  const t = useT();
  const [count, setCount] = useState(() => loadGamelist(consoleId).length);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const applyXml = (xml: string) => {
    try {
      const parsed = parseGamelistXml(xml);
      saveGamelist(consoleId, parsed);
      setCount(parsed.length);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const onFile = async (file: File) => {
    try {
      setBusy(t("Reading gamelist.xml …"));
      applyXml(await file.text());
    } finally {
      setBusy(null);
    }
  };

  const loadExample = async () => {
    try {
      setBusy(t("Loading example …"));
      const res = await fetch(`/gamelists/${consoleId}.xml`);
      if (!res.ok) throw new Error(t("No example available for this console."));
      applyXml(await res.text());
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <Label>gamelist.xml</Label>
      <p className="text-xs text-muted-foreground">
        {count > 0
          ? t("{n} game(s) loaded. Shown in the \u201cMetadata\u201d tab on matching game cards.", { n: count })
          : t("No metadata for {name} yet.", { name: consoleName })}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => fileRef.current?.click()}
        >
          <Upload /> {t("Upload …")}
        </Button>
        {count > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            title={t("Remove")}
            onClick={() => {
              clearGamelist(consoleId);
              setCount(0);
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={loadExample}>
        {t("Load example for {name}", { name: consoleName })}
      </Button>
      {busy && <p className="text-xs text-muted-foreground">{busy}</p>}
      <input
        ref={fileRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// Solid / gradient + noise editor, shared by the card background and shapes.
function FillEditor({
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
          <div className="grid grid-cols-2 gap-2">
            <ColorField label={t("From")} value={f.color} onChange={(v) => set({ color: v })} />
            <ColorField label={t("To")} value={f.color2} onChange={(v) => set({ color2: v })} />
          </div>
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

function ImageProps({ layer, patch }: { layer: ImageLayer; patch: Patch }) {
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
    </>
  );
}

function ShapeProps({ layer, patch }: { layer: ShapeLayer; patch: Patch }) {
  const t = useT();
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

      <div className="flex flex-col gap-1.5">
        <Label>{t("Fill")}</Label>
        <FillEditor
          value={layer.fill}
          onChange={(fp, history) => patch({ fill: { ...layer.fill, ...fp } }, history)}
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
    </>
  );
}

function MetaBadgeProps({ layer, patch }: { layer: MetaBadgeLayer; patch: Patch }) {
  const t = useT();
  return (
    <>
      <p className="text-xs text-muted-foreground">
        {t("Shows the rating, release year and player count of the currently open game from its gamelist.xml. Best placed in a console or the global template.")}
      </p>

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

      <div className="flex flex-col gap-1.5">
        <Label>{t("Content")}</Label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={layer.showRating}
            onCheckedChange={(v) => patch({ showRating: !!v })}
          />
          {t("Rating")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={layer.showYear}
            onCheckedChange={(v) => patch({ showYear: !!v })}
          />
          {t("Release year")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={layer.showPlayers}
            onCheckedChange={(v) => patch({ showPlayers: !!v })}
          />
          {t("Player count")}
        </label>
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
        <ColorField
          label={t("Star color")}
          value={layer.starColor}
          onChange={(v) => patch({ starColor: v })}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={layer.background}
          onCheckedChange={(v) => patch({ background: !!v })}
        />
        {t("Background chip")}
      </label>
      {layer.background && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <ColorField
              label={t("Background color")}
              value={layer.backgroundColor}
              onChange={(v) => patch({ backgroundColor: v })}
            />
            <NumberField
              label={t("Corner radius")}
              value={round(layer.cornerRadius)}
              onChange={(v) => patch({ cornerRadius: Math.max(0, v) })}
            />
          </div>
          <SliderField
            label={t("Opacity {n}%", { n: Math.round(layer.backgroundOpacity * 100) })}
            min={0}
            max={1}
            step={0.01}
            value={layer.backgroundOpacity}
            onChange={(v, done) => patch({ backgroundOpacity: v }, done)}
          />
        </>
      )}
    </>
  );
}

function TextProps({ layer, patch }: { layer: TextLayer; patch: Patch }) {
  const t = useT();
  return (
    <>
      <Field label={t("Text")}>
        <Textarea
          rows={2}
          value={layer.text}
          onChange={(e) => patch({ text: e.target.value }, false)}
          onBlur={(e) => patch({ text: e.target.value })}
        />
      </Field>

      <Field label={t("Font")}>
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
