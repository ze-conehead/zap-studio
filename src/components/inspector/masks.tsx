// Alpha masks, clipping groups and conditions: the controls that wire a
// layer to other layers rather than style it.

import {
  Check,
  CornerDownRight,
  Crop,
} from "lucide-react";
import { useSyncExternalStore } from "react";
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
import { cn } from "@/lib/utils";
import { useT } from "../../i18n";
import { isCondition } from "../../factory";
import {
  activeCases,
  casesOf,
  conditionFieldsFor,
  fieldLabel,
  isDefaultCase,
  metaValue,
} from "../../conditions";
import { getWorkspaceKind } from "../../workspace";
import type { MaskOption } from "../../templates";
import {
  getGamelistVersion,
  resolveBadgeMeta,
  subscribeGamelists,
} from "../../gamelist";
import { canBeClipped, maskGroupStart } from "../../masking";
import { useStore } from "../../store";
import {
  type ConditionField,
  type ConditionLayer,
  type Layer,
} from "../../types";

import { Field, Panel, type Patch } from "./fields";

// A condition draws nothing: it names a gamelist.xml field, and the layers
// assigned to it are its cases. Shows which case the open game selects.
export function ConditionProps({
  layer,
  patch,
}: {
  layer: ConditionLayer;
  patch: Patch;
}) {
  const t = useT();
  const { state, dispatch } = useStore();
  useSyncExternalStore(subscribeGamelists, getGamelistVersion, getGamelistVersion);
  const faceLayers = faceOf(state);
  const meta = resolveBadgeMeta(state.project);
  const value = metaValue(meta, layer.field);
  const cases = casesOf(faceLayers, layer);
  const live = new Set(activeCases(faceLayers, layer, meta).map((l) => l.id));

  return (
    <Panel title={t("Condition")}>
      <p className="text-xs text-muted-foreground">
        {t(
          "Draws nothing on its own. The layers under it are its cases: the case whose name matches the field's value is drawn, and with no match the one named “Default”.",
        )}
      </p>

      <Field label={t("Name")}>
        <Input
          value={layer.name}
          onChange={(e) => patch({ name: e.target.value }, false)}
          onBlur={(e) => patch({ name: e.target.value })}
        />
      </Field>

      <Field label={t("Metadata field")}>
        <Select
          value={layer.field}
          onValueChange={(v) => patch({ field: v as ConditionField })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {conditionFieldsFor(getWorkspaceKind()).map((f) => (
              <SelectItem key={f} value={f}>
                {fieldLabel(f)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t("Value on this card")}>
        <p className="rounded-md border bg-muted/40 px-2 py-1.5 text-sm">
          {value || (
            <span className="text-muted-foreground">
              {t("nothing in the gamelist — the “Default” case is used")}
            </span>
          )}
        </p>
      </Field>

      <div className="flex flex-col gap-1.5">
        <Label>{t("Cases ({n})", { n: cases.length })}</Label>
        {cases.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t(
              "No cases yet. Add a layer while this one is selected — it joins the condition, and its name is the value it stands for.",
            )}
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {[...cases].reverse().map((c) => (
              <li
                key={c.id}
                className={cn(
                  "flex items-center gap-1.5 rounded px-1.5 py-1 text-sm",
                  live.has(c.id) ? "bg-accent" : "text-muted-foreground",
                )}
              >
                <button
                  className="min-w-0 flex-1 truncate text-left"
                  onClick={() => dispatch({ type: "SELECT", id: c.id })}
                >
                  {c.name}
                </button>
                {isDefaultCase(c) && (
                  <span className="shrink-0 text-[10px] uppercase tracking-wider">
                    {t("fallback")}
                  </span>
                )}
                {live.has(c.id) && (
                  <Check className="size-3.5 shrink-0 text-primary" />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

// Which condition (if any) the selected layer is a case of. The layer's own
// name is the value it matches, so there is nothing else to fill in.
export function ConditionMembership({ patch }: { patch: Patch }) {
  const t = useT();
  const { state, selected } = useStore();
  if (!selected || isCondition(selected) || selected.type === "background") {
    return null;
  }
  const conditions = faceOf(state).filter(isCondition);
  if (!conditions.length) return null;
  const host = conditions.find((c) => c.id === selected.condId);

  return (
    <Field label={t("Shown by condition")}>
      <Select
        value={selected.condId ?? "none"}
        onValueChange={(v) => patch({ condId: v === "none" ? undefined : v })}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t("Always shown")}</SelectItem>
          {conditions.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
              <span className="ml-1.5 text-xs text-muted-foreground">
                {fieldLabel(c.field)}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {host && (
        <p className="text-xs text-muted-foreground">
          {isDefaultCase(selected)
            ? t("The fallback: drawn when no other case matches.")
            : t("Drawn when {field} is “{value}” — this layer's name is the value.", {
                field: fieldLabel(host.field),
                value: selected.name,
              })}
        </p>
      )}
    </Field>
  );
}

// The layer stack of whichever face is being edited.
export const faceOf = (state: { side: string; project: { layers: Layer[]; back?: { layers: Layer[] } } }): Layer[] =>
  state.side === "back" ? state.project.back?.layers ?? [] : state.project.layers;

// The card's main image is always clipped by the global main mask.
// In a template: mark this layer as an alpha mask. On a card: pick which of
// the available masks an image is clipped to.
export function MaskRoleControls({
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
    // Only a shape can be an alpha mask — its geometry is the frame. An
    // image would clip cards to its own pixels, which is never what's wanted.
    if (selected.type !== "shape") return null;
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

export function MaskControls({ patch }: { patch: Patch }) {
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
