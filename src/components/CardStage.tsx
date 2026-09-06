import type Konva from "konva";
import { Group, Layer as KLayer, Stage } from "react-konva";
import { CANVAS, TRIM_RECT } from "../card";
import type { DemoCard } from "../demo";
import type { GameMeta } from "../gamelist";
import { isBackground } from "../factory";
import { resolveBadgeMeta } from "../gamelist";
import { segmentLayers } from "../masking";
import type { Layer as TLayer } from "../types";
import {
  CardBackgroundNodes,
  effectiveBgFill,
  LayerInner,
  withMainMask,
} from "./EditorCanvas";

// A non-interactive copy of the editor's card rendering, used to capture a
// finished card as a PNG (demo packs). Same pipeline as the editor, so
// masks, templates and the main alpha mask all come out identical.
export function CardStage({
  card,
  width,
  stageRef,
}: {
  card: DemoCard;
  width: number; // rendered width of the trimmed card
  stageRef?: React.Ref<Konva.Stage>;
}) {
  const scale = width / TRIM_RECT.w;
  const bgLayer = card.project.layers.find(isBackground);
  const content = card.project.layers.filter((l) => !isBackground(l));
  const bg = effectiveBgFill(bgLayer, {
    inherit: !card.project.isTemplate,
    fallback: card.project.isGlobalTemplate ? undefined : card.globalBg,
    consoleBg: card.consoleBg,
    globalBg: card.globalBg,
  });
  const layers = withMainMask(card.project, content, card.mainMask);
  const meta = resolveBadgeMeta(card.project);

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
            ? seg.layers.map((l) => <StaticLayer key={l.id} layer={l} meta={meta} />)
            : [
                ...seg.clipped.map((l) => (
                  <StaticLayer key={l.id} layer={l} meta={meta} />
                )),
                <StaticLayer
                  key={seg.mask.id}
                  layer={seg.mask}
                  asMask={seg.clipped.length > 0}
                  meta={meta}
                />,
              ]}
        </KLayer>
      ))}

      {card.overlay.length > 0 && (
        <KLayer listening={false}>
          {card.overlay.map((l) => (
            <StaticLayer key={l.id} layer={l} meta={meta} />
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
}: {
  layer: TLayer;
  asMask?: boolean;
  meta?: GameMeta;
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
      <LayerInner layer={layer} asMask={asMask} meta={meta} />
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
