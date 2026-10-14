import { useEffect, useState } from "react";
import { GLOBAL_TEMPLATE_ID, fitImageToMask, makeImageLayer, templateId } from "../factory";
import { getGameProject } from "../gameIndex";
import { useT } from "../i18n";
import { urlToLayerSource } from "../image";
import { loadProject } from "../persist";
import { insertMaskImages, type QuickImportRow } from "../quickImport";
import { useStore } from "../store";
import { alphaMasksOf, resolveMask, screenshotMasksOf } from "../templates";
import type { Layer } from "../types";
import { CoverSearchDialog } from "./CoverSearchDialog";

// Right-click a game ▸ "Find screenshots": walks through the card's still
// empty screenshot containers one by one, each with the screenshot search.
// Works on the open design live, and on any other card's design on disk.

interface Plan {
  shots: Layer[]; // every screenshot container of this card, in order
  empty: Layer[]; // the ones nothing fills yet
}

export function FindScreenshotsFlow({
  row,
  onClose,
}: {
  row: QuickImportRow;
  onClose: () => void;
}) {
  const t = useT();
  const { state, dispatch } = useStore();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [step, setStep] = useState(0);
  const isOpen = row.gameKey === state.project.gameKey;

  // What this card could show, and what it already shows.
  useEffect(() => {
    let alive = true;
    (async () => {
      const consoleId = row.gameKey.split("/")[0];
      const live = state.project;
      const globalP = live.isGlobalTemplate ? live : await loadProject(GLOBAL_TEMPLATE_ID);
      const consoleP =
        live.isTemplate && live.consoleId === consoleId ? live : await loadProject(templateId(consoleId));
      const masks = [...alphaMasksOf(globalP), ...alphaMasksOf(consoleP)];
      const shots = screenshotMasksOf(masks);
      let layers: Layer[] = [];
      if (isOpen) layers = state.side === "back" ? [] : live.layers;
      else {
        const pid = getGameProject(row.gameKey);
        layers = (pid ? await loadProject(pid) : undefined)?.layers ?? [];
      }
      const filled = new Set(layers.filter((l) => l.type === "image").map((l) => resolveMask(l, masks)?.id));
      const empty = shots.filter((m) => !filled.has(m.id));
      if (!alive) return;
      if (!empty.length) {
        alert(
          shots.length
            ? t("Every screenshot container of this card already has a picture.")
            : t("There is no screenshot container for this console yet."),
        );
        onClose();
        return;
      }
      setPlan({ shots, empty });
    })();
    return () => {
      alive = false;
    };
    // Planned once, when the flow opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!plan) return null;
  const mask = plan.empty[step];
  const last = plan.empty.length - 1;
  const next = () => (step < last ? setStep(step + 1) : onClose());

  const insert = async (url: string) => {
    const frame = mask;
    next(); // on to the next frame while this one is fetched
    try {
      if (isOpen) {
        const img = await urlToLayerSource(url);
        dispatch({
          type: "ADD_LAYER",
          layer: fitImageToMask(
            { ...makeImageLayer({ ...img, name: frame.name }), maskId: frame.id },
            frame,
          ),
        });
      } else {
        await insertMaskImages(row, [{ url, mask: frame, name: frame.name }]);
      }
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <CoverSearchDialog
      open
      onOpenChange={(o) => !o && onClose()}
      kind="screenshot"
      shotIndex={plan.shots.findIndex((m) => m.id === mask.id) + 1}
      consoleName={row.consoleName}
      gameTitle={row.gameTitle}
      progress={plan.empty.length > 1 ? { index: step, total: plan.shots.length + 1 } : undefined}
      onSkip={plan.empty.length > 1 ? next : undefined}
      onPick={(url) => void insert(url)}
    />
  );
}
