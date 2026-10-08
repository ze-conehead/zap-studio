import { Button } from "@/components/ui/button";
import { isAccent, useCardAccent } from "../../accent";
import { useT } from "../../i18n";
import { useStore } from "../../store";
import type { Layer } from "../../types";
import { ColorField, Panel } from "./fields";

// The open design's accent colour (src/accent.ts): automatic — the dominant
// colour of its cover — or fixed by hand. On a template it is only the
// stand-in colour to design with, since a template has no cover of its own.
export function AccentPanel({ masks, inherited }: { masks: Layer[]; inherited?: string }) {
  const t = useT();
  const { state, dispatch } = useStore();
  const { project } = state;
  const color = useCardAccent(project, masks, inherited);
  const fixed = project.accent;
  const set = (accent?: string) =>
    dispatch({ type: "SET_ACCENT", accent: accent && !isAccent(accent) ? accent : undefined });

  return (
    <Panel title={project.isTemplate ? t("Accent preview color") : t("Accent color")}>
      <p className="text-xs text-muted-foreground">
        {project.isTemplate
          ? t("Color fields set to “A” paint each card's accent — the main color of its cover. Here, with no cover, they show this color instead.")
          : t("Color fields set to “A” paint this color. Automatic takes the console template's fixed color, else the global one's, else the main color of this card's cover.")}
      </p>
      <div className="flex items-center gap-2 text-sm">
        <span className="size-5 shrink-0 rounded border border-black/20" style={{ background: color }} />
        <span className="flex-1 truncate">
          {fixed
            ? t("Fixed")
            : inherited
              ? t("Automatic (from the template)")
              : project.isTemplate
                ? t("Default")
                : t("Automatic (from the cover)")}
        </span>
        {fixed ? (
          <Button variant="outline" size="sm" className="h-7" onClick={() => set(undefined)}>
            {t("Automatic")}
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-7" onClick={() => set(color)}>
            {t("Choose a color")}
          </Button>
        )}
      </div>
      {fixed && <ColorField label={t("Color")} value={fixed} onChange={set} />}
    </Panel>
  );
}
