// What each kind of layer draws — the visual part shared by the editor
// (LayerNode), the static renderer (CardStage) and the read-only template
// overlay. No interaction here.

import Konva from "konva";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  Ellipse,
  Group,
  Image as KImage,
  Rect,
  Shape,
  Star,
  Text,
} from "react-konva";
import qrcode from "qrcode-generator";
import { gradientFill, noiseTile } from "../../background";
import { CANVAS } from "../../card";
import type { GameMeta } from "../../gamelist";
import { ratingOutOfFive, releaseYear } from "../../gamelist";
import { useImage } from "../../hooks/useImage";
import { useAdjustedImage } from "../../imageAdjust";
import { shadowProps } from "../../layerEffects";
import {
  placeholderValue,
  resolvePlaceholders,
  type PlaceholderContext,
} from "../../placeholders";
import { renderedFontSize } from "../../textFit";
import { DEFAULT_FLOW_HEIGHT, flowLayout, obstacleBoxes } from "../../textFlow";
import { fontStyleString } from "../../textUtil";
import type {
  CardBackground,
  ImageLayer as TImageLayer,
  Layer as TLayer,
  MetaBadgeLayer as TMetaBadgeLayer,
  PlayersIconStyle,
  QrLayer as TQrLayer,
  ShapeLayer as TShapeLayer,
  TextLayer as TTextLayer,
} from "../../types";

export function LayerInner({
  layer,
  asMask = false,
  meta,
  vars,
  obstacles,
}: {
  layer: TLayer;
  asMask?: boolean;
  meta?: GameMeta;
  vars?: PlaceholderContext;
  obstacles?: TLayer[];
}) {
  // As a mask, the node paints only its alpha into its Konva layer and keeps
  // (destination-in) the clipped layers drawn before it.
  const gco = asMask ? ("destination-in" as const) : undefined;
  // Background layers are painted separately as a full-canvas fill, never
  // through the normal layer pipeline.
  if (layer.type === "background") return null;
  // A condition is a switch, not a graphic — resolveConditions() drops it
  // before rendering, and this keeps a stray one invisible.
  if (layer.type === "condition") return null;
  if (layer.type === "image") return <ImageInner layer={layer} gco={gco} />;
  if (layer.type === "shape") return <ShapeInner layer={layer} gco={gco} />;
  if (layer.type === "metabadge") return <MetaBadgeInner layer={layer} meta={meta} />;
  if (layer.type === "qr") return <QrInner layer={layer} gco={gco} vars={vars} />;
  // {title} & co. resolve here, so measuring, flowing and exporting all see
  // the same string — the stored layer keeps the raw text. A Metadata layer
  // whose card has no value for its field draws nothing; only the global
  // template (no card to preview) shows the token so the layer stays visible.
  const text = layer.metaField
    ? (placeholderValue(layer.metaField, vars) ?? (vars?.title === undefined ? layer.text : ""))
    : resolvePlaceholders(layer.text, vars);
  const shown = text === layer.text ? layer : { ...layer, text };
  return <TextInner layer={shown} gco={gco} obstacles={obstacles} />;
}

export type Gco = "destination-in" | undefined;

// The QR modules, drawn as one Konva Shape so adjacent squares share edges
// with no hairline seams at any scale. Four modules of quiet zone all
// round, per the spec, inside the layer's own box.
const QR_QUIET = 4;

