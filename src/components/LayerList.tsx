import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Lock,
  LockOpen,
  Shapes,
  Trash2,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isImage, isShape } from "../factory";
import { useStore } from "../store";

export function LayerList() {
  const { state, dispatch } = useStore();
  const layers = [...state.project.layers].reverse(); // top of stack first

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
          const Icon = isImage(l) ? ImageIcon : isShape(l) ? Shapes : Type;
          return (
            <li
              key={l.id}
              className={cn(
                "flex items-center gap-0.5 rounded-md border bg-card px-1.5 py-1 text-sm",
                active ? "border-primary bg-accent" : "hover:bg-accent/50",
              )}
            >
              <button
                className="flex min-w-0 flex-1 items-center gap-1.5"
                onClick={() => dispatch({ type: "SELECT", id: l.id })}
              >
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate" title={l.name}>
                  {l.name}
                </span>
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
                title="Nach vorne"
                onClick={() => dispatch({ type: "REORDER", id: l.id, dir: "up" })}
              >
                <ArrowUp />
              </LayerIcon>
              <LayerIcon
                title="Nach hinten"
                onClick={() => dispatch({ type: "REORDER", id: l.id, dir: "down" })}
              >
                <ArrowDown />
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
