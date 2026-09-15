// The interactive wrapper around a layer on the editor stage: select,
// drag with snapping, resize / rotate through the Transformer, and the
// mask-group transform that moves clipped children along.

import Konva from "konva";
import { useEffect, useRef } from "react";
import { Group } from "react-konva";
import { COND_PREVIEW } from "../../export";
import type { GameMeta } from "../../gamelist";
import { DEFAULT_FLOW_HEIGHT } from "../../textFlow";
import type { PlaceholderContext } from "../../placeholders";
import type { Layer as TLayer } from "../../types";
import { LayerInner } from "./layerInner";
import { snapNodeToGuides, type SnapHit, type SnapLines } from "./snapping";

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

export function LayerNode({
  layer,
  asMask = false,
  selected = false,
  previewOnly = false,
  groupChildren,
  meta,
  vars,
  obstacles,
  snapLines,
  onSnap,
  register,
  onSelect,
  onContextMenu,
  onChange,
  onGroupChange,
}: {
  layer: TLayer;
  asMask?: boolean;
  selected?: boolean;
  // A condition case the metadata doesn't select: drawn so it can be
  // edited, named so exports leave it out.
  previewOnly?: boolean;
  groupChildren?: TLayer[];
  meta?: GameMeta;
  vars?: PlaceholderContext;
  obstacles?: TLayer[];
  snapLines?: SnapLines;
  onSnap?: (hit: SnapHit | null) => void;
  register: (n: Konva.Node | null) => void;
  onSelect: () => void;
  onContextMenu?: (e: MouseEvent) => void;
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
    name: previewOnly ? COND_PREVIEW : undefined,
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
    onContextMenu: (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.evt.preventDefault();
      onSelect();
      onContextMenu?.(e.evt);
    },
    onDragStart: grouped ? snapshot : undefined,
    onDragMove: grouped
      ? () => applyGroup(false)
      : (e: Konva.KonvaEventObject<DragEvent>) => {
          if (snapLines) onSnap?.(snapNodeToGuides(e.target, snapLines));
          onChange({ x: e.target.x(), y: e.target.y() }, false);
        },
    onDragEnd: grouped
      ? () => applyGroup(true)
      : (e: Konva.KonvaEventObject<DragEvent>) => {
          if (snapLines) snapNodeToGuides(e.target, snapLines);
          onSnap?.(null);
          onChange({ x: e.target.x(), y: e.target.y() }, true);
        },
    onTransformStart: grouped ? snapshot : undefined,
    onTransformEnd: grouped
      ? () => applyGroup(true)
      : () => {
          const n = ref.current!;
          // Shapes bake the resize into width/height and keep scale at 1, so
          // a rounded corner stays a true constant radius instead of being
          // stretched by a non-uniform node scale. A text frame does the
          // same, so dragging its handles reflows the text at its own size
          // rather than blowing the type up.
          if (layer.type === "text" && layer.flow) {
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
                width: Math.max(24, layer.width * sx),
                height: Math.max(24, (layer.height ?? DEFAULT_FLOW_HEIGHT) * sy),
              },
              true,
            );
            return;
          }
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
      <LayerInner
        layer={layer}
        asMask={asMask}
        meta={meta}
        vars={vars}
        obstacles={obstacles}
      />
    </Group>
  );
}
