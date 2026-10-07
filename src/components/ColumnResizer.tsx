import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useT } from "../i18n";

// Drag-to-resize side columns. The width lives in localStorage so a reload
// keeps it; double-click on the handle (or Home) restores the default.

// The centre column never gets squeezed below this.
const MIN_CENTER = 360;

function read(key: string): number | null {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export interface ColumnWidth {
  width: number;
  setWidth: (w: number) => void;
  reset: () => void;
  defaultWidth: number;
  min: number;
}

/** A side column's width: stored, clamped to [min, max], with a default. */
export function useColumnWidth(key: string, defaultWidth: number, min: number): ColumnWidth {
  const [width, set] = useState(() => read(key) ?? defaultWidth);
  const setWidth = useCallback(
    (w: number) => {
      const next = Math.max(min, Math.round(w));
      set(next);
      try {
        localStorage.setItem(key, String(next));
      } catch {
        /* storage unavailable — the width just isn't remembered */
      }
    },
    [key, min],
  );
  const reset = useCallback(() => {
    set(defaultWidth);
    try {
      localStorage.removeItem(key);
    } catch {
      /* nothing to remove */
    }
  }, [key, defaultWidth]);
  return { width, setWidth, reset, defaultWidth, min };
}

/**
 * The strip between two columns. `side` is which column it resizes: "left"
 * grows it when dragged right, "right" grows it when dragged left.
 * `otherWidth` is the opposite side column, so the centre keeps MIN_CENTER.
 */
export function ColumnResizer({
  side,
  col,
  otherWidth,
}: {
  side: "left" | "right";
  col: ColumnWidth;
  otherWidth: number;
}) {
  const t = useT();
  const drag = useRef<{ x: number; w: number } | null>(null);
  const [active, setActive] = useState(false);
  const dir = side === "left" ? 1 : -1;

  const max = () => Math.max(col.min, window.innerWidth - otherWidth - MIN_CENTER);
  const clamp = (w: number) => Math.min(max(), Math.max(col.min, w));

  // A window that shrinks under a wide column pulls the column in with it.
  useEffect(() => {
    const fit = () => {
      if (col.width > max()) col.setWidth(clamp(col.width));
    };
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [col.width, otherWidth]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={side === "left" ? t("Resize the left column") : t("Resize the right column")}
      aria-valuenow={col.width}
      aria-valuemin={col.min}
      tabIndex={0}
      title={t("Drag to resize — double-click to reset")}
      className={cn(
        "group relative z-10 -mx-[3px] w-[7px] shrink-0 cursor-col-resize touch-none select-none outline-none",
        active && "bg-primary/25",
      )}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, w: col.width };
        setActive(true);
        document.body.classList.add("select-none");
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (d) col.setWidth(clamp(d.w + (e.clientX - d.x) * dir));
      }}
      onPointerUp={() => {
        drag.current = null;
        setActive(false);
        document.body.classList.remove("select-none");
      }}
      onPointerCancel={() => {
        drag.current = null;
        setActive(false);
        document.body.classList.remove("select-none");
      }}
      onDoubleClick={col.reset}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 48 : 12;
        if (e.key === "ArrowLeft") col.setWidth(clamp(col.width - step * dir));
        else if (e.key === "ArrowRight") col.setWidth(clamp(col.width + step * dir));
        else if (e.key === "Home") col.reset();
        else return;
        e.preventDefault();
      }}
    >
      {/* the visible hairline: thin at rest, accent while hovered / dragged */}
      <div
        className={cn(
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-primary group-focus-visible:bg-primary",
          active && "bg-primary",
        )}
      />
    </div>
  );
}
