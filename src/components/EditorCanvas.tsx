import Konva from "konva";
import { Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Circle,
  Ellipse,
  Group,
  Image as KImage,
  Layer,
  Line,
  Rect,
  Stage,
  Star,
  Text,
  Transformer,
} from "react-konva";
import { cn } from "@/lib/utils";
import type { GuideApi } from "../App";
import type { Guide } from "../guides";
import { gradientFill, noiseTile } from "../background";
import { isBackground, makeImageLayer } from "../factory";
import { fileToLayerSource } from "../image";
import { CANVAS, CORNER_RADIUS_PX, FOLD_X, PANELS, TRIM_RECT } from "../card";
import { t, useT } from "../i18n";
import type { GameMeta } from "../gamelist";
import {
  getGamelistVersion,
  ratingOutOfFive,
  releaseYear,
  resolveBadgeMeta,
  subscribeGamelists,
} from "../gamelist";
import { useImage } from "../hooks/useImage";
import { segmentLayers } from "../masking";
import { useStore } from "../store";
import type {
  BackgroundLayer as TBackgroundLayer,
  CardBackground,
  CardSide,
  ImageLayer as TImageLayer,
  Layer as TLayer,
  MetaBadgeLayer as TMetaBadgeLayer,
  PlayersIconStyle,
  Project,
  ShapeLayer as TShapeLayer,
  TextLayer as TTextLayer,
} from "../types";
import { fontStyleString } from "../textUtil";

export interface CanvasHandle {
  // `side` omitted → the currently active face.
  getStage: (side?: CardSide) => Konva.Stage | null;
  getStageWidth: () => number;
}

// Splices the global "main alpha mask" in as a real mask layer directly
// above the card's main image, so segmentLayers()/destination-in clips it
// like any other mask. Only for game cards, and only when the main image
// isn't already part of a card mask.
export function withMainMask(
  project: Project,
  layers: TLayer[],
  mainMask: TLayer | undefined,
): TLayer[] {
  if (!mainMask || project.isTemplate) return layers;

  let idx = layers.findIndex((l) => l.type === "image" && l.main && l.visible);
  if (idx < 0) {
    const imgs = layers.filter((l) => l.type === "image" && l.visible);
    if (imgs.length === 1) idx = layers.indexOf(imgs[0]);
  }
  if (idx < 0) return layers;
  if (layers[idx].mask || layers[idx].clipped) return layers;

  const stencil: TLayer = {
    ...mainMask,
    id: `__mainmask__${mainMask.id}`,
    name: t("Main alpha mask"),
    mask: true,
    clipped: false,
    groupTransform: false,
    main: false,
    mainMask: false,
    locked: true,
    visible: true,
  };
  const out = layers.map((l, i) => (i === idx ? { ...l, clipped: true } : l));
  out.splice(idx + 1, 0, stencil);
  return out;
}

// The fill a background layer actually paints. `inherit` (front game cards)
// lets it pull the fill from the console / global template instead.
// `fallback` is painted when the face has no background layer at all — a
// console or card with none inherits the global background.
export function effectiveBgFill(
  bgLayer: TBackgroundLayer | undefined,
  opts: {
    inherit: boolean;
    fallback?: CardBackground;
    consoleBg?: CardBackground;
    globalBg?: CardBackground;
  },
): CardBackground | null {
  if (!bgLayer) return opts.fallback ?? null;
  if (!bgLayer.visible) return null;
  if (opts.inherit) {
    if (bgLayer.source === "global") return opts.globalBg ?? null;
    if (bgLayer.source === "console") return opts.consoleBg ?? null;
  }
  return bgLayer.fill;
}

