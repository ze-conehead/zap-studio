import { TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { loadPictureGaps, type PictureGap } from "../collection";
import { useT } from "../i18n";

/** The cards' empty cover / screenshot frames, read when `open` turns true. */
export function usePictureGaps(open: boolean): Map<string, PictureGap> {
  const [gaps, setGaps] = useState<Map<string, PictureGap>>(() => new Map());
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void loadPictureGaps().then((g) => alive && setGaps(g));
    return () => {
      alive = false;
    };
  }, [open]);
  return gaps;
}

/** A small warning for a card that has no cover or lacks screenshots. */
export function PictureGapHint({ gap }: { gap?: PictureGap }) {
  const t = useT();
  if (!gap) return null;
  const parts: string[] = [];
  if (gap.cover) parts.push(t("No cover"));
  if (gap.shotsMissing > 0) {
    parts.push(
      gap.shotsMissing === gap.shotsTotal
        ? t("No screenshots")
        : t("{n} of {total} screenshots missing", { n: gap.shotsMissing, total: gap.shotsTotal }),
    );
  }
  if (!parts.length) return null;
  return (
    <span className="flex shrink-0 items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400" title={parts.join(" · ")}>
      <TriangleAlert className="size-3" /> {parts.join(" · ")}
    </span>
  );
}
