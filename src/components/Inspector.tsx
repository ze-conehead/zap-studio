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
          <Panel title={global ? "Globale Vorlage" : "Konsolen-Vorlage"}>
            <p className="text-xs text-muted-foreground">
              {global ? (
                <>
                  Diese Ebenen erscheinen automatisch auf <strong>allen</strong>{" "}
                  Karten – über allen Konsolen und über den Konsolen-Vorlagen.
                </>
              ) : (
                <>
                  Diese Ebenen erscheinen automatisch auf <strong>allen</strong>{" "}
                  Spiel-Karten von {consoleLabel}.
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
      <Panel title="Kartenhintergrund">
        <BackgroundSourceControl consoleBg={consoleBg} globalBg={globalBg} />
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

      <MaskControls patch={patch} />

      {isImage(selected) && <ImageProps layer={selected} patch={patch} />}
      {isText(selected) && <TextProps layer={selected} patch={patch} />}
      {isShape(selected) && <ShapeProps layer={selected} patch={patch} />}
      {isMetaBadge(selected) && <MetaBadgeProps layer={selected} patch={patch} />}
    </Panel>
  );
}

function MaskControls({ patch }: { patch: Patch }) {
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
        <Label>Maske</Label>
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
          <Crop /> Maske auflösen
        </Button>

        <p className="text-xs text-muted-foreground">
          {childIds.length} Ebene(n) in dieser Maske.
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
            <CornerDownRight /> Ebene aufnehmen
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
            Oberste lösen
          </Button>
        </div>

        <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={!!selected.groupTransform}
            onCheckedChange={(v) => patch({ groupTransform: !!v })}
          />
          Ebenen mitbewegen (Verschieben / Skalieren / Drehen der Maske
          betrifft alle Ebenen darin)
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 border-t pt-3">
      <Label>Alpha-Maske</Label>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => patch({ mask: true, clipped: false })}
        >
          <Crop /> Als Maske
        </Button>
        <Button
          variant={selected.clipped ? "default" : "outline"}
          size="sm"
          className="flex-1"
          disabled={!canClip}
          onClick={() => patch({ clipped: !selected.clipped, mask: false })}
        >
          <CornerDownRight /> In Maske
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {selected.clipped
          ? "Diese Ebene wird von der Maske darüber beschnitten. Weitere Ebenen dazwischen ebenfalls auf »In Maske« stellen, um sie in dieselbe Maske zu legen."
          : "»Als Maske« macht diese Ebene zum Alpha-Kanal für die Ebene(n) darunter. »In Maske« legt sie in die Maske darüber."}
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
  const { items, on } = guides.state;
  return (
    <Panel title="Hilfslinien">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => guides.add("x")}>
          + Vertikal
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => guides.add("y")}>
          + Horizontal
        </Button>
      </div>

      {items.length > 0 && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox checked={on} onCheckedChange={() => guides.toggle()} />
          Hilfslinien anzeigen
        </label>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nur hier („Alle Konsolen") bearbeitbar, erscheinen aber auf allen
          Karten. Auf der Karte ziehen zum Positionieren, über den Rand hinaus
          ziehen zum Löschen.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((g) => (
            <li key={g.id} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-xs text-muted-foreground">
                {g.axis === "x" ? "Vertikal" : "Horiz."}
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
                title="Löschen"
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
  const { state, dispatch } = useStore();
  const src = state.project.backgroundSource ?? "card";
  const options: { value: BackgroundSource; label: string; disabled?: boolean }[] = [
    { value: "card", label: "Eigener Hintergrund" },
    { value: "console", label: "Von der Konsolen-Vorlage", disabled: !consoleBg?.enabled },
    { value: "global", label: "Von der globalen Vorlage", disabled: !globalBg?.enabled },
  ];

  return (
    <>
      <Field label="Hintergrund-Quelle">
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
                {o.disabled && o.value !== "card" ? " (nicht gesetzt)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {src === "card" ? (
        <BackgroundControls />
      ) : (
        <p className="text-xs text-muted-foreground">
          Der Hintergrund kommt aus der{" "}
          {src === "console" ? "Konsolen-Vorlage" : "globalen Vorlage"}. Dort
          bearbeiten (Konsole/„Alle Konsolen" im Baum anklicken).
        </p>
      )}
    </>
  );
}

// Template background editor. The console template's background is opt-in;
// the global template ("Alle Konsolen") always has its own background on.
function TemplateBackgroundControls() {
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
        <p className="text-xs font-medium text-muted-foreground">Hintergrund</p>
      ) : (
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Checkbox
            checked={!!bg.enabled}
            onCheckedChange={(v) =>
              dispatch({ type: "SET_BACKGROUND", patch: { enabled: !!v } })
            }
          />
          Eigenen Hintergrund für diese Vorlage
        </label>
      )}
      {(global || bg.enabled) && (
        <FillEditor
          value={bg}
          onChange={(patch, history) => dispatch({ type: "SET_BACKGROUND", patch, history })}
        />
      )}
      <p className="text-xs text-muted-foreground">
        Karten können in ihren Eigenschaften wählen, ob sie diesen Hintergrund
        übernehmen.
      </p>
    </div>
  );
}

