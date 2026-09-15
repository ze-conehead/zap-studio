// The non-printing helpers drawn over the card: bleed / trim outlines, the
// user's guides, fold lines of multi-panel formats, frame outlines.

import Konva from "konva";
import { useRef } from "react";
import { Ellipse, Group, Line, Rect, Text } from "react-konva";
import { CANVAS, CORNER_RADIUS_PX, FOLD_X, PANELS, TRIM_RECT } from "../../card";
import type { Guide } from "../../guides";
import { useT } from "../../i18n";
import { DEFAULT_FLOW_HEIGHT } from "../../textFlow";
import type { Layer as TLayer, TextLayer as TTextLayer } from "../../types";

export function Guides({ showBleed }: { showBleed: boolean }) {
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
export function PanelGuides() {
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

export function RoundedCardOutline() {
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

// An alpha mask from a template, drawn as an outline for
// reference on console templates and game cards (it's an editable shape only
// on the global template). Never painted into an export (sits in a guide
// layer) and not interactive.
// The bounds of a flowing text frame — an editor guide, never exported.
export function TextFrameOutline({ layer }: { layer: TTextLayer }) {
  const w = layer.width;
  const h = layer.height ?? DEFAULT_FLOW_HEIGHT;
  return (
    <Group
      x={layer.x}
      y={layer.y}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      listening={false}
    >
      <Rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        stroke="#34d399"
        strokeWidth={1.5}
        dash={[7, 5]}
        listening={false}
      />
    </Group>
  );
}

export function MainMaskOutline({
  mask,
  colour = "#a78bfa",
}: {
  mask: TLayer;
  colour?: string;
}) {
  if (mask.type !== "shape") return null;
  const w = mask.width;
  const h = mask.height;
  const line = {
    stroke: colour,
    strokeWidth: 1.5,
    dash: [7, 5] as number[],
    listening: false as const,
  };
  return (
    <Group
      x={mask.x}
      y={mask.y}
      rotation={mask.rotation}
      scaleX={mask.scaleX}
      scaleY={mask.scaleY}
      listening={false}
    >
      {mask.shape === "circle" ? (
        <Ellipse radiusX={w / 2} radiusY={h / 2} {...line} />
      ) : (
        <Rect
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          cornerRadius={
            mask.shape === "capsule" ? Math.min(w, h) / 2 : mask.cornerRadius
          }
          {...line}
        />
      )}
    </Group>
  );
}

export function GuideLine({
  guide,
  onMove,
  onRemove,
  readOnly = false,
  highlight = false,
}: {
  guide: Guide;
  onMove: (pos: number) => void;
  onRemove: () => void;
  readOnly?: boolean;
  highlight?: boolean;
}) {
  const vertical = guide.axis === "x";
  const ref = useRef<Konva.Line>(null);
  const limit = vertical ? CANVAS.w : CANVAS.h;
  const stroke = highlight ? "#f59e0b" : "#22d3ee";
  const strokeWidth = highlight ? 2 : 1;
  const dash = highlight ? undefined : [5, 4];

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
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={dash}
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
      stroke={stroke}
      strokeWidth={strokeWidth}
      dash={dash}
      hitStrokeWidth={14}
      draggable
      onDragMove={() => finish(false)}
      onDragEnd={() => finish(true)}
      onMouseEnter={(e) => setCursor(e, vertical ? "ew-resize" : "ns-resize")}
      onMouseLeave={(e) => setCursor(e, "default")}
    />
  );
}
