import { useEffect, useRef, useState } from "react";
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

// "Find screenshots": walks through the still empty screenshot containers of
// one card (its right-click menu) or of every card of a console (the
// console's), one by one, each with the screenshot search. Works on the open
// design live, and on any other card's design on disk.

interface Plan {
  row: QuickImportRow;
  shots: Layer[]; // every screenshot container of this card, in order
  empty: Layer[]; // the ones nothing fills yet
}

export function FindScreenshotsFlow({
  rows,
  onClose,
}: {
  rows: QuickImportRow[];
  onClose: () => void;
}) {
  const t = useT();
  const { state, dispatch } = useStore();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [step, setStep] = useState(0);
  // Which card of `rows` is next to plan.
  const nextRow = useRef(0);
  // The containers per console, read once.
  const masksByConsole = useRef(new Map<string, Promise<Layer[]>>());

  const masksOf = (consoleId: string) => {
    let p = masksByConsole.current.get(consoleId);
    if (!p) {
      const live = state.project;
      p = (async () => {
        const globalP = live.isGlobalTemplate ? live : await loadProject(GLOBAL_TEMPLATE_ID);
        const consoleP =
          live.isTemplate && live.consoleId === consoleId ? live : await loadProject(templateId(consoleId));
        return [...alphaMasksOf(globalP), ...alphaMasksOf(consoleP)];
      })();
      masksByConsole.current.set(consoleId, p);
    }
    return p;
  };

  // The first card from `start` on that still has an empty screenshot
  // container, and the index to continue from after it. Pure in `start` — no
  // shared counter — so two runs at once (React's double effect in dev) agree.
  const planFrom = async (start: number): Promise<{ plan: Plan | null; at: number }> => {
    let i = start;
    while (i < rows.length) {
      const row = rows[i++];
      const masks = await masksOf(row.gameKey.split("/")[0]);
      const shots = screenshotMasksOf(masks);
      if (!shots.length) continue;
      let layers: Layer[] = [];
      if (row.gameKey === state.project.gameKey) layers = state.side === "back" ? [] : state.project.layers;
      else {
        const pid = getGameProject(row.gameKey);
        layers = (pid ? await loadProject(pid) : undefined)?.layers ?? [];
      }
      const filled = new Set(layers.filter((l) => l.type === "image").map((l) => resolveMask(l, masks)?.id));
      const empty = shots.filter((m) => !filled.has(m.id));
      if (empty.length) return { plan: { row, shots, empty }, at: i };
    }
    return { plan: null, at: i };
  };

  // Start with the first card that has something to find.
  useEffect(() => {
    let alive = true;
    void planFrom(0).then(({ plan: p, at }) => {
      if (!alive) return;
      if (!p) {
        alert(t("Every screenshot container already has a picture."));
        onClose();
        return;
      }
      nextRow.current = at;
      setPlan(p);
    });
    return () => {
      alive = false;
    };
    // Planned once, when the flow opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!plan) return null;
  const mask = plan.empty[step];
  const last = plan.empty.length - 1;
  const isOpen = plan.row.gameKey === state.project.gameKey;

  const next = () => {
    if (step < last) {
      setStep(step + 1);
      return;
    }
    // On to the next card.
    void planFrom(nextRow.current).then(({ plan: p, at }) => {
      if (!p) {
        onClose();
        return;
      }
      nextRow.current = at;
      setStep(0);
      setPlan(p);
    });
  };

  const insert = async (url: string) => {
    const { row } = plan;
    const frame = mask;
    const open = isOpen;
    next(); // on to the next frame while this one is fetched
    try {
      if (open) {
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

  const many = plan.empty.length > 1 || rows.length > 1;
  return (
    <CoverSearchDialog
      // A fresh dialog (and search) for every frame of every card.
      key={`${plan.row.gameKey}#${mask.id}`}
      open
      onOpenChange={(o) => !o && onClose()}
      kind="screenshot"
      shotIndex={plan.shots.findIndex((m) => m.id === mask.id) + 1}
      consoleName={plan.row.consoleName}
      gameTitle={plan.row.gameTitle}
      progress={many ? { index: step, total: plan.shots.length + 1 } : undefined}
      onSkip={many ? next : undefined}
      onPick={(url) => void insert(url)}
    />
  );
}
