import type Konva from "konva";
import { ChevronLeft, ChevronRight, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCatalog } from "../data/catalog";
import { drawPack, packImageSources, PACK_SIZE, type DemoCard } from "../demo";
import { ensureFontsLoaded } from "../fonts";
import { preloadImage } from "../hooks/useImage";
import { captureTrim, CardStage } from "./CardStage";

const THUMB_W = 300; // render width per card (trimmed)
const START = { x: -10, y: -18 };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type Phase = "setup" | "loading" | "pack" | "open";

export function DemoMode({ onClose }: { onClose: () => void }) {
  const catalog = getCatalog();
  const [phase, setPhase] = useState<Phase>("setup");
  const [consoleId, setConsoleId] = useState("all");
  const [cards, setCards] = useState<DemoCard[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [opening, setOpening] = useState(false);
  const [view, setView] = useState<number | null>(null);

  const stages = useRef<(Konva.Stage | null)[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const cardEls = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (view !== null) setView(null);
        else onClose();
      }
      if (view !== null && e.key === "ArrowRight") setView((v) => step(v, 1, cards.length));
      if (view !== null && e.key === "ArrowLeft") setView((v) => step(v, -1, cards.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, view, cards.length]);

  const start = async () => {
    setPhase("loading");
    const drawn = await drawPack(consoleId === "all" ? undefined : consoleId);
    await ensureFontsLoaded();
    await Promise.all(packImageSources(drawn).map(preloadImage));
    stages.current = [];
    setImages([]);
    setCards(drawn);
  };

  // Capture the hidden stages once they've painted, then show the pack.
  useEffect(() => {
    if (!cards.length || images.length) return;
    let alive = true;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!alive) return;
        setImages(
          cards.map((_, i) => {
            const s = stages.current[i];
            return s ? captureTrim(s, THUMB_W) : "";
          }),
        );
        setPhase("pack");
      }),
    );
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, [cards, images.length]);

  // Fly the cards out of the pack (FLIP: start them at the pack, then let
  // them transition into their grid slots).
  useLayoutEffect(() => {
    if (phase !== "open") return;
    const wrap = gridRef.current;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const els = cardEls.current.slice(0, cards.length);
    els.forEach((el) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = wr.width / 2 - (r.left - wr.left + r.width / 2);
      const dy = wr.height / 2 - (r.top - wr.top + r.height / 2);
      el.style.transition = "none";
      el.style.opacity = "0";
      el.style.transform = `translate(${dx}px, ${dy}px) scale(0.1) rotateY(150deg)`;
    });
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        els.forEach((el, i) => {
          if (!el) return;
          const d = i * 55;
          el.style.transition = `transform 640ms cubic-bezier(.16,1,.3,1) ${d}ms, opacity 320ms ease ${d}ms`;
          el.style.opacity = "";
          el.style.transform = "";
        });
      }),
    );
    return () => cancelAnimationFrame(id);
  }, [phase, cards.length]);

  const openPack = () => {
    if (opening) return;
    setOpening(true);
    window.setTimeout(() => setPhase("open"), 520);
  };

  const again = () => {
    setOpening(false);
    setView(null);
    setPhase("setup");
    setCards([]);
    setImages([]);
  };

  const label =
    consoleId === "all"
      ? "Alle Konsolen"
      : (catalog.find((c) => c.id === consoleId)?.name ?? "");

  return (
    <div className="demo-backdrop">
      <button className="demo-close" title="Schließen" onClick={onClose}>
        <X className="size-4" />
      </button>

      {/* Off-screen stages we capture the card PNGs from. */}
      {cards.length > 0 && images.length === 0 && (
        <div className="demo-offscreen" aria-hidden>
          {cards.map((c, i) => (
            <CardStage
              key={c.key}
              card={c}
              width={THUMB_W}
              stageRef={(s) => {
                stages.current[i] = s;
              }}
            />
          ))}
        </div>
      )}

      {phase === "setup" && (
        <div className="demo-setup">
          <h2 className="text-lg font-semibold">Demo-Modus</h2>
          <p className="text-sm text-muted-foreground">
            Zieh ein Booster-Pack mit {PACK_SIZE} zufälligen Karten – aus einer
            Konsole oder aus allen.
          </p>
          <Select value={consoleId} onValueChange={setConsoleId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Konsolen</SelectItem>
              {catalog.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => void start()}>
            <Sparkles /> Pack ziehen
          </Button>
        </div>
      )}

      {phase === "loading" && (
        <div className="flex items-center gap-2 text-sm text-white/70">
          <Loader2 className="size-4 animate-spin" /> Karten werden gerendert …
        </div>
      )}

      {(phase === "pack" || phase === "open") && (
        <div className="demo-stage">
          {phase === "pack" && (
            <button
              className={opening ? "demo-pack opening" : "demo-pack"}
              onClick={openPack}
              title="Pack öffnen"
            >
              <span className="demo-pack-strip" />
              <span className="demo-pack-body">
                <span className="demo-pack-shine" />
                <span className="demo-pack-label">{label}</span>
                <span className="demo-pack-count">{cards.length} Karten</span>
              </span>
            </button>
          )}

          <div
            ref={gridRef}
            className="demo-grid"
            style={{ visibility: phase === "open" ? "visible" : "hidden" }}
          >
            {cards.map((c, i) => (
              <button
                key={c.key}
                ref={(el) => {
                  cardEls.current[i] = el;
                }}
                className={c.holo ? "demo-card holo" : "demo-card"}
                onClick={() => setView(i)}
                title={`${c.gameTitle} – ${c.consoleName}`}
              >
                {images[i] ? (
                  <img src={images[i]} alt={c.gameTitle} draggable={false} />
                ) : (
                  <span className="demo-card-fallback">{c.gameTitle}</span>
                )}
                {c.holo && <span className="demo-card-foil" />}
              </button>
            ))}
          </div>

          {phase === "open" && (
            <div className="demo-bar">
              <span className="text-xs text-muted-foreground">
                {label} · {cards.length} Karten
                {cards.some((c) => c.holo) && " · ✨ 1 holografisch"}
              </span>
              <Button variant="outline" size="sm" onClick={again}>
                <Sparkles /> Neues Pack
              </Button>
            </div>
          )}
        </div>
      )}

      {view !== null && cards[view] && (
        <CardViewer
          card={cards[view]}
          image={images[view]}
          index={view}
          total={cards.length}
          onPrev={() => setView((v) => step(v, -1, cards.length))}
          onNext={() => setView((v) => step(v, 1, cards.length))}
          onClose={() => setView(null)}
        />
      )}
    </div>
  );
}