export function EditorCanvas({
  handleRef,
  overlay = [],
  consoleBg,
  globalBg,
  mainMask,
  guides,
}: {
  handleRef: React.MutableRefObject<CanvasHandle | null>;
  overlay?: TLayer[];
  consoleBg?: CardBackground;
  globalBg?: CardBackground;
  mainMask?: TLayer;
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

  handleRef.current = {
    getStage: (s) => stages.current[s ?? side],
    getStageWidth: () => CANVAS.w * scale,
  };

  return (
    <div
      className="canvas-checker grid flex-1 place-items-center overflow-auto bg-[#161617] p-6"
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
          mainMask={mainMask}
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
  mainMask,
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
  mainMask?: TLayer;
  guides: GuideApi;
  badgeMeta?: GameMeta;
  showBleed: boolean;
  registerStage: (s: Konva.Stage | null) => void;
  onRemove?: () => void;
}) {
  const t = useT();
  const { state, dispatch } = useStore();
  const { project, selectedId } = state;
  const back = side === "back";

  const faceLayers = back ? project.back?.layers ?? [] : project.layers;
  const bgLayer = faceLayers.find(isBackground);
  const layerList = faceLayers.filter((l) => !isBackground(l));

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
  const renderLayers = back
    ? layerList
    : withMainMask(project, layerList, mainMask);
  const overlayLayers = back ? [] : overlay;

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

  // Dragged layers snap to the guides while snapping is on and guides are
  // visible. Tolerance is a fixed on-screen distance (≈ 7 px).
  const gs = guides.state;
  const snapLines: SnapLines | undefined =
    gs.on && gs.snap && gs.items.length > 0
      ? {
          xs: gs.items.filter((g) => g.axis === "x").map((g) => g.pos),
          ys: gs.items.filter((g) => g.axis === "y").map((g) => g.pos),
          tol: 7 / scale,
        }
      : undefined;

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
              onClick={() => {
                if (window.confirm(t("Remove the back side? Its layers are deleted."))) {
                  onRemove();
                }
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
              layer.visible ? (
                <LayerNode
                  key={layer.id}
                  layer={layer}
                  asMask={asMask}
                  selected={active && layer.id === selectedId}
                  groupChildren={groupChildren}
                  meta={badgeMeta}
                  snapLines={snapLines}
                  register={(n) => {
                    if (n) nodeRefs.current.set(layer.id, n);
                    else nodeRefs.current.delete(layer.id);
                  }}
                  onSelect={() => selectLayer(layer.id)}
                  onChange={(patch, history) =>
                    dispatch({ type: "PATCH_LAYER", id: layer.id, patch, history })
                  }
                  onGroupChange={(patches, history) =>
                    dispatch({ type: "PATCH_LAYERS", patches, history })
                  }
                />
              ) : null;

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

          {overlayLayers.length > 0 && (
            <Layer listening={false}>
              {overlayLayers.map((layer) =>
                layer.visible ? (
                  <ReadOnlyLayer key={layer.id} layer={layer} meta={badgeMeta} />
                ) : null,
              )}
            </Layer>
          )}

          <Layer name="guides" listening={false}>
            <Guides showBleed={showBleed} />
            <PanelGuides />
          </Layer>

          {guides.state.on && guides.state.items.length > 0 && (
            <Layer name="guides" listening={guidesEditable}>
              {guides.state.items.map((g) => (
                <GuideLine
                  key={g.id}
                  guide={g}
                  readOnly={!guidesEditable}
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
              borderStroke="#d4d4d8"
              anchorStroke="#d4d4d8"
              anchorFill="#f4f4f5"
              boundBoxFunc={(oldBox, newBox) =>
                newBox.width < 8 || newBox.height < 8 ? oldBox : newBox
              }
            />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}

interface GroupSnapshot {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  kids: {
    id: string;
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
  }[];
}

// Guide positions (canvas px) a dragged layer can snap to, plus how close
// (canvas px) counts as "near".
interface SnapLines {
  xs: number[];
  ys: number[];
  tol: number;
}

// While dragging, nudge `node` so its nearest edge or centre lines up with a
// guide within `tol`. Mutates the node directly; the caller then commits.
function snapNodeToGuides(node: Konva.Node, lines: SnapLines) {
  const box = node.getClientRect({ relativeTo: node.getLayer() ?? undefined });
  const anchorsX = [box.x, box.x + box.width / 2, box.x + box.width];
  const anchorsY = [box.y, box.y + box.height / 2, box.y + box.height];

  const nearest = (anchors: number[], guides: number[], tol: number) => {
    let delta = 0;
    let best = tol + 1;
    for (const a of anchors) {
      for (const g of guides) {
        const d = g - a;
        if (Math.abs(d) < best) {
          best = Math.abs(d);
          delta = d;
        }
      }
    }
    return best <= tol ? delta : 0;
  };

  node.x(node.x() + nearest(anchorsX, lines.xs, lines.tol));
  node.y(node.y() + nearest(anchorsY, lines.ys, lines.tol));
}

function LayerNode({
  layer,
  asMask = false,
  selected = false,
  groupChildren,
  meta,
  snapLines,
  register,
  onSelect,
  onChange,
  onGroupChange,
}: {
  layer: TLayer;
  asMask?: boolean;
  selected?: boolean;
  groupChildren?: TLayer[];
  meta?: GameMeta;
  snapLines?: SnapLines;
  register: (n: Konva.Node | null) => void;
  onSelect: () => void;
  onChange: (patch: Partial<TLayer>, history?: boolean) => void;
  onGroupChange: (
    patches: { id: string; patch: Partial<TLayer> }[],
    history?: boolean,
  ) => void;
}) {
  const ref = useRef<Konva.Group>(null);
  const snap = useRef<GroupSnapshot | null>(null);
  const grouped = !!groupChildren && groupChildren.length > 0;

  useEffect(() => {
    register(ref.current);
    return () => register(null);
  }, [register]);

  const snapshot = () => {
    snap.current = {
      x: layer.x,
      y: layer.y,
      rotation: layer.rotation,
      scaleX: layer.scaleX,
      scaleY: layer.scaleY,
      kids: (groupChildren ?? []).map((k) => ({
        id: k.id,
        x: k.x,
        y: k.y,
        rotation: k.rotation,
        scaleX: k.scaleX,
        scaleY: k.scaleY,
      })),
    };
  };

  const applyGroup = (history: boolean) => {
    const n = ref.current!;
    const o = snap.current;
    if (!o) return;
    const dRot = n.rotation() - o.rotation;
    const sx = o.scaleX ? n.scaleX() / o.scaleX : 1;
    const sy = o.scaleY ? n.scaleY() / o.scaleY : 1;
    const rad = (dRot * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const patches = [
      {
        id: layer.id,
        patch: {
          x: n.x(),
          y: n.y(),
          rotation: n.rotation(),
          scaleX: n.scaleX(),
          scaleY: n.scaleY(),
        },
      },
      ...o.kids.map((k) => {
        const vx = (k.x - o.x) * sx;
        const vy = (k.y - o.y) * sy;
        return {
          id: k.id,
          patch: {
            x: n.x() + (vx * cos - vy * sin),
            y: n.y() + (vx * sin + vy * cos),
            rotation: k.rotation + dRot,
            scaleX: k.scaleX * sx,
            scaleY: k.scaleY * sy,
          },
        };
      }),
    ];
    onGroupChange(patches, history);
  };

  const common = {
    ref,
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    opacity: layer.opacity,
    // A rendered mask is a stencil: while unselected it must not intercept
    // canvas clicks (so clicking the visible area selects the clipped
    // content). Once selected from the layer list it becomes draggable again.
    listening: !asMask || selected,
    draggable: !layer.locked && (!asMask || selected),
    onMouseDown: onSelect,
    onTap: onSelect,
    onDragStart: grouped ? snapshot : undefined,
    onDragMove: grouped
      ? () => applyGroup(false)
      : (e: Konva.KonvaEventObject<DragEvent>) => {
          if (snapLines) snapNodeToGuides(e.target, snapLines);
          onChange({ x: e.target.x(), y: e.target.y() }, false);
        },
    onDragEnd: grouped
      ? () => applyGroup(true)
      : (e: Konva.KonvaEventObject<DragEvent>) => {
          if (snapLines) snapNodeToGuides(e.target, snapLines);
          onChange({ x: e.target.x(), y: e.target.y() }, true);
        },
    onTransformStart: grouped ? snapshot : undefined,
    onTransformEnd: grouped
      ? () => applyGroup(true)
      : () => {
          const n = ref.current!;
          // Shapes bake the resize into width/height and keep scale at 1, so
          // a rounded corner stays a true constant radius instead of being
          // stretched by a non-uniform node scale.
          if (layer.type === "shape") {
            const sx = n.scaleX();
            const sy = n.scaleY();
            n.scaleX(1);
            n.scaleY(1);
            onChange(
              {
                x: n.x(),
                y: n.y(),
                rotation: n.rotation(),
                scaleX: 1,
                scaleY: 1,
                width: Math.max(4, layer.width * sx),
                height: Math.max(4, layer.height * sy),
              },
              true,
            );
            return;
          }
          onChange(
            {
              x: n.x(),
              y: n.y(),
              rotation: n.rotation(),
              scaleX: n.scaleX(),
              scaleY: n.scaleY(),
            },
            true,
          );
        },
  };

  return (
    <Group {...common}>
      <LayerInner layer={layer} asMask={asMask} meta={meta} />
    </Group>
  );
}

export function LayerInner({
  layer,
  asMask = false,
  meta,
}: {
  layer: TLayer;
  asMask?: boolean;
  meta?: GameMeta;
}) {
  // As a mask, the node paints only its alpha into its Konva layer and keeps
  // (destination-in) the clipped layers drawn before it.
  const gco = asMask ? ("destination-in" as const) : undefined;
  // Background layers are painted separately as a full-canvas fill, never
  // through the normal layer pipeline.
  if (layer.type === "background") return null;
  if (layer.type === "image") return <ImageInner layer={layer} gco={gco} />;
  if (layer.type === "shape") return <ShapeInner layer={layer} gco={gco} />;
  if (layer.type === "metabadge") return <MetaBadgeInner layer={layer} meta={meta} />;
  return <TextInner layer={layer} gco={gco} />;
}

type Gco = "destination-in" | undefined;

function ShapeInner({ layer, gco }: { layer: TShapeLayer; gco?: Gco }) {
  const { width: w, height: h, fill } = layer;
  const ellipse = layer.shape === "circle";
  const radius = layer.shape === "capsule" ? Math.min(w, h) / 2 : layer.cornerRadius;

  const paint =
    fill.kind === "gradient"
      ? gradientFill(fill, w, h, ellipse)
      : { fill: fill.color };

  const stroke =
    layer.strokeWidth > 0
      ? { stroke: layer.stroke, strokeWidth: layer.strokeWidth }
      : {};

  const noise =
    fill.noise > 0
      ? {
          listening: false,
          opacity: fill.noise,
          fillPatternImage: noiseTile() as unknown as HTMLImageElement,
          fillPatternRepeat: "repeat" as const,
          globalCompositeOperation: "overlay" as const,
        }
      : null;

  // As a mask only the alpha matters: paint opaque, skip stroke + noise.
  if (gco) {
    return ellipse ? (
      <Ellipse radiusX={w / 2} radiusY={h / 2} fill="#000" globalCompositeOperation={gco} />
    ) : (
      <Rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        cornerRadius={radius}
        fill="#000"
        globalCompositeOperation={gco}
      />
    );
  }

  if (ellipse) {
    return (
      <>
        <Ellipse radiusX={w / 2} radiusY={h / 2} {...paint} {...stroke} />
        {noise && <Ellipse radiusX={w / 2} radiusY={h / 2} {...noise} />}
      </>
    );
  }
  const box = { x: -w / 2, y: -h / 2, width: w, height: h, cornerRadius: radius };
  return (
    <>
      <Rect {...box} {...paint} {...stroke} />
      {noise && <Rect {...box} {...noise} />}
    </>
  );
}

// Console-level badge: rating, release year and a players icon, all read
// live from the gamelist.xml entry matched to the current card (`meta`).
function MetaBadgeInner({ layer, meta }: { layer: TMetaBadgeLayer; meta?: GameMeta }) {
  const w = layer.width;
  const h = layer.height;

  const segments = (
    [
      layer.showRating && "rating",
      layer.showYear && "year",
      layer.showPlayers && "players",
    ] as const
  ).filter((s): s is "rating" | "year" | "players" => !!s);

  const n = Math.max(1, segments.length);
  const colW = w / n;
  const iconSize = Math.min(h * 0.62, layer.fontSize * 1.6);
  const pad = Math.max(3, layer.fontSize * 0.15);
  // A single standalone element (added on its own, not part of a combined
  // badge) reads better as one centred icon+text chip than left-aligned.
  const solo = n === 1;

  const ratingText = ratingOutOfFive(meta?.rating);
  const yearText = releaseYear(meta?.releasedate);
  const playersRaw = meta?.players?.trim();

  return (
    <>
      {segments.map((kind, i) => {
        const colX = -w / 2 + colW * i;
        if (kind === "year") {
          return (
            <Text
              key={kind}
              x={colX}
              y={-h / 2}
              width={colW}
              height={h}
              align="center"
              verticalAlign="middle"
              text={yearText ?? "–"}
              fontFamily="system-ui, sans-serif"
              fontStyle="bold"
              fontSize={layer.fontSize}
              fill={layer.color}
            />
          );
        }

        const label =
          kind === "rating" ? (ratingText ?? "–") : (playersRaw || "–");
        const textW = solo
          ? layer.fontSize * (kind === "rating" ? 2 : 2.6)
          : Math.max(4, colW - iconSize - pad * 3);
        const pairW = iconSize + pad + textW;
        const pairX = solo ? -pairW / 2 : colX;
        const iconCx = pairX + iconSize / 2 + (solo ? 0 : pad);
        const textX = pairX + iconSize + (solo ? pad : pad * 2);

        return (
          <Group key={kind}>
            {kind === "rating" ? (
              <Star
                x={iconCx}
                y={0}
                numPoints={5}
                innerRadius={iconSize * 0.24}
                outerRadius={iconSize * 0.5}
                fill={layer.starColor}
              />
            ) : (
              <PlayersGlyph
                cx={iconCx}
                size={iconSize}
                color={layer.color}
                style={layer.playersIcon}
                solo={playersRaw === "1"}
              />
            )}
            <Text
              x={textX}
              y={-h / 2}
              width={textW}
              height={h}
              align="left"
              verticalAlign="middle"
              text={label}
              fontFamily="system-ui, sans-serif"
              fontStyle="bold"
              fontSize={layer.fontSize}
              fill={layer.color}
            />
          </Group>
        );
      })}
    </>
  );
}

// Built from plain Konva primitives (no external icon assets) so it stays
// crisp at any scale and renders identically in the PNG export.
function PlayersGlyph({
  cx,
  size,
  color,
  style,
  solo,
}: {
  cx: number;
  size: number;
  color: string;
  style: PlayersIconStyle;
  solo: boolean;
}) {
  const kind = style === "auto" ? (solo ? "single" : "group") : style;

  if (kind === "controller") {
    const w = size;
    const h = size * 0.56;
    const s = size * 0.09;
    return (
      <Group x={cx} y={0}>
        <Rect
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          cornerRadius={h / 2}
          stroke={color}
          strokeWidth={s}
        />
        <Rect x={-w * 0.32} y={-s * 0.5} width={s * 2.2} height={s} fill={color} />
        <Rect x={-w * 0.32 + s * 1.1 - s * 0.5} y={-s * 1.6} width={s} height={s * 2.2} fill={color} />
        <Circle x={w * 0.22} y={-h * 0.12} radius={s * 0.9} fill={color} />
        <Circle x={w * 0.32} y={h * 0.1} radius={s * 0.9} fill={color} />
      </Group>
    );
  }

  const person = (dx: number, scale: number, opacity: number, key: string) => (
    <Group key={key} x={cx + dx} y={0} opacity={opacity}>
      <Circle y={-size * 0.24 * scale} radius={size * 0.2 * scale} fill={color} />
      <Rect
        x={-size * 0.28 * scale}
        y={size * 0.03 * scale}
        width={size * 0.56 * scale}
        height={size * 0.3 * scale}
        cornerRadius={[size * 0.28 * scale, size * 0.28 * scale, 0, 0]}
        fill={color}
      />
    </Group>
  );

  if (kind === "single") return person(0, 1, 1, "solo");
  return (
    <>
      {person(-size * 0.2, 0.82, 0.55, "back")}
      {person(size * 0.07, 1, 1, "front")}
    </>
  );
}

export function CardBackgroundNodes({ bg }: { bg: CardBackground }) {
  const full = { x: 0, y: 0, width: CANVAS.w, height: CANVAS.h };

  const fill =
    bg.kind === "gradient"
      ? gradientFill(bg, CANVAS.w, CANVAS.h)
      : { fill: bg.color };

  return (
    <>
      <Rect name="bg" {...full} {...fill} />
      {bg.noise > 0 && (
        <Rect
          {...full}
          listening={false}
          opacity={bg.noise}
          fillPatternImage={noiseTile() as unknown as HTMLImageElement}
          fillPatternRepeat="repeat"
          globalCompositeOperation="overlay"
        />
      )}
    </>
  );
}

// Console-template layer shown on a game card: visible, never interactive.
function ReadOnlyLayer({ layer, meta }: { layer: TLayer; meta?: GameMeta }) {
  const common = {
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    opacity: layer.opacity,
    listening: false,
  };
  return (
    <Group {...common}>
      <LayerInner layer={layer} meta={meta} />
    </Group>
  );
}

function ImageInner({ layer, gco }: { layer: TImageLayer; gco?: Gco }) {
  const img = useImage(layer.src);
  return (
    <KImage
      image={img}
      width={layer.width}
      height={layer.height}
      offsetX={layer.width / 2}
      offsetY={layer.height / 2}
      cornerRadius={layer.cornerRadius}
      globalCompositeOperation={gco}
      listening
    />
  );
}

function TextInner({ layer, gco }: { layer: TTextLayer; gco?: Gco }) {
  const ref = useRef<Konva.Text>(null);
  const [h, setH] = useState(0);

  useLayoutEffect(() => {
    if (ref.current) setH(ref.current.height());
  }, [
    layer.text,
    layer.fontFamily,
    layer.fontSize,
    layer.bold,
    layer.italic,
    layer.width,
    layer.lineHeight,
    layer.letterSpacing,
    layer.align,
  ]);

  return (
    <Text
      ref={ref}
      text={layer.text}
      width={layer.width}
      align={layer.align}
      fontFamily={layer.fontFamily}
      fontStyle={fontStyleString(layer)}
      fontSize={layer.fontSize}
      lineHeight={layer.lineHeight}
      letterSpacing={layer.letterSpacing}
      fill={gco ? "#000" : layer.fill}
      stroke={!gco && layer.strokeWidth > 0 ? layer.stroke : undefined}
      strokeWidth={gco ? 0 : layer.strokeWidth}
      fillAfterStrokeEnabled
      globalCompositeOperation={gco}
      offsetX={layer.width / 2}
      offsetY={h / 2}
      listening
    />
  );
}

function Guides({ showBleed }: { showBleed: boolean }) {
  if (!showBleed) return null;
  return (
    <>
      <Rect
        x={TRIM_RECT.x}
        y={TRIM_RECT.y}
        width={TRIM_RECT.w}
        height={TRIM_RECT.h}
        stroke="#f8fafc"
        strokeWidth={1.5}
        dash={[8, 6]}
      />
      <Rect
        x={0.75}
        y={0.75}
        width={CANVAS.w - 1.5}
        height={CANVAS.h - 1.5}
        stroke="#f472b6"
        strokeWidth={1.5}
      />
      <RoundedCardOutline />
    </>
  );
}

// Fold lines + panel names for multi-panel formats (DVD wrap, J-card).
// Sits in the "guides" layer so it never shows up in exports.
function PanelGuides() {
  const t = useT();
  if (FOLD_X.length === 0) return null;
  return (
    <>
      {FOLD_X.map((x) => (
        <Line
          key={x}
          points={[x, 0, x, CANVAS.h]}
          stroke="#f59e0b"
          strokeWidth={1.5}
          dash={[12, 7]}
        />
      ))}
      {PANELS.map((p) => {
        const label = t(p.name).toUpperCase();
        // Narrow panels (spine, tuck flap) get a rotated, centred label so
        // the text still fits.
        if (p.w < 300) {
          const boxW = TRIM_RECT.h - 24;
          return (
            <Text
              key={`${p.name}-${p.x}`}
              x={p.x + p.w / 2}
              y={TRIM_RECT.y + TRIM_RECT.h / 2}
              width={boxW}
              height={p.w}
              offsetX={boxW / 2}
              offsetY={p.w / 2}
              rotation={-90}
              align="center"
              verticalAlign="middle"
              text={label}
              fontFamily="system-ui, sans-serif"
              fontStyle="bold"
              fontSize={12}
              fill="#f59e0b"
              opacity={0.85}
              listening={false}
            />
          );
        }
        return (
          <Text
            key={`${p.name}-${p.x}`}
            x={p.x}
            y={TRIM_RECT.y + 8}
            width={p.w}
            align="center"
            text={label}
            fontFamily="system-ui, sans-serif"
            fontStyle="bold"
            fontSize={14}
            fill="#f59e0b"
            opacity={0.85}
            listening={false}
          />
        );
      })}
    </>
  );
}

function RoundedCardOutline() {
  return (
    <Rect
      x={TRIM_RECT.x}
      y={TRIM_RECT.y}
      width={TRIM_RECT.w}
      height={TRIM_RECT.h}
      cornerRadius={CORNER_RADIUS_PX}
      stroke="#e4e4e7"
      strokeWidth={1}
      opacity={0.3}
    />
  );
}

function GuideLine({
  guide,
  onMove,
  onRemove,
  readOnly = false,
}: {
  guide: Guide;
  onMove: (pos: number) => void;
  onRemove: () => void;
  readOnly?: boolean;
}) {
  const vertical = guide.axis === "x";
  const ref = useRef<Konva.Line>(null);
  const limit = vertical ? CANVAS.w : CANVAS.h;

  const finish = (commit: boolean) => {
    const n = ref.current;
    if (!n) return;
    if (vertical) n.y(0);
    else n.x(0);
    const pos = vertical ? n.x() : n.y();
    if (commit && (pos < -6 || pos > limit + 6)) {
      onRemove();
      return;
    }
    onMove(Math.max(0, Math.min(limit, pos)));
  };

  const setCursor = (e: Konva.KonvaEventObject<MouseEvent>, c: string) => {
    const s = e.target.getStage();
    if (s) s.container().style.cursor = c;
  };

  if (readOnly) {
    return (
      <Line
        x={vertical ? guide.pos : 0}
        y={vertical ? 0 : guide.pos}
        points={vertical ? [0, 0, 0, CANVAS.h] : [0, 0, CANVAS.w, 0]}
        stroke="#22d3ee"
        strokeWidth={1}
        dash={[5, 4]}
        listening={false}
      />
    );
  }

  return (
    <Line
      ref={ref}
      x={vertical ? guide.pos : 0}
      y={vertical ? 0 : guide.pos}
      points={vertical ? [0, 0, 0, CANVAS.h] : [0, 0, CANVAS.w, 0]}
      stroke="#22d3ee"
      strokeWidth={1}
      dash={[5, 4]}
      hitStrokeWidth={14}
      draggable
      onDragMove={() => finish(false)}
      onDragEnd={() => finish(true)}
      onMouseEnter={(e) => setCursor(e, vertical ? "ew-resize" : "ns-resize")}
      onMouseLeave={(e) => setCursor(e, "default")}
    />
  );
}
