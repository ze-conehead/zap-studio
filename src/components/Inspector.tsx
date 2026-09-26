import { useSyncExternalStore } from "react";
import { ClipboardCopy, ClipboardPaste } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useT } from "../i18n";
import type { GuideApi } from "../App";
import {
  getCatalog,
  getCatalogVersion,
  subscribeCatalog,
} from "../data/catalog";
import {
  isCondition,
  isImage,
  isMetaBadge,
  isQr,
  isShape,
  isText,
} from "../factory";
import type { MaskOption } from "../templates";
import { useStore } from "../store";
import { type CardBackground, type Layer } from "../types";

import { Field, FillEditor, Panel, type Patch } from "./inspector/fields";
import { EffectsControls, ImageProps, MetaBadgeProps, PositionControls, QrProps, ShapeProps, TextProps } from "./inspector/layerProps";
import { copyStyle, getStyleClipboardVersion, pasteStyle, styleClipboard, subscribeStyleClipboard } from "../layerStyle";
import { ConditionMembership, ConditionProps, MaskControls, MaskRoleControls } from "./inspector/masks";
import { BackFacePanel, BackgroundLayerProps, GamelistControls, GuidesPanel } from "./inspector/panels";

interface InspectorProps {
  consoleBg?: CardBackground;
  globalBg?: CardBackground;
  masks?: MaskOption[];
  guides: GuideApi;
  // A read-only console/global layer picked in the Layers panel — only
  // possible when it's flagged editableFill, so this is always just the
  // fill editor. See src/fillOverrides.ts.
  foreignSelected?: Layer | null;
  onCloseForeign?: () => void;
}

export function Inspector({
  consoleBg,
  globalBg,
  masks = [],
  guides,
  foreignSelected,
  onCloseForeign,
}: InspectorProps) {
  const t = useT();
  const { state, selected, dispatch } = useStore();
  // Follow console renames from the tree without a reload. Runs
  // unconditionally, before the early return below, so hook order stays
  // stable regardless of foreignSelected.
  useSyncExternalStore(subscribeCatalog, getCatalogVersion, getCatalogVersion);

  if (foreignSelected && "fill" in foreignSelected) {
    const fill = foreignSelected.fill as CardBackground;
    const isOwnOverride = !!state.project.fillOverrides?.[foreignSelected.id];
    return (
      <Panel title={foreignSelected.name}>
        <p className="text-xs text-muted-foreground">
          {t(
            "Inherited from a template. Everything but its fill stays as defined there — pick your own fill for it here.",
          )}
        </p>
        <Field label={t("Fill")}>
          <FillEditor
            value={state.project.fillOverrides?.[foreignSelected.id] ?? fill}
            onChange={(fp, history) =>
              dispatch({
                type: "SET_FILL_OVERRIDE",
                layerId: foreignSelected.id,
                fill: { ...(state.project.fillOverrides?.[foreignSelected.id] ?? fill), ...fp },
                history,
              })
            }
          />
        </Field>
        <div className="flex justify-between gap-2">
          {isOwnOverride && (
            <button
              className="text-xs text-muted-foreground underline hover:text-foreground"
              onClick={() =>
                dispatch({ type: "SET_FILL_OVERRIDE", layerId: foreignSelected.id, fill: undefined })
              }
            >
              {t("Reset to the template's own fill")}
            </button>
          )}
          <button
            className="ml-auto text-xs text-muted-foreground underline hover:text-foreground"
            onClick={onCloseForeign}
          >
            {t("Close")}
          </button>
        </div>
      </Panel>
    );
  }

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

  if (isCondition(selected)) {
    return <ConditionProps layer={selected} patch={patch} />;
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
  const isImageSel = isImage(selected);
  const fixedName = isMeta || isLogoSlot;

  // Style clipboard state and buttons
  useSyncExternalStore(subscribeStyleClipboard, getStyleClipboardVersion, getStyleClipboardVersion);
  const clip = styleClipboard();
  const canPaste = !!clip && Object.keys(pasteStyle(selected)).length > 0;
  const showStyleButtons = !isMeta && !isMask && !isLogoSlot;

  const headerActions = showStyleButtons && (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-1.5"
        title={t("Copy style")}
        onClick={() => copyStyle(selected)}
      >
        <ClipboardCopy className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-1.5"
        disabled={!canPaste}
        title={
          clip && !canPaste ? t("Nothing in the copied style applies to this layer.") : t("Paste style")
        }
        onClick={() => patch(pasteStyle(selected))}
      >
        <ClipboardPaste className="size-3.5" />
      </Button>
    </>
  );

  return (
    <Panel title={t("Properties")} headerActions={headerActions}>
      {!fixedName && (
        <Field label={t("Name")}>
          <Input
            value={selected.name}
            onChange={(e) => patch({ name: e.target.value }, false)}
            onBlur={(e) => patch({ name: e.target.value })}
          />
        </Field>
      )}

      <MaskRoleControls patch={patch} masks={masks} />
      <ConditionMembership patch={patch} />

      <PositionControls layer={selected} patch={patch} />

      {!isMeta && !isMask && !isLogoSlot && !isImageSel && (
        <MaskControls patch={patch} />
      )}

      {isImage(selected) && <ImageProps layer={selected} patch={patch} />}
      {isText(selected) && <TextProps layer={selected} patch={patch} />}
      {isShape(selected) && (
        <ShapeProps
          layer={selected}
          patch={patch}
          frame={isMask || isLogoSlot}
        />
      )}
      {isMetaBadge(selected) && <MetaBadgeProps layer={selected} patch={patch} />}
      {isQr(selected) && <QrProps layer={selected} patch={patch} />}

      {(isImage(selected) || isText(selected) || isShape(selected) || isQr(selected)) &&
        !isMask &&
        !isLogoSlot && <EffectsControls layer={selected} patch={patch} />}
    </Panel>
  );
}