// Console template: upload a gamelist.xml (EmulationStation format) whose
// entries are matched by title and shown in the "Metadaten" tab.
function GamelistControls({
  consoleId,
  consoleName,
}: {
  consoleId: string;
  consoleName: string;
}) {
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
      setBusy("gamelist.xml wird gelesen …");
      applyXml(await file.text());
    } finally {
      setBusy(null);
    }
  };

  const loadExample = async () => {
    try {
      setBusy("Beispiel wird geladen …");
      const res = await fetch(`/gamelists/${consoleId}.xml`);
      if (!res.ok) throw new Error("Kein Beispiel für diese Konsole vorhanden.");
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
          ? `${count} Spiel(e) geladen. Erscheinen im Tab „Metadaten" bei passenden Spiel-Karten.`
          : `Noch keine Metadaten für ${consoleName}.`}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => fileRef.current?.click()}
        >
          <Upload /> Hochladen …
        </Button>
        {count > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            title="Entfernen"
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
        Beispiel für {consoleName} laden
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
            {k === "solid" ? "Farbe" : "Verlauf"}
          </Button>
        ))}
      </div>

      {f.kind === "solid" ? (
        <ColorField label="Farbe" value={f.color} onChange={(v) => set({ color: v })} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="Von" value={f.color} onChange={(v) => set({ color: v })} />
            <ColorField label="Nach" value={f.color2} onChange={(v) => set({ color2: v })} />
          </div>
          <SliderField
            label={`Richtung ${Math.round(f.angle)}°`}
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
        label={`Körnung / Noise ${Math.round(f.noise * 100)}%`}
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

function ShapeProps({ layer, patch }: { layer: ShapeLayer; patch: Patch }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Breite px"
          value={round(layer.width)}
          onChange={(v) => patch({ width: Math.max(4, v) })}
        />
        <NumberField
          label="Höhe px"
          value={round(layer.height)}
          onChange={(v) => patch({ height: Math.max(4, v) })}
        />
      </div>

      {layer.shape === "rect" && (
        <NumberField
          label="Ecken-Radius"
          value={round(layer.cornerRadius)}
          onChange={(v) => patch({ cornerRadius: Math.max(0, v) })}
        />
      )}

      <div className="flex flex-col gap-1.5">
        <Label>Füllung</Label>
        <FillEditor
          value={layer.fill}
          onChange={(fp, history) => patch({ fill: { ...layer.fill, ...fp } }, history)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ColorField
          label="Kontur"
          value={layer.stroke}
          onChange={(v) => patch({ stroke: v })}
        />
        <NumberField
          label="Konturstärke"
          value={round(layer.strokeWidth)}
          onChange={(v) => patch({ strokeWidth: Math.max(0, v) })}
        />
      </div>
    </>
  );
}

function MetaBadgeProps({ layer, patch }: { layer: MetaBadgeLayer; patch: Patch }) {
  return (
    <>
      <p className="text-xs text-muted-foreground">
        Zeigt Bewertung, Release-Jahr und Spieleranzahl des jeweils geöffneten
        Spiels aus dessen gamelist.xml. Am besten in einer Konsolen- oder der
        globalen Vorlage platzieren.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Breite px"
          value={round(layer.width)}
          onChange={(v) => patch({ width: Math.max(20, v) })}
        />
        <NumberField
          label="Höhe px"
          value={round(layer.height)}
          onChange={(v) => patch({ height: Math.max(12, v) })}
        />
        <NumberField
          label="Textgröße"
          value={round(layer.fontSize)}
          onChange={(v) => patch({ fontSize: Math.max(6, v) })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Inhalte</Label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={layer.showRating}
            onCheckedChange={(v) => patch({ showRating: !!v })}
          />
          Bewertung
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={layer.showYear}
            onCheckedChange={(v) => patch({ showYear: !!v })}
          />
          Release-Jahr
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={layer.showPlayers}
            onCheckedChange={(v) => patch({ showPlayers: !!v })}
          />
          Spieleranzahl
        </label>
      </div>

      {layer.showPlayers && (
        <Field label="Spieler-Icon">
          <Select
            value={layer.playersIcon}
            onValueChange={(v) => patch({ playersIcon: v as PlayersIconStyle })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Automatisch (1 = Einzelspieler)</SelectItem>
              <SelectItem value="single">Immer Einzelspieler</SelectItem>
              <SelectItem value="group">Immer Mehrspieler</SelectItem>
              <SelectItem value="controller">Controller</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2">
        <ColorField label="Textfarbe" value={layer.color} onChange={(v) => patch({ color: v })} />
        <ColorField
          label="Sternfarbe"
          value={layer.starColor}
          onChange={(v) => patch({ starColor: v })}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={layer.background}
          onCheckedChange={(v) => patch({ background: !!v })}
        />
        Hintergrund-Chip
      </label>
      {layer.background && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <ColorField
              label="Hintergrundfarbe"
              value={layer.backgroundColor}
              onChange={(v) => patch({ backgroundColor: v })}
            />
            <NumberField
              label="Ecken-Radius"
              value={round(layer.cornerRadius)}
              onChange={(v) => patch({ cornerRadius: Math.max(0, v) })}
            />
          </div>
          <SliderField
            label={`Deckkraft ${Math.round(layer.backgroundOpacity * 100)}%`}
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
