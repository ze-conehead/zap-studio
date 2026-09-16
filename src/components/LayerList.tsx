import {
  Award,
  ClipboardPaste,
  Copy,
  CornerDownRight,
  Crop,
  Database,
  Eye,
  EyeOff,
  GitBranch,
  GripVertical,
  Image as ImageIcon,
  Lock,
  LockOpen,
  MinusCircle,
  PaintBucket,
  Pencil,
  Plus,
  QrCode,
  Shapes,
  Trash2,
  Type,
} from "lucide-react";
import { Fragment, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { activeCases } from "../conditions";
import { isBackground, isCondition, isImage, isMetaBadge, isShape } from "../factory";
import {
  getGamelistVersion,
  resolveBadgeMeta,
  subscribeGamelists,
} from "../gamelist";
import { useT } from "../i18n";
import {
  getLayerClipboardVersion,
  layerClipboard,
  subscribeLayerClipboard,
} from "../layerClipboard";
import { useStore } from "../store";
import type { CombineShape, Layer, ShapeKind } from "../types";
import { AddLayerMenu } from "./AddLayerMenu";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { CoverButton } from "./CoverButton";
import {
  buildEmptyMenuItems,
  buildForeignMenuItems,
  buildLayerMenuItems,
} from "./layerContextMenu";
import type { MaskOption } from "../templates";

function iconFor(l: Layer) {
  return isBackground(l)
    ? PaintBucket
    : isCondition(l)
      ? GitBranch
      : isImage(l)
        ? ImageIcon
        : isShape(l)
          ? Shapes
          : isMetaBadge(l)
            ? Award
            : l.type === "qr"
              ? QrCode
              : l.type === "text" && l.metaField
                ? Database
                : Type;
}

const nameOf = (l: Layer, t: ReturnType<typeof useT>) =>
  isImage(l) && l.main ? t("Main image") : l.name;

const COMBINE_SHAPE_LABEL: Record<ShapeKind, string> = {
  rect: "Square",
  circle: "Circle",
  capsule: "Capsule",
};

export function LayerList({
  masks = [],
  consoleLayers = [],
  globalLayers = [],
  foreignSelectedId,
  selectedCombine,
  onSelectOwn,
  onSelectForeign,
  onSelectCombine,
  onClearCombine,
}: {
  masks?: MaskOption[];
  // The console's / the global template's own layers, read-only here — see
  // App.tsx#Templates. Shown above the project's own so the list matches
  // what's actually drawn (own layers, then console overlay, then global).
  consoleLayers?: Layer[];
  globalLayers?: Layer[];
  foreignSelectedId?: string;
  // A combine entry (ShapeLayer.combine) picked as a sub-layer below its
  // parent shape — see App.tsx#selectedCombine.
  selectedCombine?: { parentId: string; index: number } | null;
  onSelectOwn?: (id: string | null) => void;
  onSelectForeign?: (layer: Layer | null) => void;
  onSelectCombine?: (parentId: string, index: number) => void;
  onClearCombine?: () => void;
}) {
  const t = useT();
  const { state, dispatch } = useStore();
  const faceLayers = useMemo(
    () => (state.side === "back" ? state.project.back?.layers ?? [] : state.project.layers),
    [state.side, state.project.back?.layers, state.project.layers],
  );
  const layers = [...faceLayers].reverse(); // top of stack first
  // Only the front face inherits from templates — the back is its own
  // plain face, so no foreign rows there (matches the canvas).
  const showForeign = state.side !== "back";
  const foreignGlobal = [...globalLayers].reverse();
  const foreignConsole = [...consoleLayers].reverse();

  // Which condition cases are live for the game this card is for — the rest
  // are dimmed, so it's clear at a glance which branch prints.
  useSyncExternalStore(subscribeGamelists, getGamelistVersion, getGamelistVersion);
  const meta = resolveBadgeMeta(state.project);
  const live = useMemo(() => {
    const ids = new Set<string>();
    for (const c of faceLayers.filter(isCondition)) {
      for (const l of activeCases(faceLayers, c, meta)) ids.add(l.id);
    }
    return ids;
  }, [faceLayers, meta]);

  useSyncExternalStore(subscribeLayerClipboard, getLayerClipboardVersion, getLayerClipboardVersion);

  const dragId = useRef<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);

  const reset = () => {
    dragId.current = null;
    setDragging(null);
    setOver(null);
  };

  const applyDrop = (srcId: string, tgtId: string, after: boolean) => {
    if (srcId === tgtId) return;
    const ids = layers.map((l) => l.id).filter((id) => id !== srcId);
    let ti = ids.indexOf(tgtId);
    if (ti < 0) return;
    if (after) ti += 1;
    ids.splice(ti, 0, srcId);
    dispatch({ type: "SET_LAYER_ORDER", order: [...ids].reverse() });
  };

  // Drag-and-drop reordering for a shape's combine entries (union/subtract
  // sub-layers) — a separate, index-scoped drag session from the main one
  // above, since these aren't top-level layers.
  const combineDrag = useRef<{ parentId: string; index: number } | null>(null);
  const [combineOver, setCombineOver] = useState<{
    parentId: string;
    index: number;
    after: boolean;
  } | null>(null);

  const combineRow = (parent: Layer, index: number, c: CombineShape) => {
    if (parent.type !== "shape") return null;
    const active = selectedCombine?.parentId === parent.id && selectedCombine.index === index;
    const OpIcon = c.op === "subtract" ? MinusCircle : Plus;
    const hovered = combineOver?.parentId === parent.id && combineOver.index === index;
    return (
      <li
        key={c.id}
        draggable
        onDragStart={(e) => {
          combineDrag.current = { parentId: parent.id, index };
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => {
          combineDrag.current = null;
          setCombineOver(null);
        }}
        onDragOver={(e) => {
          const d = combineDrag.current;
          if (!d || d.parentId !== parent.id || d.index === index) return;
          e.preventDefault();
          const r = e.currentTarget.getBoundingClientRect();
          setCombineOver({ parentId: parent.id, index, after: e.clientY > r.top + r.height / 2 });
        }}
        onDrop={(e) => {
          e.preventDefault();
          const d = combineDrag.current;
          const combine = parent.combine;
          if (d && d.parentId === parent.id && combine) {
            const r = e.currentTarget.getBoundingClientRect();
            const after = e.clientY > r.top + r.height / 2;
            const list = [...combine];
            const [moved] = list.splice(d.index, 1);
            let ti = index;
            if (d.index < index) ti -= 1;
            if (after) ti += 1;
            list.splice(ti, 0, moved);
            dispatch({ type: "PATCH_LAYER", id: parent.id, patch: { combine: list } });
            onSelectCombine?.(parent.id, ti);
          }
          combineDrag.current = null;
          setCombineOver(null);
        }}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "ml-3 flex items-center gap-1 rounded-md border bg-card py-1 pl-1 pr-0.5 text-sm",
          "border-l-2 border-l-fuchsia-500/60",
          active ? "border-primary bg-accent" : "hover:bg-accent/50",
          hovered &&
            (combineOver!.after
              ? "border-b-2 border-b-primary"
              : "border-t-2 border-t-primary"),
        )}
      >
        <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground/40" />
        <button
          className="flex min-w-0 flex-1 items-center gap-1.5"
          onClick={() => onSelectCombine?.(parent.id, index)}
        >
          <CornerDownRight className="size-3.5 shrink-0 text-fuchsia-500" />
          <Shapes className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{t(COMBINE_SHAPE_LABEL[c.shape])}</span>
          <OpIcon
            className={cn(
              "size-3.5 shrink-0",
              c.op === "subtract" ? "text-rose-500" : "text-primary",
            )}
          />
        </button>
        <LayerIcon
          title={t("Delete")}
          className="hover:text-destructive"
          onClick={() => {
            if (!parent.combine) return;
            dispatch({
              type: "PATCH_LAYER",
              id: parent.id,
              patch: { combine: parent.combine.filter((x) => x.id !== c.id) },
            });
            if (active) onClearCombine?.();
          }}
        >
          <Trash2 />
        </LayerIcon>
      </li>
    );
  };

  const foreignRow = (l: Layer, source: "console" | "global") => {
    const Icon = iconFor(l);
    const editable = !!l.editableFill;
    const active = foreignSelectedId === l.id;
    return (
      <li
        key={l.id}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY, items: buildForeignMenuItems({ layer: l, t }) });
        }}
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-dashed px-1.5 py-1 text-sm text-muted-foreground",
          active ? "border-primary bg-accent" : "bg-muted/30",
        )}
      >
        <span className="size-3.5 shrink-0" />
        <button
          className={cn("flex min-w-0 flex-1 items-center gap-1.5 text-left", !editable && "cursor-default")}
          disabled={!editable}
          onClick={() => editable && onSelectForeign?.(l)}
          title={
            editable
              ? t("From the {source} template – click to pick your own fill for it here.", {
                  source: source === "global" ? t("global") : t("console"),
                })
              : t("From the {source} template – edit it there.", {
                  source: source === "global" ? t("global") : t("console"),
                })
          }
        >
          <Icon className="size-3.5 shrink-0" />
          <span className="truncate">{nameOf(l, t)}</span>
          <span className="shrink-0 text-[10px] uppercase tracking-wider">
            {source === "global" ? t("global") : t("console")}
          </span>
          {editable && <Pencil className="size-3 shrink-0 text-primary" />}
        </button>
        <Lock className="size-3.5 shrink-0 opacity-60" />
      </li>
    );
  };

  return (
    <section className="border-b p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("Layers")}
        </h2>
        <div className="flex items-center gap-1">
          {layerClipboard() && (
            <Button
              variant="ghost"
              size="icon"
              title={t("Paste")}
              className="size-7 text-muted-foreground"
              onClick={(e) =>
                setMenu({ x: e.clientX, y: e.clientY, items: buildEmptyMenuItems({ dispatch, t }) })
              }
            >
              <ClipboardPaste className="size-4" />
            </Button>
          )}
          <CoverButton masks={masks.map((m) => m.layer)} />
          <AddLayerMenu />
        </div>
      </div>

      <ul
        className="flex flex-col gap-1"
        onContextMenu={(e) => {
          if (e.target !== e.currentTarget) return; // a row handles its own menu
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY, items: buildEmptyMenuItems({ dispatch, t }) });
        }}
      >
        {showForeign && foreignGlobal.map((l) => foreignRow(l, "global"))}
        {showForeign && foreignConsole.map((l) => foreignRow(l, "console"))}
        {layers.map((l) => {
          const active = l.id === state.selectedId;
          const bg = isBackground(l);
          const Icon = iconFor(l);
          // A case that the metadata doesn't select still prints nothing —
          // dim it, but keep it clickable so it can be edited.
          const dimmed = !!l.condId && !live.has(l.id);
          return (
            <Fragment key={l.id}>
              <li
                draggable={!bg}
                onDragStart={(e) => {
                  dragId.current = l.id;
                  setDragging(l.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={reset}
                onDragOver={(e) => {
                  if (!dragId.current || dragId.current === l.id || bg) return;
                  e.preventDefault();
                  const r = e.currentTarget.getBoundingClientRect();
                  setOver({ id: l.id, after: e.clientY > r.top + r.height / 2 });
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const src = dragId.current;
                  const r = e.currentTarget.getBoundingClientRect();
                  if (src && !bg) applyDrop(src, l.id, e.clientY > r.top + r.height / 2);
                  reset();
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({
                    x: e.clientX,
                    y: e.clientY,
                    items: buildLayerMenuItems({ layer: l, faceLayers, dispatch, t }),
                  });
                }}
                className={cn(
                  "flex items-center gap-0.5 rounded-md border bg-card px-1 py-1 text-sm",
                  active ? "border-primary bg-accent" : "hover:bg-accent/50",
                  l.clipped && "ml-3 border-l-2 border-l-primary/50",
                  l.condId && "ml-3 border-l-2 border-l-amber-500/60",
                  dimmed && "opacity-50",
                  dragging === l.id && "opacity-40",
                  over?.id === l.id &&
                    (over.after
                      ? "border-b-2 border-b-primary"
                      : "border-t-2 border-t-primary"),
                )}
              >
                {bg ? (
                  <span className="size-3.5 shrink-0" />
                ) : (
                  <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground/40" />
                )}

                <button
                  className="flex min-w-0 flex-1 items-center gap-1.5"
                  onClick={() => onSelectOwn?.(l.id)}
                >
                  {l.clipped && (
                    <CornerDownRight className="size-3.5 shrink-0 text-primary" />
                  )}
                  {l.condId && (
                    <CornerDownRight className="size-3.5 shrink-0 text-amber-500" />
                  )}
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate" title={nameOf(l, t)}>
                    {nameOf(l, t)}
                  </span>
                  {l.mask && <Crop className="size-3.5 shrink-0 text-primary" />}
                </button>

                <LayerIcon
                  title={l.visible ? t("Hide") : t("Show")}
                  onClick={() =>
                    dispatch({ type: "PATCH_LAYER", id: l.id, patch: { visible: !l.visible } })
                  }
                >
                  {l.visible ? <Eye /> : <EyeOff />}
                </LayerIcon>
                <LayerIcon
                  title={l.locked ? t("Unlock") : t("Lock")}
                  onClick={() =>
                    dispatch({ type: "PATCH_LAYER", id: l.id, patch: { locked: !l.locked } })
                  }
                >
                  {l.locked ? <Lock /> : <LockOpen />}
                </LayerIcon>
                {!bg && (
                  <LayerIcon
                    title={t("Duplicate")}
                    onClick={() => dispatch({ type: "DUPLICATE_LAYER", id: l.id })}
                  >
                    <Copy />
                  </LayerIcon>
                )}
                <LayerIcon
                  title={t("Delete")}
                  className="hover:text-destructive"
                  onClick={() => dispatch({ type: "DELETE_LAYER", id: l.id })}
                >
                  <Trash2 />
                </LayerIcon>
              </li>
              {l.type === "shape" &&
                l.combine?.map((c, i) => combineRow(l, i, c))}
            </Fragment>
          );
        })}
      </ul>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </section>
  );
}

function LayerIcon({
  title,
  onClick,
  className,
  children,
}: {
  title: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      title={title}
      onClick={onClick}
      className={cn("size-6 text-muted-foreground [&_svg]:size-3.5", className)}
    >
      {children}
    </Button>
  );
}
