// Every keyboard shortcut in one place. The bindings themselves live where
// they act (App.tsx for view-level ones, store.tsx for the layer ones,
// CardPreview.tsx for the 3D preview) — this is just the reference card.

import { useT } from "../i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

// ⌘ on a Mac, Ctrl everywhere else — the handlers accept either.
const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();

  const groups: { title: string; rows: [string, string][] }[] = [
    {
      title: t("Editor"),
      rows: [
        [`${MOD} N`, t("New card")],
        [`${MOD} F`, t("Search consoles & games")],
        [`${MOD} Z`, t("Undo")],
        [`${MOD} ⇧ Z  /  ${MOD} Y`, t("Redo")],
        ["B", t("Show / hide bleed")],
        ["G", t("Show / hide guides")],
        ["P", t("Open the 3D preview")],
        ["?", t("This overview")],
      ],
    },
    {
      title: t("Selected layer"),
      rows: [
        [`${MOD} D`, t("Duplicate")],
        [`${MOD} ⇧ H`, t("Hide / show")],
        [`${MOD} ⇧ L`, t("Lock / unlock")],
        [`${MOD} ⌥ C  /  ${MOD} ⌥ V`, t("Copy / paste style")],
        [`${MOD} ]  /  ${MOD} [`, t("Move up / down in the stack")],
        ["← ↑ → ↓", t("Nudge by 1 px (⇧: 10 px)")],
        [t("Delete") + " / ⌫", t("Delete layer")],
        ["Esc", t("Deselect")],
      ],
    },
    {
      title: t("3D preview"),
      rows: [
        ["←  /  →", t("Spin by 45°")],
        ["F", t("Flip to the back")],
        ["R", t("Reset the view")],
        ["+  /  −", t("Zoom in / out")],
        ["[  /  ]", t("Previous / next card")],
        ["Esc", t("Close")],
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4">
        <DialogHeader>
          <DialogTitle>{t("Keyboard shortcuts")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <section key={g.title}>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {g.title}
              </h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {g.rows.map(([keys, what]) => (
                  <div key={keys} className="contents">
                    <dt className="whitespace-nowrap font-mono text-xs leading-6 text-foreground">
                      <kbd className="rounded border bg-muted px-1.5 py-0.5">{keys}</kbd>
                    </dt>
                    <dd className="leading-6 text-muted-foreground">{what}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
