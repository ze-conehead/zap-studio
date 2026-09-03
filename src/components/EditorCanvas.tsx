import Konva from "konva";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Ellipse,
  Group,
  Image as KImage,
  Layer,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import {
  gradientPoints,
  gradientPointsBox,
  noiseTile,
  resolveBackground,
} from "../background";
import { CANVAS, CORNER_RADIUS_PX, SAFE_RECT, TRIM_RECT } from "../card";
import { useImage } from "../hooks/useImage";
import { segmentLayers } from "../masking";
import { useStore } from "../store";
import type {
  CardBackground,
  ImageLayer as TImageLayer,
  Layer as TLayer,
  Project,
  ShapeLayer as TShapeLayer,
  TextLayer as TTextLayer,
} from "../types";
import { fontStyleString } from "../textUtil";

export interface CanvasHandle {
  getStage: () => Konva.Stage | null;
  getStageWidth: () => number;
}

// Which background actually paints for the current view.
function effectiveBackground(
  project: Project,
  consoleBg?: CardBackground,
  globalBg?: CardBackground,
): CardBackground | null {
  const own = resolveBackground(project);
  if (project.isTemplate) return own.enabled ? own : null;

  const src = project.backgroundSource ?? "card";
  if (src === "global" && globalBg?.enabled) return globalBg;
  if (src === "console" && consoleBg?.enabled) return consoleBg;
  return own;
}

