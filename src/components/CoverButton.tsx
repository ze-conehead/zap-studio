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
export function CoverButton({ masks = [] }: { masks?: Layer[] }) {
  const { state, dispatch } = useStore();
  const t = useT();
  const foundGame = findGame(state.project.gameKey);
  // null = closed, 0 = the cover (the first frame), 1..n = the frames after it.
  const [step, setStep] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  if (!foundGame || state.side === "back") return null;

  const last = Math.max(0, masks.length - 1);

  const insert = async (url: string) => {
    const current = step ?? 0;
    // Move on straight away so the next frame's search starts loading.
    setStep(current < last ? current + 1 : null);
    try {
      setBusy(true);
      const img = await urlToLayerSource(url);
      const mask = masks[current];
      dispatch({
        type: "ADD_LAYER",
        layer: fitImageToMask(
          {
            ...makeImageLayer({
              ...img,
              name: current === 0 ? t("Main image") : mask.name,
            }),
            maskId: mask?.id,
          },
          mask,
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
          masks.length > 1
            ? t("Find cover and {n} screenshot(s)", { n: masks.length - 1 })
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
          shotIndex={step}
          consoleName={foundGame.console.name}
          gameTitle={foundGame.game.title}
          progress={
            masks.length > 1 ? { index: step, total: masks.length } : undefined
          }
          onSkip={
            masks.length > 1
              ? () => setStep(step < last ? step + 1 : null)
              : undefined
          }
          onPick={(url) => void insert(url)}
        />
      )}
    </>
  );
}