const step = (v: number | null, d: number, n: number) =>
  v === null || n === 0 ? v : (v + d + n) % n;

function CardViewer({
  card,
  image,
  index,
  total,
  onPrev,
  onNext,
  onClose,
}: {
  card: DemoCard;
  image?: string;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const [holo, setHolo] = useState(card.holo);
  const [rot, setRot] = useState(START);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);

  useEffect(() => {
    setHolo(card.holo);
    setRot(START);
  }, [card.key, card.holo]);

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
      <button
        className="demo-nav left"
        onPointerDown={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        title="Vorherige Karte"
      >
        <ChevronLeft />
      </button>
      <button
        className="demo-nav right"
        onPointerDown={(e) => {
          e.stopPropagation();
          onNext();
        }}
        title="Nächste Karte"
      >
        <ChevronRight />
      </button>

      <div className="preview3d-scene" onPointerDown={(e) => e.stopPropagation()}>
        <div
          className={dragging ? "preview3d-card dragging" : "preview3d-card"}
          style={cardStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="face front">
            {image ? (
              <img src={image} alt={card.gameTitle} draggable={false} />
            ) : (
              <div className="preview3d-placeholder">{card.gameTitle}</div>
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
        <span className="text-xs text-muted-foreground">
          {index + 1} / {total} · {card.gameTitle}
        </span>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={holo} onCheckedChange={(v) => setHolo(!!v)} />
          Holografisch
        </label>
        <Button variant="outline" size="sm" onClick={() => setRot(START)}>
          <RotateCcw /> Zurücksetzen
        </Button>
        <Button variant="outline" size="sm" onClick={onClose}>
          <X /> Zurück
        </Button>
      </div>

      <p className="preview3d-hint" onPointerDown={(e) => e.stopPropagation()}>
        Ziehen zum Drehen · ← → für die nächste Karte
      </p>
    </div>
  );
}