export function EditorCanvas({
  handleRef,
  overlay = [],
  consoleBg,
  globalBg,
}: {
  handleRef: React.MutableRefObject<CanvasHandle | null>;
  overlay?: TLayer[];
  consoleBg?: CardBackground;
  globalBg?: CardBackground;
}) {
  const { state, dispatch } = useStore();
  const { project, selectedId, showBleed, showSafe } = state;
  const bg = effectiveBackground(project, consoleBg, globalBg);

  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef(new Map<string, Konva.Node>());
  const [scale, setScale] = useState(0.5);

  // Fit stage to container width.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const pad = 48;
      const availW = el.clientWidth - pad;
      const availH = el.clientHeight - pad;
      setScale(Math.max(0.15, Math.min(availW / CANVAS.w, availH / CANVAS.h)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  handleRef.current = {
    getStage: () => stageRef.current,
    getStageWidth: () => CANVAS.w * scale,
  };

  // Keep transformer bound to the selected node.
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? nodeRefs.current.get(selectedId) : undefined;
    const layer = project.layers.find((l) => l.id === selectedId);
    tr.nodes(node && layer && !layer.locked ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, project.layers]);

  const stageW = CANVAS.w * scale;
  const stageH = CANVAS.h * scale;

  const deselect = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage() || e.target.name() === "bg") {
      dispatch({ type: "SELECT", id: null });
    }
  };

  // In the clean preview we crop the on-screen view to the trim box (with
  // rounded card corners). The Konva stage itself stays full-bleed size so
  // exports are unaffected.
  const cropped = !showBleed;
  const viewW = (cropped ? TRIM_RECT.w : CANVAS.w) * scale;
  const viewH = (cropped ? TRIM_RECT.h : CANVAS.h) * scale;

  return (
    <div
      className="canvas-checker grid flex-1 place-items-center overflow-auto bg-[#131c2e] p-6"
      ref={wrapRef}
    >
      <div
        className="relative overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        style={{
          width: viewW,
          height: viewH,
          borderRadius: cropped ? CORNER_RADIUS_PX * scale : 3,
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
            <Layer listening={false}>
              <CardBackgroundNodes bg={bg} />
            </Layer>
          )}

          {segmentLayers(project.layers).map((seg, i) => {
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
                  selected={layer.id === selectedId}
                  groupChildren={groupChildren}
                  register={(n) => {
                    if (n) nodeRefs.current.set(layer.id, n);
                    else nodeRefs.current.delete(layer.id);
                  }}
                  onSelect={() => dispatch({ type: "SELECT", id: layer.id })}
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

          {overlay.length > 0 && (
            <Layer listening={false}>
              {overlay.map((layer) =>
                layer.visible ? <ReadOnlyLayer key={layer.id} layer={layer} /> : null,
              )}
            </Layer>
          )}

          <Layer listening={false}>
            <Guides showBleed={showBleed} showSafe={showSafe} />
          </Layer>

          <Layer>
            <Transformer
              ref={trRef}
              rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
              anchorSize={10}
              anchorCornerRadius={5}
              borderStroke="#38bdf8"
              anchorStroke="#38bdf8"
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

function LayerNode({
  layer,
  asMask = false,
  selected = false,
  groupChildren,
  register,
  onSelect,
  onChange,
  onGroupChange,
}: {
  layer: TLayer;
  asMask?: boolean;
  selected?: boolean;
  groupChildren?: TLayer[];
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
      : (e: Konva.KonvaEventObject<DragEvent>) =>
          onChange({ x: e.target.x(), y: e.target.y() }, false),
    onDragEnd: grouped
      ? () => applyGroup(true)
      : (e: Konva.KonvaEventObject<DragEvent>) =>
          onChange({ x: e.target.x(), y: e.target.y() }, true),
    onTransformStart: grouped ? snapshot : undefined,
    onTransformEnd: grouped
      ? () => applyGroup(true)
      : () => {
          const n = ref.current!;
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
      <LayerInner layer={layer} asMask={asMask} />
    </Group>
  );
}

function LayerInner({ layer, asMask = false }: { layer: TLayer; asMask?: boolean }) {
  // As a mask, the node paints only its alpha into its Konva layer and keeps
  // (destination-in) the clipped layers drawn before it.
  const gco = asMask ? ("destination-in" as const) : undefined;
  if (layer.type === "image") return <ImageInner layer={layer} gco={gco} />;
  if (layer.type === "shape") return <ShapeInner layer={layer} gco={gco} />;
  return <TextInner layer={layer} gco={gco} />;
}

type Gco = "destination-in" | undefined;

function ShapeInner({ layer, gco }: { layer: TShapeLayer; gco?: Gco }) {
  const { width: w, height: h, fill } = layer;
  const ellipse = layer.shape === "circle";
  const radius = layer.shape === "capsule" ? Math.min(w, h) / 2 : layer.cornerRadius;

  const paint =
    fill.kind === "gradient"
      ? (() => {
          const { start, end } = gradientPointsBox(w, h, fill.angle, ellipse);
          return {
            fillLinearGradientStartPoint: start,
            fillLinearGradientEndPoint: end,
            fillLinearGradientColorStops: [0, fill.color, 1, fill.color2],
          };
        })()
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

function CardBackgroundNodes({ bg }: { bg: CardBackground }) {
  const full = { x: 0, y: 0, width: CANVAS.w, height: CANVAS.h };

  const fill =
    bg.kind === "gradient"
      ? (() => {
          const { start, end } = gradientPoints(bg.angle);
          return {
            fillLinearGradientStartPoint: start,
            fillLinearGradientEndPoint: end,
            fillLinearGradientColorStops: [0, bg.color, 1, bg.color2],
          };
        })()
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
function ReadOnlyLayer({ layer }: { layer: TLayer }) {
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
      <LayerInner layer={layer} />
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

function Guides({ showBleed, showSafe }: { showBleed: boolean; showSafe: boolean }) {
  return (
    <>
      {showBleed && (
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
        </>
      )}
      {showSafe && (
        <Rect
          x={SAFE_RECT.x}
          y={SAFE_RECT.y}
          width={SAFE_RECT.w}
          height={SAFE_RECT.h}
          stroke="#4ade80"
          strokeWidth={1.5}
          dash={[5, 5]}
        />
      )}
      {showBleed && <RoundedCardOutline />}
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
      stroke="#38bdf8"
      strokeWidth={1}
      opacity={0.35}
    />
  );
}
