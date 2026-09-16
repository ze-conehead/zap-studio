import Konva from "konva";
import { Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Layer, Line, Stage, Transformer } from "react-konva";
import { cn } from "@/lib/utils";
import type { GuideApi } from "../App";
import { isBackground, makeImageLayer } from "../factory";
import { fileToLayerSource } from "../image";
import { CANVAS, CORNER_RADIUS_PX, TRIM_RECT } from "../card";
import { useT } from "../i18n";
import { askConfirm } from "./ConfirmDialog";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { buildLayerMenuItems } from "./layerContextMenu";
import type { GameMeta } from "../gamelist";
import { getGamelistVersion, resolveBadgeMeta, subscribeGamelists } from "../gamelist";
import { hiddenCaseIds, resolveConditions } from "../conditions";
import { segmentLayers } from "../masking";
import { isAlphaMask } from "../templates";
import { placeholderContextFor } from "../placeholders";
import { sweepMaskMove } from "../maskSweep";
import { useStore } from "../store";
import { useAccent } from "../theme";
import type {
  CardBackground,
  CardSide,
  Layer as TLayer,
  ShapeLayer as TShapeLayer,
} from "../types";
import { buildFaceLayers, effectiveBgFill } from "../faceLayers";
import { CardBackgroundNodes, ReadOnlyLayer } from "./canvas/layerInner";
import { LayerNode } from "./canvas/LayerNode";
import { GuideLine, Guides, MainMaskOutline, PanelGuides, TextFrameOutline } from "./canvas/outlines";
import { layerBoxSize, type SnapHit, type SnapLines } from "./canvas/snapping";

// The face rendering itself lives in ./canvas/*; these stay exported here
// for CardStage.
export { buildFaceLayers, effectiveBgFill };
export { CardBackgroundNodes, LayerInner } from "./canvas/layerInner";

export interface CanvasHandle {
  // `side` omitted → the currently active face.
  getStage: (side?: CardSide) => Konva.Stage | null;
  getStageWidth: () => number;
}

