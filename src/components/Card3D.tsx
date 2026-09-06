// The 3D card: a physical-feeling, draggable card with inertia, idle sway,
// zoom, a ground shadow that tracks the tilt, tilt-reactive lighting and a
// layered holographic finish. Shared by the editor's 3D preview and the demo
// pack's card viewer, so both look and feel identical.

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactNode,
  type Ref,
} from "react";
import { previewCssVars } from "../formats";

const START = { x: -12, y: -18 };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const reduced = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface Card3DHandle {
  reset: () => void;
  flip: () => void;
  zoomBy: (factor: number) => void;
  spin: (deg: number) => void;
}

interface Rot {
  x: number;
  y: number;
}

interface Tween {
  from: Rot & { z: number };
  to: Rot & { z: number };
  t0: number;
  dur: number;
}

export function Card3D({
  ref,
  front,
  back,
  holo = false,
  placeholder,
}: {
  ref?: Ref<Card3DHandle>;
  front?: string | null;
  back?: string | null;
  holo?: boolean;
  placeholder?: ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);

  const rot = useRef({ ...START });
  const vel = useRef({ x: 0, y: 0 });
  const zoom = useRef(1);
  const zoomTo = useRef(1);
  const idle = useRef(0);
  const tween = useRef<Tween | null>(null);
  const dragging = useRef(false);
  const drag = useRef<{
    px: number;
    py: number;
    rx: number;
    ry: number;
    t: number;
  } | null>(null);
  const pinch = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchBase = useRef<{ dist: number; zoom: number } | null>(null);

  // Every frame writes straight to the DOM — no React re-render at 60 fps.
  const paint = useCallback((now: number) => {
    const el = cardRef.current;
    if (!el) return;
    const s = idle.current;
    const swayY = Math.sin(now / 1550) * 6.5 * s;
    const swayX = Math.sin(now / 2100 + 1.1) * 3.2 * s;
    const rx = clamp(rot.current.x + swayX, -85, 85);
    const ry = rot.current.y + swayY;
    const z = zoom.current;

    el.style.transform = `scale(${z.toFixed(3)}) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;

    // Where the light lands, in card space. `ry` wraps, so fold it first.
    const fold = ((((ry + 180) % 360) + 360) % 360) - 180;
    const face = Math.abs(fold) > 90; // looking at the back
    const lx = clamp(50 - fold * 0.62, -25, 125);
    const ly = clamp(50 + rx * 0.85, -25, 125);
    const tilt = clamp(
      (Math.abs(fold) / 60 + Math.abs(rx) / 55) / 2,
      0,
      1.4,
    );

    el.style.setProperty("--px", `${lx}%`);
    el.style.setProperty("--py", `${ly}%`);
    el.style.setProperty("--tilt", tilt.toFixed(3));
    el.style.setProperty("--foil-pos", `${50 + fold * 1.5}% ${50 + rx * 1.6}%`);
    el.style.setProperty("--foil-angle", `${112 + fold * 0.55}deg`);
    el.style.setProperty("--prism", `${fold * 2.4}deg`);
    el.style.setProperty("--sheen", (0.1 + tilt * 0.5).toFixed(3));
    el.style.setProperty("--edge-l", face ? "0.6" : "1");

    const sh = shadowRef.current;
    if (sh) {
      sh.style.transform =
        `translate(-50%, -50%) translate(${(-fold * 0.9).toFixed(1)}px, ${(18 + Math.abs(rx) * 0.35).toFixed(1)}px)` +
        ` scale(${(z * (1 - Math.abs(fold) / 260)).toFixed(3)}, ${(z * (0.16 + (1 - Math.abs(rx) / 90) * 0.1)).toFixed(3)})`;
      sh.style.opacity = String(clamp(0.55 - Math.abs(rx) / 220, 0.12, 0.6));
    }
  }, []);

  // Physics: tween → inertia → idle sway, in that order of priority.
  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const soft = reduced();
    const tick = (now: number) => {
      const dt = Math.min(4, Math.max(0.2, (now - prev) / 16.667));
      prev = now;

      const tw = tween.current;
      if (tw) {
        const p = clamp((now - tw.t0) / tw.dur, 0, 1);
        const e = 1 - Math.pow(1 - p, 3); // easeOutCubic — no overshoot
        rot.current.x = tw.from.x + (tw.to.x - tw.from.x) * e;
        rot.current.y = tw.from.y + (tw.to.y - tw.from.y) * e;
        zoom.current = tw.from.z + (tw.to.z - tw.from.z) * e;
        zoomTo.current = zoom.current;
        vel.current.x = 0;
        vel.current.y = 0;
        idle.current = 0;
        if (p >= 1) tween.current = null;
      } else if (dragging.current) {
        idle.current = Math.max(0, idle.current - 0.09 * dt);
      } else {
        rot.current.x = clamp(rot.current.x + vel.current.x * dt, -85, 85);
        rot.current.y += vel.current.y * dt;
        const damp = Math.pow(0.935, dt);
        vel.current.x *= damp;
        vel.current.y *= damp;
        if (Math.abs(vel.current.x) < 0.012) vel.current.x = 0;
        if (Math.abs(vel.current.y) < 0.012) vel.current.y = 0;
        const still = !vel.current.x && !vel.current.y;
        idle.current = clamp(
          idle.current + (still && !soft ? 0.01 : -0.07) * dt,
          0,
          1,
        );
      }

      // Zoom always eases toward its target.
      zoom.current += (zoomTo.current - zoom.current) * Math.min(1, 0.18 * dt);

      paint(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paint]);

  const tweenTo = useCallback((to: Rot & { z: number }, dur = 620) => {
    tween.current = {
      from: { ...rot.current, z: zoom.current },
      to,
      t0: performance.now(),
      dur: reduced() ? 1 : dur,
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      reset: () => tweenTo({ ...START, z: 1 }),
      flip: () => {
        // Snap to the nearest clean face, then add half a turn.
        const half = Math.round(rot.current.y / 180) * 180;
        tweenTo({ x: 0, y: half + 180, z: zoom.current }, 760);
      },
      spin: (deg) =>
        tweenTo({ x: rot.current.x, y: rot.current.y + deg, z: zoom.current }, 520),
      zoomBy: (f) => {
        zoomTo.current = clamp(zoomTo.current * f, 0.5, 2.6);
      },
    }),
    [tweenTo],
  );

  // ── pointer ──────────────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current.size === 2) {
      const [a, b] = [...pinch.current.values()];
      pinchBase.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: zoomTo.current,
      };
      dragging.current = false;
      drag.current = null;
      cardRef.current?.classList.remove("dragging");
      return;
    }
    tween.current = null;
    dragging.current = true;
    vel.current = { x: 0, y: 0 };
    drag.current = {
      px: e.clientX,
      py: e.clientY,
      rx: rot.current.x,
      ry: rot.current.y,
      t: performance.now(),
    };
    cardRef.current?.classList.add("dragging");
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pinch.current.has(e.pointerId)) {
      pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    const base = pinchBase.current;
    if (base && pinch.current.size === 2) {
      const [a, b] = [...pinch.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomTo.current = clamp((d / base.dist) * base.zoom, 0.5, 2.6);
      return;
    }
    const d = drag.current;
    if (!d || !dragging.current) return;
    const now = performance.now();
    const nx = clamp(d.rx - (e.clientY - d.py) * 0.34, -85, 85);
    const ny = d.ry + (e.clientX - d.px) * 0.34;
    const dt = Math.max(8, now - d.t);
    // Velocity in deg-per-frame, so the inertia integrator can use it as-is.
    vel.current = {
      x: clamp(((nx - rot.current.x) / dt) * 16.667, -14, 14),
      y: clamp(((ny - rot.current.y) / dt) * 16.667, -22, 22),
    };
    rot.current.x = nx;
    rot.current.y = ny;
    d.t = now;
  };

  const endPointer = (e: React.PointerEvent) => {
    pinch.current.delete(e.pointerId);
    if (pinch.current.size < 2) pinchBase.current = null;
    if (pinch.current.size === 0) {
      dragging.current = false;
      drag.current = null;
      cardRef.current?.classList.remove("dragging");
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    zoomTo.current = clamp(zoomTo.current * (1 - e.deltaY * 0.0014), 0.5, 2.6);
  };

  const faces = (
    <>
      <div className="face front">
        {front ? (
          <img src={front} alt="" draggable={false} />
        ) : (
          <div className="preview3d-placeholder">{placeholder}</div>
        )}
        <div className="ink" />
        <div className="foil" />
        <div className="prism" />
        <div className="sparkle" />
        <div className="sheen" />
        <div className="glare" />
        <div className="rim" />
      </div>
      <div className={back ? "face back" : "face back plain"}>
        {back ? (
          <img src={back} alt="" draggable={false} />
        ) : (
          <span className="back-art" />
        )}
        <div className="sheen" />
        <div className="rim" />
      </div>
    </>
  );

  return (
    <div className="card3d-stage">
      <div className="card3d-shadow" ref={shadowRef} />
      <div
        ref={cardRef}
        className={holo ? "card3d holo" : "card3d"}
        style={{
          ...previewCssVars(),
          ["--holo" as string]: holo ? 1 : 0,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={onWheel}
      >
        {faces}
        <div className="edge edge-l" />
        <div className="edge edge-r" />
        <div className="edge edge-t" />
        <div className="edge edge-b" />
      </div>
    </div>
  );
}
