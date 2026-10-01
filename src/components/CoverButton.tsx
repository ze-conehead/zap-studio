import { Images, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { findGame } from "../data/catalog";
import { fitImageToMask, makeImageLayer } from "../factory";
import { useT } from "../i18n";
import { urlToLayerSource } from "../image";
import { useStore } from "../store";
import { mainMaskOf, screenshotMasksOf } from "../templates";
import type { Layer } from "../types";
import { CoverSearchDialog } from "./CoverSearchDialog";

// "Find cover" for the open game card: shown in the Layers panel header, only
// when the current design is linked to a game. Picks a cover, embeds it and
// drops it in as the card's (mask-fitted) main image — then, if the templates
// define screenshot frames, walks through those one by one. A template whose
// frames are all flagged "screenshot only" (ShapeLayer#shotOnly) has no cover
// slot at all — every frame is just a screenshot to find.
export function CoverButton({ masks = [] }: { masks?: Layer[] }) {
  const { state, dispatch } = useStore();
  const t = useT();
  const foundGame = findGame(state.project.gameKey);
  const cover = mainMaskOf(masks);
  const screenshots = screenshotMasksOf(masks);
  // The frames to step through, cover first when there is one.
  const slots = cover ? [cover, ...screenshots] : screenshots;
  // null = closed, otherwise an index into `slots`.
  const [step, setStep] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  if (!foundGame || state.side === "back" || slots.length === 0) return null;

  const last = slots.length - 1;

  const insert = async (url: string) => {
    const current = step ?? 0;
    const isCover = !!cover && current === 0;
    // Move on straight away so the next frame's search starts loading.
    setStep(current < last ? current + 1 : null);
    try {
      setBusy(true);
      const img = await urlToLayerSource(url);
      const mask = slots[current];
      dispatch({
        type: "ADD_LAYER",
        layer: fitImageToMask(
          {
            ...makeImageLayer({
              ...img,
              name: isCover ? t("Main image") : mask.name,
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
          cover
            ? screenshots.length > 0
              ? t("Find cover and {n} screenshot(s)", { n: screenshots.length })
              : t("Find cover")
            : t("Find {n} screenshot(s)", { n: slots.length })
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
          kind={cover && step === 0 ? "cover" : "screenshot"}
          shotIndex={cover ? step : step + 1}
          consoleName={foundGame.console.name}
          gameTitle={foundGame.game.title}
          progress={slots.length > 1 ? { index: step, total: slots.length } : undefined}
          onSkip={
            slots.length > 1 ? () => setStep(step < last ? step + 1 : null) : undefined
          }
          onPick={(url) => void insert(url)}
        />
      )}
    </>
  );
}