export function EditorCanvas({
  handleRef,
  overlay = [],
  consoleBg,
  globalBg,
  masks = [],
  logoSlot,
  guides,
}: {
  handleRef: React.MutableRefObject<CanvasHandle | null>;
  overlay?: TLayer[];
  consoleBg?: CardBackground;
  globalBg?: CardBackground;
  masks?: TLayer[];
  logoSlot?: TLayer;
  guides: GuideApi;
}) {
  const { state, dispatch } = useStore();
  const { project, side, showBleed } = state;
  // Re-render whenever a gamelist.xml is uploaded/removed, even without
  // navigating away, so MetaBadge layers stay live.
  useSyncExternalStore(subscribeGamelists, getGamelistVersion, getGamelistVersion);
  const badgeMeta = resolveBadgeMeta(project);

  const hasBack = !!project.back;
  const nFaces = hasBack ? 2 : 1;

  const wrapRef = useRef<HTMLDivElement>(null);
  const stages = useRef<Record<CardSide, Konva.Stage | null>>({
    front: null,
    back: null,
  });
  const [scale, setScale] = useState(0.5);

  const registerFront = useCallback((s: Konva.Stage | null) => {
    stages.current.front = s;
  }, []);
  const registerBack = useCallback((s: Konva.Stage | null) => {
    stages.current.back = s;
  }, []);

  // Fit both faces + the gap into the canvas area.
  const measure = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const pad = 48;
    const gap = 24;
    const availW = el.clientWidth - pad - gap * (nFaces - 1);
    const availH = el.clientHeight - pad;
    setScale(
      Math.max(
        0.12,
        Math.min(availW / (CANVAS.w * nFaces), availH / CANVAS.h),
      ),
    );
  }, [nFaces]);
  useLayoutEffect(() => {
    measure();
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  useLayoutEffect(() => {
    handleRef.current = {
      getStage: (s) => stages.current[s ?? side],
      getStageWidth: () => CANVAS.w * scale,
    };
  });

  return (
    <div
      className="canvas-checker grid flex-1 place-items-center overflow-auto p-6"
      ref={wrapRef}
      // Swallow file drops that miss a face so the browser doesn't open them.
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
    >
      <div className="flex items-start gap-6">
        <FaceStage
          side="front"
          active={side === "front"}
          caption={hasBack}
          scale={scale}
          overlay={overlay}
          consoleBg={consoleBg}
          globalBg={globalBg}
          masks={masks}
          logoSlot={logoSlot}
          guides={guides}
          badgeMeta={badgeMeta}
          showBleed={showBleed}
          registerStage={registerFront}
        />
        {hasBack && (
          <FaceStage
            side="back"
            active={side === "back"}
            caption
            scale={scale}
            guides={guides}
            badgeMeta={badgeMeta}
            showBleed={showBleed}
            onRemove={() => dispatch({ type: "REMOVE_BACK" })}
            registerStage={registerBack}
          />
        )}
      </div>
    </div>
  );
}

// One editable card face. Two of these sit side by side once a back exists;
// clicking a face (or one of its layers) makes it the active one.
function FaceStage({
  side,
  active,
  caption,
  scale,
  overlay = [],
  consoleBg,
  globalBg,
  masks = [],
  logoSlot,
  guides,
  badgeMeta,
  showBleed,
  registerStage,
  onRemove,
}: {
  side: CardSide;
  active: boolean;
  caption: boolean;
  scale: number;
  overlay?: TLayer[];
  consoleBg?: CardBackground;
  globalBg?: CardBackground;
  masks?: TLayer[];
  logoSlot?: TLayer;
  guides: GuideApi;
  badgeMeta?: GameMeta;
  showBleed: boolean;
  registerStage: (s: Konva.Stage | null) => void;
  onRemove?: () => void;
}) {
  const t = useT();
  const { state, dispatch } = useStore();
  const accent = useAccent();
  const { project, selectedId } = state;
  const back = side === "back";

  const faceLayers = back ? project.back?.layers ?? [] : project.layers;
  const bgLayer = faceLayers.find(isBackground);
  const layerList = faceLayers.filter((l) => !isBackground(l));
  // On "All consoles" the slot is one of this face's own layers; on a card it
  // arrives from the global template via the prop.
  const slotOutline = project.isGlobalTemplate ? undefined : logoSlot;

  // Front game cards may inherit the background fill from a template; a card
  // or console template with no background layer at all falls back to the
  // global background. The back face and the global template use their own.
  const bg = effectiveBgFill(bgLayer, {
    inherit: !back && !project.isTemplate,
    fallback: back || project.isGlobalTemplate ? undefined : globalBg,
    consoleBg,
    globalBg,
  });
  // The back is a plain face — no template overlay, no main alpha mask.
  // The slot is editable where it lives ("All consoles") and invisible
  // everywhere else — cards see it only as the outline below.
  // Condition layers pick which of their cases is live for this game. The
  // selected layer is kept whatever the metadata says, so a case that isn't
  // the live branch can still be worked on.
  // What a flowing text frame breaks around: the alpha mask frames this face
  // can see — its own while a template is open, the templates' on a card.
  const obstacles = [
    ...layerList.filter((l) => l.alphaMask),
    ...masks.filter((m) => !layerList.some((l) => l.id === m.id)),
  ];

  const vars = placeholderContextFor(project, badgeMeta);
  const hiddenCases = hiddenCaseIds(layerList, badgeMeta);
  const preview = active && selectedId && hiddenCases.has(selectedId) ? selectedId : null;
  const cases = resolveConditions(layerList, badgeMeta, preview).filter(
    (l: TLayer) => !l.logoSlot || project.isGlobalTemplate,
  );
  // The back is a plain face — no template overlay, no alpha masks.
  const { layers: renderLayers, foreignIds } = buildFaceLayers(
    project,
    cases,
    back ? [] : resolveConditions(overlay, badgeMeta),
    masks,
  );

  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef(new Map<string, Konva.Node>());

  useEffect(() => {
    registerStage(stageRef.current);
    return () => registerStage(null);
  }, [registerStage]);

  // Bind the transformer to the selected node — only on the active face.
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node =
      active && selectedId ? nodeRefs.current.get(selectedId) : undefined;
    const layer = layerList.find((l) => l.id === selectedId);
    tr.nodes(active && node && layer && !layer.locked ? [node] : []);
    tr.getLayer()?.batchDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, active, project, side]);

  const selectLayer = (id: string) =>
    dispatch(
      active
        ? { type: "SELECT", id }
        : { type: "SET_SIDE", side, selectId: id },
    );
  // Right-click on a layer: the same actions the Layers panel offers,
  // without leaving the canvas.
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const layerMenu = (layer: TLayer, e: MouseEvent) => {
    const items = buildLayerMenuItems({ layer, faceLayers, dispatch, t });
    setMenu({ x: e.clientX, y: e.clientY, items });
  };
  const deselect = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage() || e.target.name() === "bg") {
      dispatch(
        active
          ? { type: "SELECT", id: null }
          : { type: "SET_SIDE", side, selectId: null },
      );
    }
  };

  const stageW = CANVAS.w * scale;
  const stageH = CANVAS.h * scale;
  const cropped = !showBleed;
  const viewW = (cropped ? TRIM_RECT.w : CANVAS.w) * scale;
  const viewH = (cropped ? TRIM_RECT.h : CANVAS.h) * scale;

  // Drag image files straight from the OS onto a face → added as plain
  // image layers at the drop point (never the card's main image).
  const [dropActive, setDropActive] = useState(false);
  const dropImages = async (e: React.DragEvent<HTMLDivElement>) => {
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (!files.length) return;
    if (!active) dispatch({ type: "SET_SIDE", side });

    const boxRect = e.currentTarget.getBoundingClientRect();
    let cx = (cropped ? TRIM_RECT.x : 0) + (e.clientX - boxRect.left) / scale;
    let cy = (cropped ? TRIM_RECT.y : 0) + (e.clientY - boxRect.top) / scale;
    for (const file of files) {
      try {
        const img = await fileToLayerSource(file);
        dispatch({
          type: "ADD_LAYER",
          layer: {
            ...makeImageLayer({ ...img, name: file.name.replace(/\.[^.]+$/, "") }),
            x: cx,
            y: cy,
          },
        });
        cx += 24;
        cy += 24;
      } catch (err) {
        alert((err as Error).message);
      }
    }
  };
  const guidesEditable =
    !back && !!project.isGlobalTemplate && !guides.state.locked;

  // What a dragged layer can snap to: the user's guides (when those are
  // shown), the trim box, and every other visible layer's edges and centre.
  // Tolerance is a fixed on-screen distance (≈ 7 px).
  const gs = guides.state;
  const snapLines: SnapLines | undefined = useMemo(() => {
    if (!gs.snap) return undefined;

    const xs: number[] = [];
    const ys: number[] = [];
    const smartX: number[] = [];
    const smartY: number[] = [];

    if (gs.on) {
      for (const g of gs.items) (g.axis === "x" ? xs : ys).push(g.pos);
    }

    // The card itself — its edges and its middle.
    smartX.push(TRIM_RECT.x, TRIM_RECT.x + TRIM_RECT.w / 2, TRIM_RECT.x + TRIM_RECT.w);
    smartY.push(TRIM_RECT.y, TRIM_RECT.y + TRIM_RECT.h / 2, TRIM_RECT.y + TRIM_RECT.h);

    // Every other layer on this face, from its unrotated box. Rotated layers
    // are skipped — their bounding box would snap to something invisible.
    for (const l of layerList) {
      if (l.id === selectedId || !l.visible || l.rotation) continue;
      const w = layerBoxSize(l);
      if (!w) continue;
      const hw = (w.w * Math.abs(l.scaleX)) / 2;
      const hh = (w.h * Math.abs(l.scaleY)) / 2;
      smartX.push(l.x - hw, l.x, l.x + hw);
      smartY.push(l.y - hh, l.y, l.y + hh);
    }

    return { xs, ys, smartX, smartY, tol: 7 / scale };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.snap, gs.on, gs.items, layerList, selectedId, scale]);

  // Which guides the dragged layer is snapped to right now — highlighted so
  // it's clear what it's aligning to. Only updates when the set changes.
  const [snapHit, setSnapHit] = useState<SnapHit | null>(null);
  const reportSnap = useCallback((hit: SnapHit | null) => {
    setSnapHit((prev) => {
      const eq = (a?: number[], b?: number[]) =>
        !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);
      if (!hit) return prev === null ? prev : null;
      if (
        prev &&
        eq(prev.xs, hit.xs) &&
        eq(prev.ys, hit.ys) &&
        eq(prev.smartX, hit.smartX) &&
        eq(prev.smartY, hit.smartY)
      ) {
        return prev;
      }
      return hit;
    });
  }, []);

  return (
    <div className="flex flex-col">
      {caption && (
        <div className="mb-1.5 flex h-5 items-center justify-between text-xs font-medium">
          <span className={cn(active ? "text-foreground" : "text-muted-foreground")}>
            {back ? t("Back") : t("Front")}
          </span>
          {onRemove && (
            <button
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-destructive"
              title={t("Remove back side")}
              onClick={async () => {
                const ok = await askConfirm({
                  title: t("Remove the back side?"),
                  body: t("Its layers are deleted."),
                  confirmLabel: t("Remove back side"),
                  destructive: true,
                });
                if (ok) onRemove();
              }}
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      )}
      <div
        className={cn(
          "relative overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)]",
          dropActive
            ? "outline-dashed outline-2 outline-offset-2 outline-primary"
            : caption &&
                (active
                  ? "outline outline-2 outline-offset-2 outline-primary"
                  : "outline outline-1 outline-offset-2 outline-white/10"),
        )}
        style={{
          width: viewW,
          height: viewH,
          borderRadius: cropped ? CORNER_RADIUS_PX * scale : 3,
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDropActive(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDropActive(false);
          }
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDropActive(false);
          void dropImages(e);
        }}
      >
        <Stage
          ref={stageRef}
          width={stageW}
          height={stageH}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={deselect}
          onTouchStart={deselect}
          style={{
            position: "absolute",
            left: cropped ? -TRIM_RECT.x * scale : 0,
            top: cropped ? -TRIM_RECT.y * scale : 0,
          }}
        >
          {bg && (
            <Layer listening={false} opacity={bgLayer?.opacity ?? 1}>
              <CardBackgroundNodes bg={bg} />
            </Layer>
          )}

          {segmentLayers(renderLayers).map((seg, i) => {
            const render = (
              layer: TLayer,
              asMask = false,
              groupChildren?: TLayer[],
            ) =>
              !layer.visible ? null : foreignIds.has(layer.id) ? (
                <ReadOnlyLayer
                  key={layer.id}
                  layer={layer}
                  asMask={asMask}
                  meta={badgeMeta}
                  vars={vars}
                  obstacles={obstacles}
                />
              ) : (
                <LayerNode
                  key={layer.id}
                  layer={layer}
                  asMask={asMask}
                  previewOnly={layer.id === preview}
                  obstacles={obstacles}
                  selected={active && layer.id === selectedId}
                  groupChildren={groupChildren}
                  meta={badgeMeta}
                  vars={vars}
                  snapLines={snapLines}
                  onSnap={reportSnap}
                  register={(n) => {
                    if (n) nodeRefs.current.set(layer.id, n);
                    else nodeRefs.current.delete(layer.id);
                  }}
                  onSelect={() => selectLayer(layer.id)}
                  onContextMenu={(e) => layerMenu(layer, e)}
                  onChange={(patch, history) => {
                    dispatch({ type: "PATCH_LAYER", id: layer.id, patch, history });
                    // A committed move/resize/rotate of an alpha mask (only
                    // meaningful in a template) re-fits every image
                    // elsewhere that points at it, so it stays aligned
                    // instead of silently drifting out of the frame.
                    if (history && project.isTemplate && isAlphaMask(layer)) {
                      void sweepMaskMove(
                        { ...layer, ...patch } as TShapeLayer,
                        project.id,
                      );
                    }
                  }}
                  onGroupChange={(patches, history) => {
                    dispatch({ type: "PATCH_LAYERS", patches, history });
                    // groupTransform's own patches[0] is always the mask
                    // itself (the group layer) — see applyGroup() below.
                    if (history && project.isTemplate && isAlphaMask(layer)) {
                      void sweepMaskMove(
                        { ...layer, ...patches[0]?.patch } as TShapeLayer,
                        project.id,
                      );
                    }
                  }}
                />
              );

            return (
              <Layer key={`seg-${i}`}>
                {seg.kind === "plain"
                  ? seg.layers.map((l) => render(l))
                  : [
                      ...seg.clipped.map((l) => render(l)),
                      // a mask with nothing under it renders normally so it stays visible
                      render(
                        seg.mask,
                        seg.clipped.length > 0,
                        seg.mask.groupTransform ? seg.clipped : undefined,
                      ),
                    ]}
              </Layer>
            );
          })}

          <Layer name="guides" listening={false}>
            <Guides showBleed={showBleed} />
            <PanelGuides />

            {!back && slotOutline && (
              <MainMaskOutline mask={slotOutline} colour="#38bdf8" />
            )}
            {!back &&
              !project.isTemplate &&
              masks.map((m) => (
                <MainMaskOutline key={m.id} mask={m} colour="#a78bfa" />
              ))}
            {renderLayers.map((l) =>
              l.type === "text" && l.flow && l.visible ? (
                <TextFrameOutline key={`frame-${l.id}`} layer={l} />
              ) : null,
            )}
            {snapHit?.smartX.map((x) => (
              <Line
                key={`sx${x}`}
                points={[x, 0, x, CANVAS.h]}
                stroke="#f59e0b"
                strokeWidth={1}
                listening={false}
              />
            ))}
            {snapHit?.smartY.map((y) => (
              <Line
                key={`sy${y}`}
                points={[0, y, CANVAS.w, y]}
                stroke="#f59e0b"
                strokeWidth={1}
                listening={false}
              />
            ))}
          </Layer>

          {guides.state.on && guides.state.items.length > 0 && (
            <Layer name="guides" listening={guidesEditable}>
              {guides.state.items.map((g) => (
                <GuideLine
                  key={g.id}
                  guide={g}
                  readOnly={!guidesEditable}
                  highlight={
                    !!snapHit &&
                    (g.axis === "x" ? snapHit.xs : snapHit.ys).includes(g.pos)
                  }
                  onMove={(pos) => guides.update(g.id, pos)}
                  onRemove={() => guides.remove(g.id)}
                />
              ))}
            </Layer>
          )}

          <Layer>
            <Transformer
              ref={trRef}
              rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
              anchorSize={10}
              anchorCornerRadius={5}
              borderStroke={accent}
              anchorStroke={accent}
              anchorFill={accent}
              boundBoxFunc={(oldBox, newBox) =>
                newBox.width < 8 || newBox.height < 8 ? oldBox : newBox
              }
            />
          </Layer>
        </Stage>
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  );
}
