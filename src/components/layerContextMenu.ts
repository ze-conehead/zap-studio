// Right-click actions for one layer — shared by the canvas (EditorCanvas)
// and the Layers panel (LayerList), so both offer the same menu.

import { isBackground } from "../factory";
import { useT } from "../i18n";
import { copyLayer, layerClipboard, pasteLayer } from "../layerClipboard";
import { copyStyle, pasteStyle, styleClipboard } from "../layerStyle";
import type { Action } from "../store";
import type { Layer } from "../types";
import type { ContextMenuItem } from "./ContextMenu";

export function buildLayerMenuItems(opts: {
  layer: Layer;
  faceLayers: Layer[];
  dispatch: (a: Action) => void;
  t: ReturnType<typeof useT>;
}): ContextMenuItem[] {
  const { layer, faceLayers, dispatch, t } = opts;
  const ids = faceLayers.map((l) => l.id);
  const i = ids.indexOf(layer.id);
  const order = (to: number) => {
    const next = ids.filter((id) => id !== layer.id);
    next.splice(to, 0, layer.id);
    dispatch({ type: "SET_LAYER_ORDER", order: next });
  };
  const bottom = faceLayers.findIndex((l) => !isBackground(l)); // first movable slot
  const stylePatch = pasteStyle(layer);

  return [
    { label: t("Duplicate"), onSelect: () => dispatch({ type: "DUPLICATE_LAYER", id: layer.id }) },
    { label: t("Copy"), onSelect: () => copyLayer(layer) },
    ...(layerClipboard()
      ? [{ label: t("Paste"), onSelect: () => {
          const layer = pasteLayer();
          if (layer) dispatch({ type: "ADD_LAYER", layer });
        } }]
      : []),
    { label: t("Copy style"), onSelect: () => copyStyle(layer) },
    ...(styleClipboard() && Object.keys(stylePatch).length
      ? [{ label: t("Paste style"), onSelect: () => dispatch({ type: "PATCH_LAYER", id: layer.id, patch: stylePatch }) }]
      : []),
    { label: layer.visible ? t("Hide") : t("Show"), onSelect: () => dispatch({ type: "PATCH_LAYER", id: layer.id, patch: { visible: !layer.visible } }) },
    { label: layer.locked ? t("Unlock") : t("Lock"), onSelect: () => dispatch({ type: "PATCH_LAYER", id: layer.id, patch: { locked: !layer.locked } }) },
    ...(!isBackground(layer) && i < ids.length - 1
      ? [{ label: t("Bring forward"), onSelect: () => order(i + 1) }, { label: t("Bring to front"), onSelect: () => order(ids.length - 1) }]
      : []),
    ...(!isBackground(layer) && i > bottom
      ? [{ label: t("Send backward"), onSelect: () => order(i - 1) }, { label: t("Send to back"), onSelect: () => order(bottom) }]
      : []),
    {
      label: t("Delete layer"),
      destructive: true,
      onSelect: () => dispatch({ type: "DELETE_LAYER", id: layer.id }),
    },
  ];
}

/** A foreign (inherited, read-only) row: only copying it out makes sense —
 * "Copy" then "Paste" on the currently open project turns a console's or
 * the global template's layer into one of your own, fully independent. */
export function buildForeignMenuItems(opts: {
  layer: Layer;
  t: ReturnType<typeof useT>;
}): ContextMenuItem[] {
  const { layer, t } = opts;
  return [
    { label: t("Copy"), onSelect: () => copyLayer(layer) },
    { label: t("Copy style"), onSelect: () => copyStyle(layer) },
  ];
}

/** Just "Paste" — for right-clicking empty space (no layer under the cursor). */
export function buildEmptyMenuItems(opts: {
  dispatch: (a: Action) => void;
  t: ReturnType<typeof useT>;
}): ContextMenuItem[] {
  const { dispatch, t } = opts;
  if (!layerClipboard()) return [];
  return [
    { label: t("Paste"), onSelect: () => {
      const layer = pasteLayer();
      if (layer) dispatch({ type: "ADD_LAYER", layer });
    } },
  ];
}
