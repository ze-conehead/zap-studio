import { Plus } from "lucide-react";
import type { GuideApi } from "../App";
import { Button } from "@/components/ui/button";
import { SPINE_FOLD_X } from "../card";
import { getFormat } from "../formats";
import { useT } from "../i18n";
import { useStore } from "../store";

// "Add a back side" entry point, above the Layers panel. Once a back exists
// both faces are shown side by side in the editor, so nothing is needed here.
export function FaceControl({ guides }: { guides: GuideApi }) {
  const t = useT();
  const { state, dispatch } = useStore();
  if (!getFormat().hasBack || state.project.back) return null;

  return (
    <div className="border-b px-3 py-2">
      <Button
        variant="outline"
        size="sm"
        className="h-7 w-full"
        onClick={() => {
          dispatch({ type: "ADD_BACK" });
          // Switch case / DVD wrap: the back is the case's inside, folding
          // at the same spine the front panels show — pre-populate guides
          // there so it's obvious where the fold lands.
          if (SPINE_FOLD_X) {
            guides.addAt("x", SPINE_FOLD_X[0]);
            guides.addAt("x", SPINE_FOLD_X[1]);
          }
        }}
      >
        <Plus /> {t("Add back side")}
      </Button>
    </div>
  );
}
