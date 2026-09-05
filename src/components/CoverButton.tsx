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

// "Find cover" for the open game card: shown in the Layers panel header,
// only when the current design is linked to a game. Picks a cover, embeds
// it and drops it in as the card's (mask-fitted) main image.
export function CoverButton({ mainMask }: { mainMask?: Layer }) {
  const { state, dispatch } = useStore();
  const t = useT();
  const foundGame = findGame(state.project.gameKey);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!foundGame) return null;

  const addCoverFromUrl = async (url: string) => {
    setOpen(false);
    try {
      setBusy(true);
      const img = await urlToLayerSource(url);
      dispatch({
        type: "ADD_LAYER",
        layer: fitImageToMask(
          {
            ...makeImageLayer({ ...img, name: foundGame.game.title }),
            main: true,
          },
          mainMask,
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
        title={t("Find cover")}
        onClick={() => setOpen(true)}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Images className="size-4" />
        )}
      </Button>
      <CoverSearchDialog
        open={open}
        onOpenChange={setOpen}
        consoleName={foundGame.console.name}
        gameTitle={foundGame.game.title}
        onPick={(url) => void addCoverFromUrl(url)}
      />
    </>
  );
}
