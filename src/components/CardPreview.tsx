import { RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { exportPng } from "../export";
import type { CanvasHandle } from "./EditorCanvas";

const START = { x: -10, y: -20 };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function CardPreview({
  canvas,
  onClose,
}: {
  canvas: React.MutableRefObject<CanvasHandle | null>;
  onClose: () => void;
}) {
  const [img, setImg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [holo, setHolo] = useState(false);
  const [rot, setRot] = useState(START);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);

  useEffect(() => {
    const stage = canvas.current?.getStage();
    const w = canvas.current?.getStageWidth() ?? 0;
    if (!stage || !w) {
      setErr("Keine Karte zum Anzeigen.");
      return;
    }
    exportPng({ stage, stageWidth: w, mode: "trim" })
      .then(setImg)
      .catch((e) => setErr((e as Error).message));
  }, [canvas]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, rx: rot.x, ry: rot.y };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setRot({
      x: clamp(d.rx - (e.clientY - d.y) * 0.32, -72, 72),
      y: clamp(d.ry + (e.clientX - d.x) * 0.32, -85, 85),
    });
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  // Holo look is derived from the current tilt, so it shifts as you move.
  const cardStyle: CSSProperties = {
    transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
    ["--holo" as string]: holo ? 1 : 0,
    ["--px" as string]: `${clamp(50 + rot.y * 0.7, 10, 90)}%`,
    ["--py" as string]: `${clamp(50 - rot.x * 0.9, 10, 90)}%`,
    ["--foil-pos" as string]: `${50 + rot.y * 1.6}% ${50 + rot.x * 1.6}%`,
    ["--foil-angle" as string]: `${110 + rot.y * 0.6}deg`,
  };

  return (
    <div className="preview3d-backdrop" onPointerDown={onClose}>
      <div
        className="preview3d-scene"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div
          className={dragging ? "preview3d-card dragging" : "preview3d-card"}
          style={cardStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="face front">
            {img && <img src={img} alt="Kartenvorschau" draggable={false} />}
            {!img && (
              <div className="preview3d-placeholder">
                {err ?? "wird gerendert …"}
              </div>
            )}
            <div className="foil" />
            <div className="sparkle" />
            <div className="glare" />
          </div>
          <div className="face back" />
          <div className="edge edge-l" />
          <div className="edge edge-r" />
          <div className="edge edge-t" />
          <div className="edge edge-b" />
        </div>
      </div>

      <div className="preview3d-bar" onPointerDown={(e) => e.stopPropagation()}>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={holo} onCheckedChange={(v) => setHolo(!!v)} />
          Holographische Karte
        </label>
        <Button variant="outline" size="sm" onClick={() => setRot(START)}>
          <RotateCcw /> Ansicht zurücksetzen
        </Button>
        <Button variant="outline" size="sm" onClick={onClose}>
          <X /> Schließen
        </Button>
      </div>

      <p className="preview3d-hint" onPointerDown={(e) => e.stopPropagation()}>
        Ziehen zum Drehen
      </p>
    </div>
  );
}
