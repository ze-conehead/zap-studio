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
  Shapes,
  Trash2,
  Type,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isImage, isMetaBadge, isShape } from "../factory";
import { useStore } from "../store";

export function LayerList() {
  const { state, dispatch } = useStore();
  const layers = [...state.project.layers].reverse(); // top of stack first

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
      <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Ebenen
      </h2>

      {layers.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Noch keine Ebenen. Füge oben Text, ein Bild oder ein Logo hinzu.
        </p>
      )}

      <ul className="flex flex-col gap-1">
        {layers.map((l) => {
          const active = l.id === state.selectedId;
          const Icon = isImage(l)
            ? ImageIcon
            : isShape(l)
              ? Shapes
              : isMetaBadge(l)
                ? Award
                : Type;
          return (
            <li
              key={l.id}
              draggable
              onDragStart={(e) => {
                dragId.current = l.id;
                setDragging(l.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={reset}
              onDragOver={(e) => {
                if (!dragId.current || dragId.current === l.id) return;
                e.preventDefault();
                const r = e.currentTarget.getBoundingClientRect();
                setOver({ id: l.id, after: e.clientY > r.top + r.height / 2 });
              }}
              onDrop={(e) => {
                e.preventDefault();
                const src = dragId.current;
                const r = e.currentTarget.getBoundingClientRect();
                if (src) applyDrop(src, l.id, e.clientY > r.top + r.height / 2);
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
              <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground/40" />

              <button
                className="flex min-w-0 flex-1 items-center gap-1.5"
                onClick={() => dispatch({ type: "SELECT", id: l.id })}
              >
                {l.clipped && (
                  <CornerDownRight className="size-3.5 shrink-0 text-primary" />
                )}
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate" title={l.name}>
                  {l.name}
                </span>
                {l.mask && <Crop className="size-3.5 shrink-0 text-primary" />}
              </button>

              <LayerIcon
                title={l.visible ? "Ausblenden" : "Einblenden"}
                onClick={() =>
                  dispatch({ type: "PATCH_LAYER", id: l.id, patch: { visible: !l.visible } })
                }
              >
                {l.visible ? <Eye /> : <EyeOff />}
              </LayerIcon>
              <LayerIcon
                title={l.locked ? "Entsperren" : "Sperren"}
                onClick={() =>
                  dispatch({ type: "PATCH_LAYER", id: l.id, patch: { locked: !l.locked } })
                }
              >
                {l.locked ? <Lock /> : <LockOpen />}
              </LayerIcon>
              <LayerIcon
                title="Duplizieren"
                onClick={() => dispatch({ type: "DUPLICATE_LAYER", id: l.id })}
              >
                <Copy />
              </LayerIcon>
              <LayerIcon
                title="Löschen"
                className="hover:text-destructive"
                onClick={() => dispatch({ type: "DELETE_LAYER", id: l.id })}
              >
                <Trash2 />
              </LayerIcon>
            </li>
          );
        })}
      </ul>

      {layers.length > 1 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Ziehen zum Umsortieren.
        </p>
      )}
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
