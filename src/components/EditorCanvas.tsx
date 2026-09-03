import Konva from "konva";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Group, Image as KImage, Layer, Rect, Stage, Text, Transformer } from "react-konva";
import { CANVAS, CORNER_RADIUS_PX, SAFE_RECT, TRIM_RECT } from "../card";
import { useImage } from "../hooks/useImage";
import { useStore } from "../store";
import type { ImageLayer as TImageLayer, Layer as TLayer, TextLayer as TTextLayer } from "../types";
import { fontStyleString } from "../textUtil";

export interface CanvasHandle {
  getStage: () => Konva.Stage | null;
  getStageWidth: () => number;
}

export function EditorCanvas({ handleRef }: { handleRef: React.MutableRefObject<CanvasHandle | null> }) {
  const { state, dispatch } = useStore();
  const { project, selectedId, showBleed, showSafe } = state;

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

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <div className="canvas-shadow" style={{ width: stageW, height: stageH }}>
        <Stage
          ref={stageRef}
          width={stageW}
          height={stageH}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={deselect}
          onTouchStart={deselect}
        >
          <Layer>
            <Rect
              name="bg"
              x={0}
              y={0}
              width={CANVAS.w}
              height={CANVAS.h}
              fill={project.backgroundColor}
            />
            {project.layers.map((layer) =>
              layer.visible ? (
                <LayerNode
                  key={layer.id}
                  layer={layer}
                  selected={layer.id === selectedId}
                  register={(n) => {
                    if (n) nodeRefs.current.set(layer.id, n);
                    else nodeRefs.current.delete(layer.id);
                  }}
                  onSelect={() => dispatch({ type: "SELECT", id: layer.id })}
                  onChange={(patch, history) =>
                    dispatch({ type: "PATCH_LAYER", id: layer.id, patch, history })
                  }
                />
              ) : null,
            )}
          </Layer>

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

function LayerNode({
  layer,
  register,
  onSelect,
  onChange,
}: {
  layer: TLayer;
  selected: boolean;
  register: (n: Konva.Node | null) => void;
  onSelect: () => void;
  onChange: (patch: Partial<TLayer>, history?: boolean) => void;
}) {
  const ref = useRef<Konva.Group>(null);

  useEffect(() => {
    register(ref.current);
    return () => register(null);
  }, [register]);

  const common = {
    ref,
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    opacity: layer.opacity,
    draggable: !layer.locked,
    onMouseDown: onSelect,
    onTap: onSelect,
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) =>
      onChange({ x: e.target.x(), y: e.target.y() }, false),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
      onChange({ x: e.target.x(), y: e.target.y() }, true),
    onTransformEnd: () => {
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

  return layer.type === "image" ? (
    <Group {...common}>
      <ImageInner layer={layer} />
    </Group>
  ) : (
    <Group {...common}>
      <TextInner layer={layer} />
    </Group>
  );
}

function ImageInner({ layer }: { layer: TImageLayer }) {
  const img = useImage(layer.src);
  return (
    <KImage
      image={img}
      width={layer.width}
      height={layer.height}
      offsetX={layer.width / 2}
      offsetY={layer.height / 2}
      cornerRadius={layer.cornerRadius}
      listening
    />
  );
}

function TextInner({ layer }: { layer: TTextLayer }) {
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
      fill={layer.fill}
      stroke={layer.strokeWidth > 0 ? layer.stroke : undefined}
      strokeWidth={layer.strokeWidth}
      fillAfterStrokeEnabled
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
      <RoundedCardOutline />
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
