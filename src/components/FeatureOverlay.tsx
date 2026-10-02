import { useId } from "react";
import type { FormatFeature } from "../formats";

// A format's holes and edges (see FormatFeature) as SVG, in mm so they sit
// exactly where they will on the real thing. Stretches to its box, which
// must match the trim's aspect for the circles to stay round — the 3D face
// and the new-project preview both do.
export function FeatureOverlay({
  features,
  trimMM,
  className,
  ...box
}: {
  features: FormatFeature[];
  trimMM: { w: number; h: number };
  className?: string;
  x?: number;
  y?: number;
  width?: number | string;
  height?: number | string;
}) {
  const { w, h } = trimMM;
  const id = useId();
  return (
    <svg
      className={className}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
      {...box}
    >
      <defs>
        {features.map((f, i) => {
          if (f.kind !== "edge") return null;
          const v = {
            top: [0, 0, 0, 1],
            bottom: [0, 1, 0, 0],
            left: [0, 0, 1, 0],
            right: [1, 0, 0, 0],
          }[f.side];
          return (
            <linearGradient key={i} id={`${id}-edge-${i}`} x1={v[0]} y1={v[1]} x2={v[2]} y2={v[3]}>
              <stop offset="0" stopColor="#000" stopOpacity="0.6" />
              <stop offset="1" stopColor="#000" stopOpacity="0" />
            </linearGradient>
          );
        })}
      </defs>
      {features.map((f, i) => {
        if (f.kind === "hole") {
          return (
            <g key={i}>
              <circle cx={f.xMM} cy={f.yMM} r={f.rMM} fill="#0a0a0f" />
              <circle
                cx={f.xMM}
                cy={f.yMM}
                r={f.rMM}
                fill="none"
                stroke="#fff"
                strokeOpacity="0.4"
                strokeWidth="0.35"
              />
              <circle
                cx={f.xMM}
                cy={f.yMM}
                r={f.rMM * 0.55}
                fill="none"
                stroke="#fff"
                strokeOpacity="0.18"
                strokeWidth="0.3"
              />
            </g>
          );
        }
        const horiz = f.side === "top" || f.side === "bottom";
        const d = f.side === "top" || f.side === "left" ? 1 : -1; // towards the label's middle
        const x = f.side === "right" ? w - f.sizeMM : 0;
        const y = f.side === "bottom" ? h - f.sizeMM : 0;
        const rw = horiz ? w : f.sizeMM;
        const rh = horiz ? f.sizeMM : h;
        // The lip's inner edge: a dark line with a highlight just inside it.
        const lx1 = f.side === "right" ? w - f.sizeMM : f.side === "left" ? f.sizeMM : 0;
        const lx2 = horiz ? w : lx1;
        const ly1 = f.side === "bottom" ? h - f.sizeMM : f.side === "top" ? f.sizeMM : 0;
        const ly2 = horiz ? ly1 : h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={rw} height={rh} fill={`url(#${id}-edge-${i})`} />
            <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke="#000" strokeOpacity="0.6" strokeWidth="0.4" />
            <line
              x1={horiz ? lx1 : lx1 + d * 0.4}
              y1={horiz ? ly1 + d * 0.4 : ly1}
              x2={horiz ? lx2 : lx2 + d * 0.4}
              y2={horiz ? ly2 + d * 0.4 : ly2}
              stroke="#fff"
              strokeOpacity="0.4"
              strokeWidth="0.3"
            />
          </g>
        );
      })}
    </svg>
  );
}