function QrInner({ layer, gco, vars }: { layer: TQrLayer; gco?: Gco; vars?: PlaceholderContext }) {
  const text = resolvePlaceholders(layer.text, vars);
  const code = useMemo(() => {
    try {
      const qr = qrcode(0, layer.ecLevel);
      qr.addData(text || " ");
      qr.make();
      const n = qr.getModuleCount();
      const dark: number[] = [];
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) if (qr.isDark(r, c)) dark.push(r * n + c);
      }
      return { n, dark };
    } catch {
      return null; // longer than a version-40 code can hold
    }
  }, [text, layer.ecLevel]);

  const size = layer.width;
  const n = code?.n ?? 21;
  const cell = size / (n + QR_QUIET * 2);
  const fg = gco ? "#000" : layer.fg;
  const shadow = gco ? {} : shadowProps(layer.shadow);

  return (
    <Group offsetX={size / 2} offsetY={size / 2}>
      {layer.bgEnabled && (
        <Rect
          width={size}
          height={size}
          fill={gco ? "#000" : layer.bg}
          globalCompositeOperation={gco}
          {...shadow}
        />
      )}
      {code ? (
        <Shape
          fill={fg}
          globalCompositeOperation={gco}
          {...(layer.bgEnabled ? {} : shadow)}
          sceneFunc={(ctx, shape) => {
            ctx.beginPath();
            for (const i of code.dark) {
              const r = Math.floor(i / n);
              const c = i % n;
              ctx.rect((c + QR_QUIET) * cell, (r + QR_QUIET) * cell, cell, cell);
            }
            ctx.fillStrokeShape(shape);
          }}
        />
      ) : (
        <Text
          width={size}
          height={size}
          align="center"
          verticalAlign="middle"
          fontSize={Math.max(12, size / 12)}
          fill={fg}
          text="QR: too long"
        />
      )}
    </Group>
  );
}

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

  const shadow = gco ? undefined : shadowProps(layer.shadow);

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

  // Alpha masks and logo slots are placement frames — never a fill. They
  // always draw as a dashed outline, the same as the placeholder a card
  // shows for an empty slot.
  if (layer.alphaMask || layer.logoSlot) {
    // A transparent fill keeps the interior clickable / draggable (Konva's
    // hit graph still fills it) while nothing paints on screen.
    const line = {
      stroke: layer.logoSlot ? "#38bdf8" : "#a78bfa",
      strokeWidth: 1.5,
      dash: [7, 5] as number[],
      fill: "transparent",
    };
    return ellipse ? (
      <Ellipse radiusX={w / 2} radiusY={h / 2} {...line} />
    ) : (
      <Rect x={-w / 2} y={-h / 2} width={w} height={h} cornerRadius={radius} {...line} />
    );
  }

  if (ellipse) {
    return (
      <>
        <Ellipse radiusX={w / 2} radiusY={h / 2} {...paint} {...stroke} {...shadow} />
        {noise && <Ellipse radiusX={w / 2} radiusY={h / 2} {...noise} />}
      </>
    );
  }
  const box = { x: -w / 2, y: -h / 2, width: w, height: h, cornerRadius: radius };
  return (
    <>
      <Rect {...box} {...paint} {...stroke} {...shadow} />
      {noise && <Rect {...box} {...noise} />}
    </>
  );
}

// Off-stage measurer so each icon+text chip can be centred in its slot —
// Konva has no "shrink a Group to its content".
let badgeProbe: Konva.Text | null = null;
function badgeTextWidth(text: string, fontSize: number): number {
  badgeProbe ??= new Konva.Text({
    fontFamily: "system-ui, sans-serif",
    fontStyle: "bold",
  });
  badgeProbe.fontSize(fontSize);
  return badgeProbe.measureSize(text).width;
}

