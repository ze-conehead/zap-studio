import { useSyncExternalStore } from "react";
import { Input } from "@/components/ui/input";
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
import { type CardBackground } from "../types";

import { Field, NumberField, Panel, SliderField, type Patch, round } from "./inspector/fields";
import { AlignButtons, EffectsControls, ImageProps, MetaBadgeProps, QrProps, ShapeProps, StyleClipboard, TextProps } from "./inspector/layerProps";
import { ConditionMembership, ConditionProps, MaskControls, MaskRoleControls } from "./inspector/masks";
import { BackFacePanel, BackgroundLayerProps, GamelistControls, GuidesPanel } from "./inspector/panels";

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
  const isShapeSel = isShape(selected);
  const isImageSel = isImage(selected);
  const fixedName = isMeta || isLogoSlot;

  return (
    <Panel title={t("Properties")}>
      <MaskRoleControls patch={patch} masks={masks} />
      {!isMeta && !isMask && !isLogoSlot && <StyleClipboard layer={selected} patch={patch} />}
      <ConditionMembership patch={patch} />

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

      <AlignButtons layer={selected} patch={patch} />

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
