import { Button } from "@/components/ui/button";
import { isAccent, useCardAccent } from "../../accent";
import { useT } from "../../i18n";
import { useStore } from "../../store";
import type { Layer } from "../../types";
import { ColorField, Panel } from "./fields";

// The open design's accent colour (src/accent.ts). Global template: automatic
// (the cover's dominant colour) or a fixed colour. Console template and card:
// "P" — take the parent's colour (card → console → global; with no fixed
// colour above, the cover's) — or override it with a colour of their own. On
// a template the colour is also the stand-in to design with, since a template
// has no cover of its own.
export function AccentPanel({ masks, inherited }: { masks: Layer[]; inherited?: string }) {
  const t = useT();
  const { state, dispatch } = useStore();
  const { project } = state;
  const color = useCardAccent(project, masks, inherited);
  const fixed = project.accent;
  const hasParent = !project.isGlobalTemplate;
  const set = (accent?: string) =>
    dispatch({ type: "SET_ACCENT", accent: accent && !isAccent(accent) ? accent : undefined });

  const status = fixed
    ? hasParent ? t("Overridden") : t("Fixed")
    : !hasParent
      ? project.isTemplate ? t("Default") : t("Automatic (from the cover)")
      : inherited
        ? t("Parent (from the template above)")
        : project.isTemplate
          ? t("Parent (no fixed color above)")
          : t("Parent (from the cover)");

  return (
    <Panel title={project.isTemplate ? t("Accent preview color") : t("Accent color")}>
      <p className="text-xs text-muted-foreground">
        {project.isGlobalTemplate
          ? t("Color fields set to “A” paint each card's accent — the main color of its cover, or the color set here. Pick a color to fix it for every card that doesn't override it.")
          : project.isTemplate
            ? t("Color fields set to “A” paint each card's accent. “P” takes the color of the template above (global); an override applies to all cards of this console that stay on “P”.")
            : t("Color fields set to “A” paint this color. “P” takes the console's color — or the global one if the console is on “P” too, or the cover's main color if none is fixed. Or override it here.")}
      </p>
      <div className="flex items-center gap-2 text-sm">
        {hasParent && (
          <span
            title={t("Parent")}
            className={
              "grid size-5 shrink-0 place-items-center rounded border text-[10px] font-bold " +
              (fixed ? "border-transparent text-muted-foreground/50" : "border-primary bg-primary text-primary-foreground")
            }
          >
            P
          </span>
        )}
        <span className="size-5 shrink-0 rounded border border-black/20" style={{ background: color }} />
        <span className="flex-1 truncate">{status}</span>
        {fixed ? (
          <Button variant="outline" size="sm" className="h-7" onClick={() => set(undefined)}>
            {hasParent ? t("Use parent (P)") : t("Automatic")}
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-7" onClick={() => set(color)}>
            {hasParent ? t("Override") : t("Choose a color")}
          </Button>
        )}
      </div>
      {fixed && <ColorField label={t("Color")} value={fixed} onChange={set} />}
    </Panel>
  );
}
