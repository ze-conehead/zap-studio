import { cn } from "@/lib/utils";
import { useT } from "../i18n";
import { LOGO_BG_MODES, setLogoBgMode, useLogoBgMode, type LogoBgMode } from "../logoBackdrop";

// What the logo tiles sit on: the card's background (the default), plain
// black or white, or the transparency checkerboard. One choice for every
// logo view (search, picker, Manage logos), remembered.
export function LogoBgToggle({ className }: { className?: string }) {
  const t = useT();
  const mode = useLogoBgMode();
  const label: Record<LogoBgMode, string> = {
    card: t("Card background"),
    black: t("Black"),
    white: t("White"),
    transparent: t("Transparent"),
  };
  const swatch: Record<LogoBgMode, string> = {
    card: "linear-gradient(135deg, #334155 0 50%, #64748b 50% 100%)",
    black: "#000000",
    white: "#ffffff",
    transparent:
      "repeating-conic-gradient(#9ca3af 0% 25%, #e5e7eb 0% 50%) 50% / 8px 8px",
  };
  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-xs", className)}>
      <span className="text-muted-foreground">{t("Preview on")}</span>
      <div role="radiogroup" aria-label={t("Preview on")} className="flex gap-1 rounded-md border p-0.5">
        {LOGO_BG_MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            title={
              m === "card"
                ? t("The card's own background — or, with none, light for dark logos and dark for light ones")
                : label[m]
            }
            onClick={() => setLogoBgMode(m)}
            className={cn(
              "flex items-center gap-1.5 rounded px-2 py-1",
              mode === m ? "bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            <span
              aria-hidden
              className="size-3 rounded-sm border border-black/30"
              style={{ background: swatch[m] }}
            />
            {label[m]}
          </button>
        ))}
      </div>
    </div>
  );
}
