import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFormat } from "../formats";
import { useT } from "../i18n";
import { useStore } from "../store";

// "Add a back side" entry point, above the Layers panel. Once a back exists
// both faces are shown side by side in the editor, so nothing is needed here.
export function FaceControl() {
  const t = useT();
  const { state, dispatch } = useStore();
  if (!getFormat().hasBack || state.project.back) return null;

  return (
    <div className="border-b px-3 py-2">
      <Button
        variant="outline"
        size="sm"
        className="h-7 w-full"
        onClick={() => dispatch({ type: "ADD_BACK" })}
      >
        <Plus /> {t("Add back side")}
      </Button>
    </div>
  );
}
