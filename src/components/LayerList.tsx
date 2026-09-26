import {
  Award,
  ClipboardPaste,
  Copy,
  CornerDownRight,
  Crop,
  Database,
  Eye,
  EyeOff,
  Gamepad2,
  GitBranch,
  Globe,
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
  const hasForeign = showForeign && (foreignGlobal.length > 0 || foreignConsole.length > 0);
  // A view-only toggle (not persisted) for when the global/console template
  // rows crowd out the card's own layers.
  const [hideForeign, setHideForeign] = useState(false);

  // The console's logo image slots into the global template's logo frame
  // and draws there (src/faceLayers.ts#buildFaceLayers) — shown nested
  // under that frame's row instead of its own normal spot, matching where
  // it actually draws. It's an own (editable) layer while editing the
  // console template that owns it, a foreign (console) one on a card.
  const ownLogo = layers.find((l) => l.type === "image" && l.logo);
  const foreignLogo = foreignConsole.find((l) => l.type === "image" && l.logo);

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

  // One combined, top-of-stack-first row list: own layers slot in right
  // above whichever foreign (console/global) layer they're anchored to
  // (`stackAfterId`, set by dragging them there — see applyDrop below),
  // or at the very bottom (the old fixed behaviour) when unanchored. Only
  // active while the foreign rows are actually shown — hidden or on the
  // back face, it's just the plain own list, as it always was. A layer
  // clipped into a mask never anchors — its position there always wins.
  type MergedRow =
    | { kind: "own" | "own-logo"; layer: Layer }
    | { kind: "foreign-global" | "foreign-console" | "foreign-console-logo"; layer: Layer };
  const foreignIdSet = new Set([...foreignGlobal, ...foreignConsole].map((l) => l.id));
  const buildMerged = (): MergedRow[] => {
    const interleave = showForeign && !hideForeign;
    const anchoredOwn = new Map<string, Layer[]>();
    const unanchored: Layer[] = [];
    for (const l of layers) {
      if (l.id === ownLogo?.id) continue; // placed specially below, nested under the logo slot
      if (interleave && !l.mask && !l.clipped && l.stackAfterId && foreignIdSet.has(l.stackAfterId)) {
        const arr = anchoredOwn.get(l.stackAfterId) ?? [];
        arr.push(l);
        anchoredOwn.set(l.stackAfterId, arr);
      } else {
        unanchored.push(l);
      }
    }
    const rows: MergedRow[] = [];
    if (interleave) {
      for (const l of foreignGlobal) {
        for (const al of anchoredOwn.get(l.id) ?? []) rows.push({ kind: "own", layer: al });
        rows.push({ kind: "foreign-global", layer: l });
        if (l.logoSlot) {
          if (ownLogo) rows.push({ kind: "own-logo", layer: ownLogo });
          else if (foreignLogo) rows.push({ kind: "foreign-console-logo", layer: foreignLogo });
        }
      }
      for (const l of foreignConsole) {
        if (l.id === foreignLogo?.id) continue;
        for (const al of anchoredOwn.get(l.id) ?? []) rows.push({ kind: "own", layer: al });
        rows.push({ kind: "foreign-console", layer: l });
      }
    }
    for (const l of unanchored) rows.push({ kind: "own", layer: l });
    return rows;
  };

  const applyDrop = (srcId: string, tgtId: string, after: boolean) => {
    if (srcId === tgtId) return;
    const merged = buildMerged();
    const ids = merged.map((r) => r.layer.id).filter((id) => id !== srcId);
    let ti = ids.indexOf(tgtId);
    if (ti < 0) return;
    if (after) ti += 1;
    ids.splice(ti, 0, srcId);
    const ownOrder = ids.filter((id) => !foreignIdSet.has(id));
    // A layer clipped into a mask keeps its stacking anchor untouched —
    // it's ignored for rendering either way — only its relative order
    // among its own siblings (still meaningful for its mask group) moves.
    const srcLayer = layers.find((l) => l.id === srcId);
    const masked = !!(srcLayer?.mask || srcLayer?.clipped);
    let afterId: string | undefined;
    if (!masked) {
      const srcIndex = ids.indexOf(srcId);
      for (let i = srcIndex + 1; i < ids.length; i++) {
        if (foreignIdSet.has(ids[i])) {
          afterId = ids[i];
          break;
        }
      }
    }
    dispatch({
      type: "SET_LAYER_ORDER",
      order: [...ownOrder].reverse(),
      stackAnchor: masked ? undefined : { id: srcId, afterId },
    });
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

  const foreignRow = (l: Layer, source: "console" | "global", nested = false) => {
    const Icon = iconFor(l);
    const editable = l.type === "shape" || l.type === "background";
    const active = foreignSelectedId === l.id;
    // A card/console layer can be dragged to stack right above this one —
    // except a layer clipped into a mask, whose position there always wins.
    const canDropHere = () => {
      const src = dragId.current;
      if (!src) return false;
      const srcLayer = layers.find((sl) => sl.id === src);
      return !!srcLayer && !srcLayer.mask && !srcLayer.clipped;
    };
    return (
      <li
        key={l.id}
        onDragOver={(e) => {
          if (!canDropHere()) return;
          e.preventDefault();
          const r = e.currentTarget.getBoundingClientRect();
          setOver({ id: l.id, after: e.clientY > r.top + r.height / 2 });
        }}
        onDrop={(e) => {
          if (!canDropHere()) return;
          e.preventDefault();
          const src = dragId.current;
          const r = e.currentTarget.getBoundingClientRect();
          if (src) applyDrop(src, l.id, e.clientY > r.top + r.height / 2);
          reset();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY, items: buildForeignMenuItems({ layer: l, t }) });
        }}
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-dashed px-1.5 py-1 text-sm text-muted-foreground",
          active ? "border-primary bg-accent" : "bg-muted/30",
          nested && "ml-3 border-l-2 border-l-sky-500/60",
          over?.id === l.id &&
            (over.after
              ? "border-b-2 border-b-primary"
              : "border-t-2 border-t-primary"),
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
          {nested && <CornerDownRight className="size-3.5 shrink-0 text-sky-500" />}
          <span
            className="shrink-0"
            title={source === "global" ? t("Global Layout") : t("Console Layout")}
          >
            {source === "global" ? <Globe className="size-3" /> : <Gamepad2 className="size-3" />}
          </span>
          <Icon className="size-3.5 shrink-0" />
          <span className="truncate">{nameOf(l, t)}</span>
          {editable && <Pencil className="size-3 shrink-0 text-primary" />}
        </button>
        <Lock className="size-3.5 shrink-0 opacity-60" />
      </li>
    );
  };

  const ownRow = (l: Layer, nested = false) => {
    const active = l.id === state.selectedId;
    const bg = isBackground(l);
    const Icon = iconFor(l);
    // A case that the metadata doesn't select still prints nothing — dim
    // it, but keep it clickable so it can be edited.
    const dimmed = !!l.condId && !live.has(l.id);
    return (
      <li
        key={l.id}
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
          nested && "ml-3 border-l-2 border-l-sky-500/60",
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
          {nested && <CornerDownRight className="size-3.5 shrink-0 text-sky-500" />}
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
          {hasForeign && (
            <Button
              variant="ghost"
              size="icon"
              title={
                hideForeign
                  ? t("Show the global / console template layers")
                  : t("Hide the global / console template layers")
              }
              className="size-7 text-muted-foreground"
              onClick={() => setHideForeign((v) => !v)}
            >
              {hideForeign ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          )}
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
        {buildMerged().map((r) => {
          switch (r.kind) {
            case "own":
              return (
                <Fragment key={r.layer.id}>
                  {ownRow(r.layer)}
                  {r.layer.type === "shape" &&
                    r.layer.combine?.map((c, i) => combineRow(r.layer, i, c))}
                </Fragment>
              );
            case "own-logo":
              return <Fragment key={r.layer.id}>{ownRow(r.layer, true)}</Fragment>;
            case "foreign-global":
              return <Fragment key={r.layer.id}>{foreignRow(r.layer, "global")}</Fragment>;
            case "foreign-console":
              return <Fragment key={r.layer.id}>{foreignRow(r.layer, "console")}</Fragment>;
            case "foreign-console-logo":
              return <Fragment key={r.layer.id}>{foreignRow(r.layer, "console", true)}</Fragment>;
          }
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
