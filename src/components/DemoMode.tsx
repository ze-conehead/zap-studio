import type Konva from "konva";
import {
  ChevronLeft,
  ChevronRight,
  FlipHorizontal2,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { getFormat, previewCssVars } from "../formats";
import { drawPack, packImageSources, PACK_SIZE, type DemoCard } from "../demo";
import { ensureFontsLoaded } from "../fonts";
import { preloadImage } from "../hooks/useImage";
import { useT } from "../i18n";
import { Card3D, type Card3DHandle } from "./Card3D";
import { captureTrim, CardStage } from "./CardStage";

const THUMB_W = 300; // render width per card (trimmed)

// Pack-opening choreography, in ms from the click. The CSS keyframes on
// .demo-pack.opening (shake → strip rips at 300 ms → pack flies off) run to
// the same clock.
const BURST_AT = 430; // light + confetti blow out of the tear
const DEAL_AT = 820; // the pack is gone, cards start flying out
const BURST_MS = 1900;

const reduced = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

type Phase = "setup" | "loading" | "pack" | "open";

export function DemoMode({ onClose }: { onClose: () => void }) {
  const t = useT();
  const catalog = getCatalog();
  const [phase, setPhase] = useState<Phase>("setup");
  const [consoleId, setConsoleId] = useState("all");
  const [cards, setCards] = useState<DemoCard[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [opening, setOpening] = useState(false);
  const [burst, setBurst] = useState(0); // bumps to (re)fire the burst
  const [view, setView] = useState<number | null>(null);

  const stages = useRef<(Konva.Stage | null)[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const cardEls = useRef<(HTMLButtonElement | null)[]>([]);
  const packRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (view !== null) setView(null);
        else onClose();
      }
      if (view !== null && e.key === "ArrowRight") setView((v) => step(v, 1, cards.length));
      if (view !== null && e.key === "ArrowLeft") setView((v) => step(v, -1, cards.length));
      if (phase === "pack" && (e.key === "Enter" || e.key === " ")) openPack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, view, cards.length, phase, opening]);

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
          cards.map((c, i) => {
            const s = stages.current[i];
            if (!s) return "";
            // toDataURL() can throw (a tainted canvas, say) — one bad card
            // must not leave the whole pack stuck loading forever; it
            // falls back to the title-only card face below.
            try {
              return captureTrim(s, THUMB_W);
            } catch (e) {
              console.error("Demo pack: couldn't render", c.gameTitle, e);
              return "";
            }
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

  // The shiny card is dealt last, so the pack builds to it.
  const dealOrder = useMemo(() => {
    const order = cards.map((_, i) => i);
    order.sort((a, b) => Number(cards[a]?.holo) - Number(cards[b]?.holo));
    return order;
  }, [cards]);

  // Deal the cards out of the (now torn-open) pack into their grid slots.
  useLayoutEffect(() => {
    if (phase !== "open") return;
    const wrap = gridRef.current;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const soft = reduced();

    dealOrder.forEach((idx, slot) => {
      const el = cardEls.current[idx];
      if (!el) return;
      const r = el.getBoundingClientRect();
      // Vector from this slot back to the pack (dead centre of the stage).
      const dx = wr.width / 2 - (r.left - wr.left + r.width / 2);
      const dy = wr.height / 2 - (r.top - wr.top + r.height / 2);
      const holo = cards[idx]?.holo;

      if (soft) {
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 200,
          delay: slot * 20,
          fill: "backwards",
        });
        return;
      }

      const spin = (idx % 2 ? 1 : -1) * (150 + ((idx * 47) % 120));
      const delay = slot * 74 + (holo ? 460 : 0);
      const dur = holo ? 1180 : 900;

      el.animate(
        [
          {
            offset: 0,
            opacity: 0,
            transform: `translate3d(${dx}px, ${dy + 26}px, 0) scale(.16) rotateY(168deg) rotateZ(${spin}deg)`,
          },
          {
            offset: 0.2,
            opacity: 1,
            transform: `translate3d(${dx * 0.88}px, ${dy * 0.7 - 78}px, 0) scale(.44) rotateY(112deg) rotateZ(${spin * 0.6}deg)`,
          },
          {
            offset: 0.58,
            opacity: 1,
            transform: `translate3d(${dx * 0.38}px, ${dy * 0.32 - 104}px, 0) scale(.84) rotateY(30deg) rotateZ(${spin * 0.2}deg)`,
          },
          {
            offset: 0.87,
            opacity: 1,
            transform: "translate3d(0,0,0) scale(1.08) rotateY(0deg) rotateZ(0deg)",
          },
          { offset: 1, opacity: 1, transform: "none" },
        ],
        {
          duration: dur,
          delay,
          easing: "cubic-bezier(.2,.75,.28,1)",
          fill: "backwards",
        },
      );

      // A bright pop as it lands.
      const flash = el.querySelector<HTMLElement>(".demo-card-flash");
      flash?.animate(
        [{ opacity: 0 }, { opacity: holo ? 1 : 0.75, offset: 0.18 }, { opacity: 0 }],
        { duration: holo ? 780 : 440, delay: delay + dur * 0.8, easing: "ease-out" },
      );
    });
  }, [phase, dealOrder, cards]);

  const openPack = () => {
    if (opening) return;
    setOpening(true);
    const at = (ms: number, fn: () => void) => {
      timers.current.push(window.setTimeout(fn, reduced() ? Math.min(ms, 60) : ms));
    };
    at(BURST_AT, () => setBurst((b) => b + 1));
    at(DEAL_AT, () => setPhase("open"));
  };

  // The closed pack leans toward the pointer.
  const onStageMove = (e: React.PointerEvent) => {
    const el = packRef.current;
    if (!el || opening) return;
    const r = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--tx", `${(-ny * 16).toFixed(2)}deg`);
    el.style.setProperty("--ty", `${(nx * 20).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${(50 + nx * 70).toFixed(1)}%`);
    el.style.setProperty("--gy", `${(50 + ny * 70).toFixed(1)}%`);
  };
  const onStageLeave = () => {
    const el = packRef.current;
    if (!el) return;
    el.style.setProperty("--tx", "0deg");
    el.style.setProperty("--ty", "0deg");
  };

  const again = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setOpening(false);
    setBurst(0);
    setView(null);
    setPhase("setup");
    setCards([]);
    setImages([]);
  };

  const label =
    consoleId === "all"
      ? t("All consoles")
      : (catalog.find((c) => c.id === consoleId)?.name ?? "");
  const holoCount = cards.filter((c) => c.holo).length;

  return (
    <div className="demo-backdrop">
      <button className="demo-close" title={t("Close")} onClick={onClose}>
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
          <h2 className="text-lg font-semibold">{t("Demo mode")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("Draw a booster pack of {n} random cards – from one console or from all of them.", { n: PACK_SIZE })}
          </p>
          <Select value={consoleId} onValueChange={setConsoleId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All consoles")}</SelectItem>
              {catalog.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => void start()}>
            <Sparkles /> {t("Draw pack")}
          </Button>
        </div>
      )}

      {phase === "loading" && (
        <div className="flex items-center gap-2 text-sm text-white/70">
          <Loader2 className="size-4 animate-spin" /> {t("Rendering cards …")}
        </div>
      )}

      {(phase === "pack" || phase === "open") && (
        <div
          className="demo-stage"
          onPointerMove={onStageMove}
          onPointerLeave={onStageLeave}
        >
          {burst > 0 && <Burst key={burst} onDone={() => setBurst(0)} />}

          {phase === "pack" && (
            <div className="demo-pack-wrap" ref={packRef}>
              <button
                className={opening ? "demo-pack opening" : "demo-pack"}
                onClick={openPack}
                title={t("Open pack")}
              >
                <span className="demo-pack-glow" />
                <span className="demo-pack-strip">
                  <span className="demo-pack-teeth" />
                </span>
                <span className="demo-pack-body">
                  <span className="demo-pack-holo" />
                  <span className="demo-pack-shine" />
                  <span className="demo-pack-emblem" />
                  <span className="demo-pack-label">{label}</span>
                  <span className="demo-pack-count">
                    {t(getFormat().name)} · {t("{n} cards", { n: cards.length })}
                  </span>
                </span>
                <span className="demo-pack-rip" />
              </button>
              {!opening && (
                <span className="demo-pack-cta">{t("Click to tear open")}</span>
              )}
            </div>
          )}

          <div
            ref={gridRef}
            className="demo-grid"
            style={{
              ...previewCssVars(),
              visibility: phase === "open" ? "visible" : "hidden",
            }}
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
                <span className="demo-card-sheen" />
                <span className="demo-card-flash" />
                {c.holo && <span className="demo-card-rare">{t("RARE")}</span>}
              </button>
            ))}
          </div>

          {phase === "open" && (
            <div className="demo-bar">
              <span className="text-xs text-muted-foreground">
                {label}
                {t(" · {n} cards", { n: cards.length })}
                {holoCount > 0 && t(" · ✨ 1 holographic")}
              </span>
              <Button variant="outline" size="sm" onClick={again}>
                <Sparkles /> {t("New pack")}
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

// ── the burst that blows out of the torn pack ──────────────────────────────
const CONFETTI = [
  "#ffd54a",
  "#ff5fa2",
  "#5ad1ff",
  "#8b5cf6",
  "#3ee68b",
  "#ffffff",
  "#ff8a3d",
];

function Burst({ onDone }: { onDone: () => void }) {
  // Random once, on mount — a state initialiser rather than a memo so the
  // randomness isn't part of render.
  const [bits] = useState(() => {
    const n = reduced() ? 0 : 42;
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const d = 130 + Math.random() * 330;
      return {
        dx: Math.cos(a) * d,
        dy: Math.sin(a) * d * 0.82 - 40,
        size: 4 + Math.random() * 9,
        spin: Math.random() * 900 - 450,
        color: CONFETTI[i % CONFETTI.length],
        delay: Math.random() * 170,
        dur: 950 + Math.random() * 750,
        round: i % 3 === 0,
      };
    });
  });
  const rays = useMemo(
    () => (reduced() ? [] : Array.from({ length: 14 }, (_, i) => (i / 14) * 360)),
    [],
  );

  useEffect(() => {
    const id = window.setTimeout(onDone, BURST_MS);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div className="demo-burst" aria-hidden>
      <span className="demo-burst-flash" />
      <span className="demo-burst-ring" />
      <span className="demo-burst-ring two" />
      {rays.map((a) => (
        <span
          key={a}
          className="demo-ray"
          style={{ ["--a" as string]: `${a}deg` }}
        />
      ))}
      {bits.map((b, i) => (
        <span
          key={i}
          className={b.round ? "demo-particle round" : "demo-particle"}
          style={{
            ["--dx" as string]: `${b.dx}px`,
            ["--dy" as string]: `${b.dy}px`,
            ["--r" as string]: `${b.spin}deg`,
            ["--c" as string]: b.color,
            ["--s" as string]: `${b.size}px`,
            animationDelay: `${b.delay}ms`,
            animationDuration: `${b.dur}ms`,
          }}
        />
      ))}
    </div>
  );
}

// ── single-card viewer ─────────────────────────────────────────────────────
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
  const t = useT();
  const [holo, setHolo] = useState(card.holo);
  const ref = useRef<Card3DHandle>(null);

  useEffect(() => {
    setHolo(card.holo);
    ref.current?.reset();
  }, [card.key, card.holo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = ref.current;
      if (!c) return;
      if (e.key === "f" || e.key === "F") c.flip();
      else if (e.key === "r" || e.key === "R") c.reset();
      else if (e.key === "+" || e.key === "=") c.zoomBy(1.15);
      else if (e.key === "-" || e.key === "_") c.zoomBy(1 / 1.15);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="preview3d-backdrop" onPointerDown={onClose}>
      <button
        className="demo-nav left"
        onPointerDown={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        title={t("Previous card")}
      >
        <ChevronLeft />
      </button>
      <button
        className="demo-nav right"
        onPointerDown={(e) => {
          e.stopPropagation();
          onNext();
        }}
        title={t("Next card")}
      >
        <ChevronRight />
      </button>

      <div onPointerDown={(e) => e.stopPropagation()}>
        <Card3D
          key={card.key}
          ref={ref}
          front={image}
          holo={holo}
          placeholder={card.gameTitle}
        />
      </div>

      <div className="preview3d-bar" onPointerDown={(e) => e.stopPropagation()}>
        <span className="text-xs text-muted-foreground">
          {index + 1} / {total} · {card.gameTitle}
        </span>
        <span className="preview3d-sep" />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={holo} onCheckedChange={(v) => setHolo(!!v)} />
          {t("Holographic")}
        </label>
        <span className="preview3d-sep" />
        <Button
          variant="outline"
          size="icon"
          title={t("Zoom out")}
          onClick={() => ref.current?.zoomBy(1 / 1.2)}
        >
          <ZoomOut />
        </Button>
        <Button
          variant="outline"
          size="icon"
          title={t("Zoom in")}
          onClick={() => ref.current?.zoomBy(1.2)}
        >
          <ZoomIn />
        </Button>
        <Button
          variant="outline"
          size="icon"
          title={t("Flip")}
          onClick={() => ref.current?.flip()}
        >
          <FlipHorizontal2 />
        </Button>
        <Button
          variant="outline"
          size="icon"
          title={t("Reset")}
          onClick={() => ref.current?.reset()}
        >
          <RotateCcw />
        </Button>
        <Button variant="outline" size="sm" onClick={onClose}>
          <X /> {t("Close viewer")}
        </Button>
      </div>

      <p className="preview3d-hint" onPointerDown={(e) => e.stopPropagation()}>
        {t("Drag to rotate · flick to spin · wheel to zoom · ← → for the next card")}
      </p>
    </div>
  );
}