// Console-level badge: rating, release year and a players icon, all read
// live from the gamelist.xml entry matched to the current card (`meta`).
// The badge width is split into equal slots and every element is centred in
// its own slot, so they sit evenly spread however many are shown.
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

  const ratingText = ratingOutOfFive(meta?.rating);
  const yearText = releaseYear(meta?.releasedate);
  const playersRaw = meta?.players?.trim();

  return (
    <>
      {segments.map((kind, i) => {
        // Centre of this element's equal slot.
        const mid = -w / 2 + colW * (i + 0.5);
        if (kind === "year") {
          return (
            <Text
              key={kind}
              x={mid - colW / 2}
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
        const textW = badgeTextWidth(label, layer.fontSize);
        const pairW = iconSize + pad + textW;
        const pairX = mid - pairW / 2; // centre the icon+text pair in the slot
        const iconCx = pairX + iconSize / 2;
        const textX = pairX + iconSize + pad;

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
              width={textW + pad * 2}
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
// As a mask it clips the card's own image spliced in below it.
export function ReadOnlyLayer({
  layer,
  asMask = false,
  meta,
  vars,
  obstacles,
}: {
  layer: TLayer;
  asMask?: boolean;
  meta?: GameMeta;
  vars?: PlaceholderContext;
  obstacles?: TLayer[];
}) {
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
      <LayerInner layer={layer} asMask={asMask} meta={meta} vars={vars} obstacles={obstacles} />
    </Group>
  );
}

function ImageInner({ layer, gco }: { layer: TImageLayer; gco?: Gco }) {
  // The adjusted copy is an offscreen canvas; Konva takes either.
  const img = useAdjustedImage(useImage(layer.src), layer.adjust);
  // The crop is stored as fractions; Konva wants source pixels. The
  // loaded image's own size is used (the stored naturalWidth could differ
  // if the file was ever re-encoded).
  const c = layer.crop;
  const iw = img?.width ?? layer.naturalWidth;
  const ih = img?.height ?? layer.naturalHeight;
  const crop = c
    ? {
        x: iw * c.l,
        y: ih * c.t,
        width: Math.max(1, iw * (1 - c.l - c.r)),
        height: Math.max(1, ih * (1 - c.t - c.b)),
      }
    : undefined;
  return (
    <KImage
      image={img}
      crop={crop}
      width={layer.width}
      height={layer.height}
      offsetX={layer.width / 2}
      offsetY={layer.height / 2}
      cornerRadius={layer.cornerRadius}
      globalCompositeOperation={gco}
      {...(gco ? {} : shadowProps(layer.shadow))}
      listening
    />
  );
}

function TextInner({
  layer,
  gco,
  obstacles = [],
}: {
  layer: TTextLayer;
  gco?: Gco;
  obstacles?: TLayer[];
}) {
  const ref = useRef<Konva.Text>(null);
  const [h, setH] = useState(0);

  // Recomputed only when something that affects the measurement changes.
  const fontSize = useMemo(
    () => renderedFontSize(layer),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      layer.autoFit,
      layer.autoFitLines,
      layer.text,
      layer.width,
      layer.fontFamily,
      layer.fontSize,
      layer.bold,
      layer.italic,
      layer.lineHeight,
      layer.letterSpacing,
      layer.align,
    ],
  );

  useLayoutEffect(() => {
    if (ref.current) setH(ref.current.height());
  }, [
    layer.text,
    layer.fontFamily,
    fontSize,
    layer.bold,
    layer.italic,
    layer.width,
    layer.lineHeight,
    layer.letterSpacing,
    layer.align,
  ]);

  if (layer.flow) {
    return <FlowText layer={layer} gco={gco} obstacles={obstacles} fontSize={fontSize} />;
  }

  return (
    <Text
      ref={ref}
      text={layer.text}
      width={layer.width}
      align={layer.align}
      fontFamily={layer.fontFamily}
      fontStyle={fontStyleString(layer)}
      fontSize={fontSize}
      lineHeight={layer.lineHeight}
      letterSpacing={layer.letterSpacing}
      fill={gco ? "#000" : layer.fill}
      stroke={!gco && layer.strokeWidth > 0 ? layer.stroke : undefined}
      strokeWidth={gco ? 0 : layer.strokeWidth}
      fillAfterStrokeEnabled
      globalCompositeOperation={gco}
      {...(gco ? {} : shadowProps(layer.shadow))}
      offsetX={layer.width / 2}
      offsetY={h / 2}
      listening
    />
  );
}

// A text frame: every line broken into the gaps the alpha mask frames leave
// free, so the text sits beside the images instead of under them. The empty
// Rect gives the frame its size, so the transformer grabs the whole box even
// where the text is short.
function FlowText({
  layer,
  gco,
  obstacles,
  fontSize,
}: {
  layer: TTextLayer;
  gco?: Gco;
  obstacles: TLayer[];
  fontSize: number;
}) {
  const W = layer.width;
  const H = layer.height ?? DEFAULT_FLOW_HEIGHT;
  // Obstacle geometry is the only part of `obstacles` that matters here.
  const key = obstacles
    .map((o) =>
      "width" in o
        ? `${o.id}:${o.x},${o.y},${o.width},${o.height},${o.rotation},${o.scaleX},${o.scaleY},${o.visible}`
        : o.id,
    )
    .join("|");
  const pieces = useMemo(
    () => flowLayout(layer, fontSize, obstacleBoxes(layer, obstacles)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      key,
      layer.text,
      layer.width,
      layer.height,
      layer.flowGap,
      layer.x,
      layer.y,
      layer.rotation,
      layer.scaleX,
      layer.scaleY,
      layer.fontFamily,
      layer.bold,
      layer.italic,
      layer.lineHeight,
      layer.letterSpacing,
      fontSize,
    ],
  );

  return (
    <Group offsetX={W / 2} offsetY={H / 2}>
      <Rect width={W} height={H} listening={false} />
      {pieces.map((p, i) => (
        <Text
          key={i}
          x={p.x}
          y={p.y}
          width={p.w}
          text={p.text}
          wrap="none"
          align={layer.align}
          fontFamily={layer.fontFamily}
          fontStyle={fontStyleString(layer)}
          fontSize={fontSize}
          lineHeight={layer.lineHeight}
          letterSpacing={layer.letterSpacing}
          fill={gco ? "#000" : layer.fill}
          stroke={!gco && layer.strokeWidth > 0 ? layer.stroke : undefined}
          strokeWidth={gco ? 0 : layer.strokeWidth}
          fillAfterStrokeEnabled
          globalCompositeOperation={gco}
          {...(gco ? {} : shadowProps(layer.shadow))}
          listening={false}
        />
      ))}
    </Group>
  );
}
