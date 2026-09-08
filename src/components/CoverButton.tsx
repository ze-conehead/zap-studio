import { Images, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { findGame } from "../data/catalog";
import { fitImageToMask, makeImageLayer } from "../factory";
import { useT } from "../i18n";
import { urlToLayerSource } from "../image";
import { useStore } from "../store";
import type { Layer } from "../types";
import { CoverSearchDialog } from "./CoverSearchDialog";

// "Find cover" for the open game card: shown in the Layers panel header, only
// when the current design is linked to a game. Picks a cover, embeds it and
// drops it in as the card's (mask-fitted) main image — then, if the templates
// define screenshot frames, walks through those one by one.
export function CoverButton({
  mainMask,
  shotMasks = [],
}: {
  mainMask?: Layer;
  shotMasks?: Layer[];
}) {
  const { state, dispatch } = useStore();
  const t = useT();
  const foundGame = findGame(state.project.gameKey);
  // null = closed, 0 = the cover, 1..n = the nth screenshot frame.
  const [step, setStep] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  if (!foundGame || state.side === "back") return null;

  const shotMask = step && step > 0 ? shotMasks[step - 1] : undefined;

  const insert = async (url: string) => {
    const current = step ?? 0;
    // Move on straight away so the next frame's search starts loading.
    setStep(current + 1 <= shotMasks.length ? current + 1 : null);
    try {
      setBusy(true);
      const img = await urlToLayerSource(url);
      const base = makeImageLayer({
        ...img,
        name: current === 0 ? t("Main image") : t("Screenshot {n}", { n: current }),
      });
      dispatch({
        type: "ADD_LAYER",
        layer: fitImageToMask(
          current === 0
            ? { ...base, main: true }
            : { ...base, shot: shotMasks[current - 1].shotMask },
          current === 0 ? mainMask : shotMasks[current - 1],
        ),
      });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="size-7"
        title={
          shotMasks.length
            ? t("Find cover and {n} screenshot(s)", { n: shotMasks.length })
            : t("Find cover")
        }
        onClick={() => setStep(0)}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Images className="size-4" />
        )}
      </Button>
      {step !== null && (
        <CoverSearchDialog
          open
          onOpenChange={(o) => !o && setStep(null)}
          kind={step === 0 ? "cover" : "screenshot"}
          shotIndex={shotMask?.shotMask}
          consoleName={foundGame.console.name}
          gameTitle={foundGame.game.title}
          progress={
            shotMasks.length
              ? { index: step, total: shotMasks.length + 1 }
              : undefined
          }
          onSkip={
            shotMasks.length
              ? () => setStep(step + 1 <= shotMasks.length ? step + 1 : null)
              : undefined
          }
          onPick={(url) => void insert(url)}
        />
      )}
    </>
  );
}
