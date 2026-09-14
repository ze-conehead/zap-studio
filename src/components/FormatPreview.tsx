import type { CardFormat } from "../formats";
import { useT } from "../i18n";

// A to-scale outline of a sticker format: its aspect ratio, corner rounding
// and — for the wraps / J-card — the fold lines between panels. Shown in the
// new-project dialog so the format dropdown isn't a guess. Takes the format
// itself (not an id) so a not-yet-saved custom size can be previewed live.

const BOX_W = 260;
const BOX_H = 150;
const PAD = 14;

export function FormatPreview({ format: f }: { format: CardFormat }) {
  const t = useT();
  const { w, h } = f.trimMM;

  const scale = Math.min((BOX_W - PAD * 2) / w, (BOX_H - PAD * 2) / h);
  const rw = w * scale;
  const rh = h * scale;
  const x = (BOX_W - rw) / 2;
  const y = (BOX_H - rh) / 2;
  const r = Math.min(f.cornerRadiusMM * scale, rw / 2, rh / 2);

  const panels = f.panels ?? [];
  // x of every panel boundary, left edge to right edge (n+1 values for n
  // panels): starts[i] is panel i's left edge, running-summed.
  const starts = panels.reduce<number[]>(
    (a, p, i) => [...a, a[i] + p.wMM * scale],
    [x],
  );
  // Fold lines sit at the interior boundaries only.
  const folds = starts.slice(1, -1);
  // Panel labels, but only where the panel is wide enough to read.
  const labels = panels
    .map((p, i) => ({
      name: p.name,
      mid: starts[i] + (p.wMM * scale) / 2,
      room: p.wMM * scale > 34,
    }))
    .filter((l) => l.room);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg
        width={BOX_W}
        height={BOX_H}
        role="img"
        aria-label={t(f.name)}
        className="rounded-md border bg-muted/30"
      >
        <rect
          x={x}
          y={y}
          width={rw}
          height={rh}
          rx={r}
          ry={r}
          fill="var(--card)"
          stroke="var(--primary)"
          strokeWidth={2}
        />
        {folds.map((fx, i) => (
          <line
            key={i}
            x1={fx}
            y1={y}
            x2={fx}
            y2={y + rh}
            stroke="var(--primary)"
            strokeOpacity={0.45}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        ))}
        {labels.map((l, i) => (
          <text
            key={i}
            x={l.mid}
            y={y + rh / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--muted-foreground)"
            fontSize={9}
          >
            {t(l.name)}
          </text>
        ))}
      </svg>
      <span className="text-[11px] tabular-nums text-muted-foreground">
        {t("{w} × {h} mm", { w: Math.round(w), h: Math.round(h) })}
        {f.hasBack && ` · ${t("front & back")}`}
        {panels.length > 0 && ` · ${t("{n} panels", { n: panels.length })}`}
      </span>
    </div>
  );
}
