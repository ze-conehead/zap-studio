import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getFormat } from "../formats";
import { useT } from "../i18n";
import { useStore } from "../store";

// Front | Back switch (or the "add a back side" entry point) shown right
// above the Layers panel — both are scoped to the active face.
export function FaceControl() {
  const t = useT();
  const { state, dispatch } = useStore();
  const { project, side } = state;
  if (!getFormat().hasBack) return null;

  return (
    <div className="border-b px-3 py-2">
      {project.back ? (
        <div className="flex overflow-hidden rounded-md border text-xs font-medium">
          {(["front", "back"] as const).map((s) => (
            <button
              key={s}
              onClick={() => dispatch({ type: "SET_SIDE", side: s })}
              className={cn(
                "flex-1 px-2.5 py-1",
                side === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {s === "front" ? t("Front") : t("Back")}
            </button>
          ))}
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-full"
          onClick={() => dispatch({ type: "ADD_BACK" })}
        >
          <Plus /> {t("Add back side")}
        </Button>
      )}
    </div>
  );
}
