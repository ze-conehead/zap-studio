import type Konva from "konva";
import { Group, Layer as KLayer, Stage } from "react-konva";
import { CANVAS, TRIM_RECT } from "../card";
import type { DemoCard } from "../demo";
import type { GameMeta } from "../gamelist";
import { resolveConditions } from "../conditions";
import { isBackground } from "../factory";
import { resolveBadgeMeta } from "../gamelist";
import { segmentLayers } from "../masking";
import type { Layer as TLayer } from "../types";
import {
  CardBackgroundNodes,
  effectiveBgFill,
  LayerInner,
  withMasks,
} from "./EditorCanvas";

// A non-interactive copy of the editor's card rendering, used to capture a
// finished card as a PNG (demo packs, the 3D preview). Same pipeline as the
// editor, so masks, templates and the main alpha mask all come out
// identical. `face: "back"` renders the resolved back face (`card.back`) — a
// plain face: its own background plus its conditioned layers, no template
// overlay or alpha masks, exactly like the editor's back.
export function CardStage({
  card,
  width,
  face = "front",
  stageRef,
}: {
  card: DemoCard;
  width: number; // rendered width of the trimmed card
  face?: "front" | "back";
  stageRef?: React.Ref<Konva.Stage>;
}) {
  const scale = width / TRIM_RECT.w;
  const back = face === "back";
  const faceLayers = back ? card.back?.layers ?? [] : card.project.layers;
  const bgLayer = faceLayers.find(isBackground);
  const content = faceLayers.filter((l) => !isBackground(l));
  const bg = effectiveBgFill(bgLayer, {
    inherit: !back && !card.project.isTemplate,
    fallback: back || card.project.isGlobalTemplate ? undefined : card.globalBg,
    consoleBg: card.consoleBg,
    globalBg: card.globalBg,
  });
  const meta = resolveBadgeMeta(card.project);
  const resolved = resolveConditions(content, meta);
  const layers = back
    ? resolved
    : withMasks(card.project, resolved, card.masks);
  const overlay = back ? [] : resolveConditions(card.overlay, meta);
  // What a flowing text frame breaks around (src/textFlow.ts).
  const obstacles = [...(card.masks ?? []), ...content.filter((l) => l.alphaMask)];

  return (
    <Stage
      ref={stageRef}
      width={CANVAS.w * scale}
      height={CANVAS.h * scale}
      scaleX={scale}
      scaleY={scale}
      listening={false}
    >
      {bg && (
        <KLayer listening={false} opacity={bgLayer?.opacity ?? 1}>
          <CardBackgroundNodes bg={bg} />
        </KLayer>
      )}

      {segmentLayers(layers).map((seg, i) => (
        <KLayer key={`seg-${i}`} listening={false}>
          {seg.kind === "plain"
            ? seg.layers.map((l) => (
                <StaticLayer key={l.id} layer={l} meta={meta} obstacles={obstacles} />
              ))
            : [
                ...seg.clipped.map((l) => (
                  <StaticLayer key={l.id} layer={l} meta={meta} obstacles={obstacles} />
                )),
                <StaticLayer
                  key={seg.mask.id}
                  layer={seg.mask}
                  asMask={seg.clipped.length > 0}
                  meta={meta}
                  obstacles={obstacles}
                />,
              ]}
        </KLayer>
      ))}

      {overlay.length > 0 && (
        <KLayer listening={false}>
          {overlay.map((l) => (
            <StaticLayer key={l.id} layer={l} meta={meta} obstacles={obstacles} />
          ))}
        </KLayer>
      )}
    </Stage>
  );
}

function StaticLayer({
  layer,
  asMask = false,
  meta,
  obstacles,
}: {
  layer: TLayer;
  asMask?: boolean;
  meta?: GameMeta;
  obstacles?: TLayer[];
}) {
  if (!layer.visible) return null;
  return (
    <Group
      x={layer.x}
      y={layer.y}
      rotation={layer.rotation}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      opacity={layer.opacity}
      listening={false}
    >
      <LayerInner layer={layer} asMask={asMask} meta={meta} obstacles={obstacles} />
    </Group>
  );
}

// Crops the full-bleed stage down to the trimmed card.
export function captureTrim(stage: Konva.Stage, width: number): string {
  const scale = width / TRIM_RECT.w;
  return stage.toDataURL({
    x: TRIM_RECT.x * scale,
    y: TRIM_RECT.y * scale,
    width: TRIM_RECT.w * scale,
    height: TRIM_RECT.h * scale,
    pixelRatio: 1,
  });
}
