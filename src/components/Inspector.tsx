import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CornerDownRight,
  Crop,
  Italic,
  Lock,
  LockOpen,
  Minus,
  MoveHorizontal,
  MoveVertical,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { gradientStops } from "../background";
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
import { CANVAS, PX_PER_MM, TRIM_RECT } from "../card";
import {
  getCatalog,
  getCatalogVersion,
  subscribeCatalog,
} from "../data/catalog";
import { isImage, isMetaBadge, isShape, isText, metaBadgeKind } from "../factory";
import { FONTS } from "../fonts";
import { DEFAULT_ADJUST, type AdjustMode, type ImageAdjust } from "../imageAdjust";
import type { MaskOption } from "../templates";
import { clearGamelist, loadGamelist, parseGamelistXml, saveGamelist } from "../gamelist";
import { canBeClipped, maskGroupStart } from "../masking";
import { useStore } from "../store";
import type {
  BackgroundLayer,
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
  masks?: MaskOption[];
  guides: GuideApi;
}

export function Inspector({ consoleBg, globalBg, masks = [], guides }: InspectorProps) {
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
    if (state.side === "back") {
      return <BackFacePanel />;
    }
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
      <Panel title={t("Properties")}>
        <p className="text-xs text-muted-foreground">
          {t("Select a layer to edit it.")}
        </p>
      </Panel>
    );
  }

  if (selected.type === "background") {
    return (
      <BackgroundLayerProps
        layer={selected}
        patch={patch}
        consoleBg={consoleBg}
        globalBg={globalBg}
      />
    );
  }

  // Meta badges are named after their fixed kind, the shared "Main alpha
  // mask" is a fixed role, and the main image is always "Main image" — none
  // of them get the rename field. Meta badges, the main mask and images are
  // content, not per-card masks, so no mask controls. Shapes resize via
  // width/height (ShapeProps), so no group-scaling "Size %".
  const isMeta = isMetaBadge(selected);
  const isMask = !!selected.alphaMask;
  const isLogoSlot = !!selected.logoSlot;
  const isShapeSel = isShape(selected);
  const isImageSel = isImage(selected);
  const fixedName = isMeta || isLogoSlot;

  return (
    <Panel title={t("Properties")}>
      <MaskRoleControls patch={patch} masks={masks} />

      {!fixedName && (
        <Field label={t("Name")}>
          <Input
            value={selected.name}
            onChange={(e) => patch({ name: e.target.value }, false)}
            onBlur={(e) => patch({ name: e.target.value })}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X" value={round(selected.x)} onChange={(v) => patch({ x: v })} />
        <NumberField label="Y" value={round(selected.y)} onChange={(v) => patch({ y: v })} />
        <NumberField
          label={t("Rotation \u00b0")}
          value={round(selected.rotation)}
          onChange={(v) => patch({ rotation: v })}
        />
        {!isShapeSel && (
          <NumberField
            label={t("Size %")}
            value={round(selected.scaleX * 100)}
            onChange={(v) => patch({ scaleX: v / 100, scaleY: v / 100 })}
          />
        )}
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

      {!isMeta && !isMask && !isLogoSlot && !isImageSel && (
        <MaskControls patch={patch} />
      )}

      {isImage(selected) && <ImageProps layer={selected} patch={patch} />}
      {isText(selected) && <TextProps layer={selected} patch={patch} />}
      {isShape(selected) && <ShapeProps layer={selected} patch={patch} />}
      {isMetaBadge(selected) && <MetaBadgeProps layer={selected} patch={patch} />}
    </Panel>
  );
}

// The card's main image is always clipped by the global main mask.
// In a template: mark this layer as an alpha mask. On a card: pick which of
// the available masks an image is clipped to.
function MaskRoleControls({
  patch,
  masks,
}: {
  patch: Patch;
  masks: MaskOption[];
}) {
  const t = useT();
  const { state, selected } = useStore();
  if (!selected || state.side === "back") return null;
  const { isTemplate } = state.project;

  if (isTemplate) {
    if (selected.type !== "shape" && selected.type !== "image") return null;
    return (
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={!!selected.alphaMask}
            onCheckedChange={(v) => patch({ alphaMask: !!v })}
          />
          {t("Alpha mask")}
        </label>
        <p className="text-xs text-muted-foreground">
          {t(
            "Cards can drop an image into this frame: the image is clipped to this layer's alpha and sized to its box. The frame itself is not drawn on the cards.",
          )}
        </p>
      </div>
    );
  }

  if (selected.type !== "image") return null;

  const value = selected.maskId ?? (selected.main && masks[0] ? masks[0].layer.id : "");
  return (
    <Field label={t("Alpha mask")}>
      {masks.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("No alpha masks yet — add one in a console template or “All consoles”.")}
        </p>
      ) : (
        <Select
          value={value || "none"}
          onValueChange={(v) =>
            patch({ maskId: v === "none" ? undefined : v, main: false })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("None")}</SelectItem>
            {masks.map((m) => (
              <SelectItem key={m.layer.id} value={m.layer.id}>
                {m.layer.name}
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {m.source === "global" ? t("global") : t("console")}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
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

// The pinned bottom "Background" layer: fill (or inherit from a template on
// a game card) + opacity.
function BackgroundLayerProps({
  layer,
  patch,
  consoleBg,
  globalBg,
}: {
  layer: BackgroundLayer;
  patch: Patch;
  consoleBg?: CardBackground;
  globalBg?: CardBackground;
}) {
  const t = useT();
  const { state } = useStore();
  const isGameCard = !state.project.isTemplate && state.side !== "back";
  const source = layer.source ?? "card";
  return (
    <Panel title={t("Background")}>
      <SliderField
        label={t("Opacity {n}%", { n: Math.round(layer.opacity * 100) })}
        min={0}
        max={1}
        step={0.01}
        value={layer.opacity}
        onChange={(v, done) => patch({ opacity: v }, done)}
      />
      {isGameCard && (
        <Field label={t("Background source")}>
          <Select
            value={source}
            onValueChange={(v) => patch({ source: v as BackgroundSource })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="card">{t("Own background")}</SelectItem>
              <SelectItem value="console" disabled={!consoleBg}>
                {t("From the console template")}
                {!consoleBg ? t(" (not set)") : ""}
              </SelectItem>
              <SelectItem value="global" disabled={!globalBg}>
                {t("From the global template")}
                {!globalBg ? t(" (not set)") : ""}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )}
      {isGameCard && source !== "card" ? (
        <p className="text-xs text-muted-foreground">
          {t("The background comes from the ")}
          {source === "console" ? t("console template") : t("global template")}
          {t(". Edit it there (click the console / “All consoles” in the tree).")}
        </p>
      ) : (
        <FillEditor
          value={layer.fill}
          onChange={(fp, history) =>
            patch({ fill: { ...layer.fill, ...fp } }, history)
          }
        />
      )}
    </Panel>
  );
}

// Shown while editing the back side with nothing selected.
function BackFacePanel() {
  const t = useT();
  const { dispatch } = useStore();
  return (
    <Panel title={t("Back")}>
      <p className="text-xs text-muted-foreground">{t("Select a layer to edit it.")}</p>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => {
          if (window.confirm(t("Remove the back side? Its layers are deleted."))) {
            dispatch({ type: "REMOVE_BACK" });
          }
        }}
      >
        <Trash2 /> {t("Remove back side")}
      </Button>
    </Panel>
  );
}

// Global guide lines — the same set on every card.
function GuidesPanel({ guides }: { guides: GuideApi }) {
  const t = useT();
  const { items, on, locked } = guides.state;
  // Display/entry unit for the position fields. Percent is relative to the
  // trim box (0 % = top/left trim edge, 100 % = bottom/right); the stored
  // value stays in px either way, so switching back to mm shows the result.
  const [unit, setUnit] = useState<"mm" | "%">("mm");
  const toValue = (g: (typeof items)[number]) =>
    unit === "mm" ? round(pxToMm(g.pos, g.axis), 1) : round(pxToPct(g.pos, g.axis), 1);
  const fromValue = (v: number, axis: "x" | "y") =>
    unit === "mm" ? mmToPxGuide(v, axis) : pctToPxGuide(v, axis);

  const row = (g: (typeof items)[number]) => (
    <div key={g.id} className="flex items-center gap-1">
      <Input
        type="number"
        className="h-7 min-w-0 flex-1"
        disabled={locked}
        value={toValue(g)}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) guides.update(g.id, fromValue(v, g.axis));
        }}
      />
      <span className="shrink-0 text-[10px] text-muted-foreground">{unit}</span>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
        title={t("Delete")}
        disabled={locked}
        onClick={() => guides.remove(g.id)}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );

  return (
    <Panel title={t("Guides")}>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={locked}
          onClick={() => guides.add("x")}
        >
          {t("+ Vertical")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={locked}
          onClick={() => guides.add("y")}
        >
          {t("+ Horizontal")}
        </Button>
      </div>

      {items.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={on} onCheckedChange={() => guides.toggle()} />
              {t("Show guides")}
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={guides.state.snap}
                disabled={!on}
                onCheckedChange={(v) => guides.setSnap(!!v)}
              />
              {t("Snap layers to guides")}
            </label>
          </div>
          <div className="flex gap-1">
            <Button
              variant={locked ? "default" : "outline"}
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              title={t("Lock guides")}
              onClick={() => guides.setLocked(!locked)}
            >
              {locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
              {t("Lock")}
            </Button>
            {(["mm", "%"] as const).map((u) => (
              <Button
                key={u}
                variant={unit === u ? "default" : "outline"}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setUnit(u)}
              >
                {u}
              </Button>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("Editable only here (\u201cAll consoles\u201d), but they appear on every card. Drag on the card to position, drag past the edge to delete.")}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <div className="flex flex-col gap-1.5">
            <Label>{t("Vertical")}</Label>
            {items.filter((g) => g.axis === "x").map(row)}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("Horiz.")}</Label>
            {items.filter((g) => g.axis === "y").map(row)}
          </div>
        </div>
      )}
    </Panel>
  );
}

const trimOrigin = (axis: "x" | "y") => (axis === "x" ? TRIM_RECT.x : TRIM_RECT.y);
const trimSpan = (axis: "x" | "y") => (axis === "x" ? TRIM_RECT.w : TRIM_RECT.h);

const pxToMm = (pos: number, axis: "x" | "y") =>
  (pos - trimOrigin(axis)) / PX_PER_MM;
const mmToPxGuide = (mm: number, axis: "x" | "y") =>
  mm * PX_PER_MM + trimOrigin(axis);

const pxToPct = (pos: number, axis: "x" | "y") =>
  ((pos - trimOrigin(axis)) / trimSpan(axis)) * 100;
const pctToPxGuide = (pct: number, axis: "x" | "y") =>
  (pct / 100) * trimSpan(axis) + trimOrigin(axis);

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
function GradientStops({
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

      <AdjustControls layer={layer} patch={patch} />
    </>
  );
}

// Greyscale / threshold. Lets a colourful cover or logo be reduced to pure
// black and white, or to a one-colour silhouette on transparency.
function AdjustControls({ layer, patch }: { layer: ImageLayer; patch: Patch }) {
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

function MetaBadgeProps({ layer, patch }: { layer: MetaBadgeLayer; patch: Patch }) {
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

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={!!layer.autoFit}
            onCheckedChange={(v) => patch({ autoFit: !!v })}
          />
          {t("Shrink to fit")}
        </label>
        {layer.autoFit && (
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
