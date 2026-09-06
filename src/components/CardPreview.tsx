import { FlipHorizontal2, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useT } from "../i18n";
import { exportPng } from "../export";
import { getFormat } from "../formats";
import { useStore } from "../store";
import { Card3D, type Card3DHandle } from "./Card3D";
import type { CanvasHandle } from "./EditorCanvas";

export function CardPreview({
  canvas,
  onClose,
}: {
  canvas: React.MutableRefObject<CanvasHandle | null>;
  onClose: () => void;
}) {
  const t = useT();
  const { state } = useStore();
  const hasBack = !!state.project.back;
  const [img, setImg] = useState<string | null>(null);
  const [backImg, setBackImg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [holo, setHolo] = useState(false);
  const card = useRef<Card3DHandle>(null);

  useEffect(() => {
    const w = canvas.current?.getStageWidth() ?? 0;
    const front = canvas.current?.getStage("front");
    if (!front || !w) {
      setErr(t("No card to show."));
      return;
    }
    // Both faces are mounted at once now — grab each stage directly.
    let cancelled = false;
    const fail = (e: unknown) => !cancelled && setErr((e as Error).message);
    exportPng({ stage: front, stageWidth: w, mode: "trim" })
      .then((d) => !cancelled && setImg(d))
      .catch(fail);
    if (hasBack) {
      const b = canvas.current?.getStage("back");
      if (b) {
        exportPng({ stage: b, stageWidth: w, mode: "trim" })
          .then((d) => !cancelled && setBackImg(d))
          .catch(fail);
      }
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = card.current;
      if (e.key === "Escape") return onClose();
      if (!c) return;
      if (e.key === "ArrowLeft") c.spin(-45);
      else if (e.key === "ArrowRight") c.spin(45);
      else if (e.key === "f" || e.key === "F") c.flip();
      else if (e.key === "r" || e.key === "R") c.reset();
      else if (e.key === "+" || e.key === "=") c.zoomBy(1.15);
      else if (e.key === "-" || e.key === "_") c.zoomBy(1 / 1.15);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Multi-panel formats (DVD wrap, J-card) aren't a card you turn over —
  // show the flat artboard with the fold lines marked.
  const panels = getFormat().panels;
  if (panels && panels.length > 1) {
    const totalW = panels.reduce((s, p) => s + p.wMM, 0);
    let acc = 0;
    const folds = panels.slice(0, -1).map((p) => {
      acc += p.wMM;
      return (acc / totalW) * 100;
    });
    return (
      <div className="preview3d-backdrop" onPointerDown={onClose}>
        <div className="flat-preview" onPointerDown={(e) => e.stopPropagation()}>
          {img ? (
            <img src={img} alt={t("Card preview")} draggable={false} />
          ) : (
            <div className="preview3d-placeholder">{err ?? t("rendering …")}</div>
          )}
          {folds.map((pct) => (
            <span
              key={pct}
              className="flat-preview-fold"
              style={{ left: `${pct}%` }}
            />
          ))}
        </div>
        <div className="preview3d-bar" onPointerDown={(e) => e.stopPropagation()}>
          <span className="text-xs text-muted-foreground">
            {t("Fold lines dashed")}
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X /> {t("Close")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="preview3d-backdrop" onPointerDown={onClose}>
      <div onPointerDown={(e) => e.stopPropagation()}>
        <Card3D
          ref={card}
          front={img}
          back={backImg}
          holo={holo}
          placeholder={err ?? t("rendering …")}
        />
      </div>

      <div className="preview3d-bar" onPointerDown={(e) => e.stopPropagation()}>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={holo} onCheckedChange={(v) => setHolo(!!v)} />
          {t("Holographic card")}
        </label>
        <span className="preview3d-sep" />
        <Button
          variant="outline"
          size="icon"
          title={t("Zoom out")}
          onClick={() => card.current?.zoomBy(1 / 1.2)}
        >
          <ZoomOut />
        </Button>
        <Button
          variant="outline"
          size="icon"
          title={t("Zoom in")}
          onClick={() => card.current?.zoomBy(1.2)}
        >
          <ZoomIn />
        </Button>
        <Button variant="outline" size="sm" onClick={() => card.current?.flip()}>
          <FlipHorizontal2 /> {t("Flip")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => card.current?.reset()}>
          <RotateCcw /> {t("Reset view")}
        </Button>
        <Button variant="outline" size="sm" onClick={onClose}>
          <X /> {t("Close")}
        </Button>
      </div>

      <p className="preview3d-hint" onPointerDown={(e) => e.stopPropagation()}>
        {t("Drag to rotate · flick to spin · wheel to zoom · F flips, R resets")}
      </p>
    </div>
  );
}
