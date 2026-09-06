import {
  Award,
  Copy,
  CornerDownRight,
  Crop,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Lock,
  LockOpen,
  PaintBucket,
  Shapes,
  Trash2,
  Type,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isBackground, isImage, isMetaBadge, isShape } from "../factory";
import { useT } from "../i18n";
import { useStore } from "../store";
import type { Layer } from "../types";
import { AddLayerMenu } from "./AddLayerMenu";
import { CoverButton } from "./CoverButton";

export function LayerList({ mainMask }: { mainMask?: Layer }) {
  const t = useT();
  const { state, dispatch } = useStore();
  const faceLayers =
    state.side === "back"
      ? state.project.back?.layers ?? []
      : state.project.layers;
  const layers = [...faceLayers].reverse(); // top of stack first
  const contentCount = faceLayers.filter((l) => !isBackground(l)).length;

  const dragId = useRef<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null);

  const reset = () => {
    dragId.current = null;
    setDragging(null);
    setOver(null);
  };

  const applyDrop = (srcId: string, tgtId: string, after: boolean) => {
    if (srcId === tgtId) return;
    const ids = layers.map((l) => l.id).filter((id) => id !== srcId);
    let ti = ids.indexOf(tgtId);
    if (ti < 0) return;
    if (after) ti += 1;
    ids.splice(ti, 0, srcId);
    dispatch({ type: "SET_LAYER_ORDER", order: [...ids].reverse() });
  };

  return (
    <section className="border-b p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("Layers")}
        </h2>
        <div className="flex items-center gap-1">
          <CoverButton mainMask={mainMask} />
          <AddLayerMenu mainMask={mainMask} />
        </div>
      </div>

      {contentCount === 0 && (
        <p className="text-xs text-muted-foreground">
          {t("No layers yet. Add text, an image or a shape above.")}
        </p>
      )}

      <ul className="flex flex-col gap-1">
        {mainMask &&
          !state.project.isGlobalTemplate &&
          state.side !== "back" && (
            <li
              className="flex items-center gap-1.5 rounded-md border border-dashed bg-card px-1 py-1 text-sm text-muted-foreground"
              title={t("Editable only in “All consoles”")}
            >
              <span className="size-3.5 shrink-0" />
              <Crop className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {t("Main alpha mask")}
              </span>
              <Lock className="mr-1 size-3.5 shrink-0 opacity-60" />
            </li>
          )}

        {layers.map((l) => {
          const active = l.id === state.selectedId;
          const bg = isBackground(l);
          const Icon = bg
            ? PaintBucket
            : isImage(l)
              ? ImageIcon
              : isShape(l)
                ? Shapes
                : isMetaBadge(l)
                  ? Award
                  : Type;
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
              className={cn(
                "flex items-center gap-0.5 rounded-md border bg-card px-1 py-1 text-sm",
                active ? "border-primary bg-accent" : "hover:bg-accent/50",
                l.clipped && "ml-3 border-l-2 border-l-primary/50",
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
                onClick={() => dispatch({ type: "SELECT", id: l.id })}
              >
                {l.clipped && (
                  <CornerDownRight className="size-3.5 shrink-0 text-primary" />
                )}
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                <span
                  className="truncate"
                  title={isImage(l) && l.main ? t("Main image") : l.name}
                >
                  {isImage(l) && l.main ? t("Main image") : l.name}
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
        })}
      </ul>
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
