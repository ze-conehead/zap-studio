// Whole panels the Inspector shows besides a layer's properties: the
// background layer, the back face, the guides, the console gamelist.

import {
  Lock,
  LockOpen,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { parseLocaleNumber } from "@/lib/utils";
import { useT } from "../../i18n";
import { askConfirm } from "../ConfirmDialog";
import type { GuideApi } from "../../App";
import {
  clearGamelist,
  loadGamelist,
  parseGamelistXml,
  saveGamelist,
} from "../../gamelist";
import { useStore } from "../../store";
import {
  type BackgroundLayer,
  type BackgroundSource,
  type CardBackground,
} from "../../types";

import { Field, FillEditor, mmToPxGuide, Panel, pctToPxGuide, pxToMm, pxToPct, SliderField, type Patch, round } from "./fields";

// The pinned bottom "Background" layer: fill (or inherit from a template on
// a game card) + opacity.
export function BackgroundLayerProps({
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
            value={source === "card" ? "card" : "console"}
            onValueChange={(v) => patch({ source: v as BackgroundSource })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="card">{t("Own background")}</SelectItem>
              <SelectItem value="console">{t("From the template (console, else global)")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )}
      {isGameCard && source !== "card" ? (
        <p className="text-xs text-muted-foreground">
          {consoleBg
            ? t("The background comes from the ") + t("console template")
            : globalBg
              ? t("The background comes from the ") + t("global template")
              : t("Neither template has a background yet.")}
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
    </Panel>
  );
}

// Shown while editing the back side with nothing selected.
export function BackFacePanel() {
  const t = useT();
  const { dispatch } = useStore();
  return (
    <Panel title={t("Back")}>
      <p className="text-xs text-muted-foreground">{t("Select a layer to edit it.")}</p>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={async () => {
          const ok = await askConfirm({
            title: t("Remove the back side?"),
            body: t("Its layers are deleted."),
            confirmLabel: t("Remove back side"),
            destructive: true,
          });
          if (ok) dispatch({ type: "REMOVE_BACK" });
        }}
      >
        <Trash2 /> {t("Remove back side")}
      </Button>
    </Panel>
  );
}

// Global guide lines — the same set on every card.
export function GuidesPanel({ guides }: { guides: GuideApi }) {
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
    <GuideRow
      key={g.id}
      value={toValue(g)}
      unit={unit}
      locked={locked}
      onCommit={(v) => guides.update(g.id, fromValue(v, g.axis))}
      onRemove={() => guides.remove(g.id)}
    />
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

// A guide's position field. Keeps its own draft text so an in-progress,
// not-yet-valid value ("-", "3,", "12.") isn't clobbered by the controlled
// re-render on every keystroke — it only re-syncs from `value` when that
// changes for a reason other than this field's own last commit (a drag on
// the canvas, or switching the mm/% unit).
export function GuideRow({
  value,
  unit,
  locked,
  onCommit,
  onRemove,
}: {
  value: number;
  unit: "mm" | "%";
  locked: boolean;
  onCommit: (v: number) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(() => String(value));
  const lastCommitted = useRef(draft);

  useEffect(() => {
    const s = String(value);
    if (s !== lastCommitted.current) {
      setDraft(s);
      lastCommitted.current = s;
    }
    // Only re-sync on an external change (value/unit) — not on our own edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, unit]);

  return (
    <div className="flex items-center gap-1">
      <Input
        type="text"
        inputMode="decimal"
        className="h-7 min-w-0 flex-1"
        disabled={locked}
        value={draft}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          const v = parseLocaleNumber(raw);
          if (v !== undefined) {
            lastCommitted.current = raw;
            onCommit(v);
          }
        }}
      />
      <span className="shrink-0 text-[10px] text-muted-foreground">{unit}</span>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
        title={t("Delete")}
        disabled={locked}
        onClick={onRemove}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

// Console template: upload a gamelist.xml (EmulationStation format) whose
// entries are matched by title and shown in the "Metadata" tab.
export function GamelistControls({
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
