// Template viewer: the saved card looks, each with a preview of what a blank
// card becomes under it. Templates can be saved from the current workspace,
// imported and exported as JSON, and applied over the workspace's own.

import type Konva from "konva";
import {
  Check,
  Download,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TRIM_RECT } from "../card";
import { getCatalog } from "../data/catalog";
import type { DemoCard } from "../demo";
import { packImageSources } from "../demo";
import { downloadBlob } from "../export";
import {
  GLOBAL_TEMPLATE_ID,
  isBackground,
  isShape,
  newProject,
  templateId,
} from "../factory";
import { ensureFontsLoaded } from "../fonts";
import { previewCssVars } from "../formats";
import { preloadImage } from "../hooks/useImage";
import { loadProject } from "../persist";
import { useT } from "../i18n";
import { askConfirm } from "./ConfirmDialog";
import { alphaMasksOf } from "../templates";
import {
  applyBundle,
  buildBundle,
  bundleFileName,
  deleteBundle,
  listBundles,
  parseBundle,
  saveBundle,
  serializeBundle,
  type TemplateBundle,
} from "../templateBundle";
import type { Layer, Project } from "../types";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { captureTrim, CardStage } from "./CardStage";

const PREVIEW_W = 300;

const bgFill = (p?: Project) => {
  const bg = p?.layers.find(isBackground);
  return bg?.visible ? bg.fill : undefined;
};
const overlayable = (p?: Project): Layer[] =>
  (p?.layers ?? []).filter((l) => !l.alphaMask && !l.logoSlot && !isBackground(l));

// The frames a template defines carry no pixels of their own, so a blank card
// would render as an empty rectangle. Stand a flat grey plate in each frame
// instead, so the preview shows where images and the logo will land.
const placeholders = (p?: Project): Layer[] => {
  const out: Layer[] = [];
  for (const l of p?.layers ?? []) {
    if (!(l.alphaMask || l.logoSlot) || !l.visible || !isShape(l)) continue;
    out.push({
      ...l,
      id: `__ph__${l.id}`,
      alphaMask: false,
      logoSlot: false,
      main: false,
      opacity: 0.55,
      fill: { kind: "solid", color: "#8b9099", color2: "#8b9099", angle: 90, noise: 0 },
    });
  }
  return out;
};

/** A blank card under `global` + `consoleP`, ready for <CardStage>. */
function sampleCard(
  global: Project | undefined,
  consoleP: Project | undefined,
  gameTitle: string,
  consoleName: string,
): DemoCard {
  const blank = newProject(gameTitle);
  return {
    key: "preview",
    consoleName,
    gameTitle,
    project: {
      ...blank,
      layers: [...blank.layers, ...placeholders(global), ...placeholders(consoleP)],
    },
    overlay: [...overlayable(consoleP), ...overlayable(global)],
    consoleBg: bgFill(consoleP),
    globalBg: bgFill(global),
    masks: [...alphaMasksOf(global), ...alphaMasksOf(consoleP)],
    holo: false,
  };
}

export function TemplateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [bundles, setBundles] = useState<TemplateBundle[]>([]);
  const [busy, setBusy] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState<DemoCard | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const draft = useRef<{ name: string } | null>(null);

  const refresh = useCallback(() => {
    void listBundles().then(setBundles);
  }, []);

  useEffect(() => {
    if (!open) return;
    setName("");
    setBusy("");
    refresh();
  }, [open, refresh]);

  // Save the current templates: render a sample card off-screen first so the
  // bundle carries a preview of what it actually looks like.
  const startSave = async () => {
    const label = name.trim();
    if (!label) return;
    setBusy(t("Rendering preview …"));
    const global = await loadProject(GLOBAL_TEMPLATE_ID);
    const firstConsole = getCatalog()[0];
    const consoleP = firstConsole
      ? await loadProject(templateId(firstConsole.id))
      : undefined;
    const card = sampleCard(
      global,
      consoleP,
      firstConsole?.games[0]?.title ?? label,
      firstConsole?.name ?? "",
    );
    await ensureFontsLoaded();
    await Promise.all(packImageSources([card]).map(preloadImage));
    draft.current = { name: label };
    setPending(card);
  };

  // Two frames after the hidden stage mounts, grab it and store the bundle.
  useEffect(() => {
    if (!pending || !draft.current) return;
    let alive = true;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!alive) return;
        void (async () => {
          const preview = stageRef.current
            ? captureTrim(stageRef.current, PREVIEW_W)
            : undefined;
          await saveBundle(await buildBundle({ name: draft.current!.name, preview }));
          draft.current = null;
          setPending(null);
          setName("");
          setBusy("");
          refresh();
        })();
      }),
    );
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, [pending, refresh]);

  const importJson = async (file: File) => {
    try {
      setBusy(t("Reading …"));
      const b = parseBundle(await file.text());
      await saveBundle(b);
      refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const apply = async (b: TemplateBundle) => {
    if (
      !(await askConfirm({
        title: t("Apply “{name}”?", { name: b.name }),
        body: t(
          "It replaces the global template and {n} console template(s). Your cards keep their own layers.",
          { n: b.consoles.length },
        ),
        confirmLabel: t("Apply"),
      }))
    ) {
      return;
    }
    setBusy(t("Applying …"));
    await applyBundle(b);
    location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] w-screen max-h-none max-w-none flex-col gap-3 rounded-none border-0">
        <DialogHeader>
          <DialogTitle>{t("Templates")}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          {t(
            "A template is the whole shared look: the “All consoles” layers plus every console template. Applying one leaves your cards' own layers alone.",
          )}
        </p>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-56 flex-1 flex-col gap-1.5">
            <Label>{t("Save the current templates as …")}</Label>
            <div className="flex gap-1.5">
              <Input
                value={name}
                placeholder={t("Name, e.g. “Neon arcade”")}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void startSave()}
              />
              <Button disabled={!name.trim() || !!busy} onClick={() => void startSave()}>
                {busy ? <Loader2 className="animate-spin" /> : <Check />}
                {t("Save")}
              </Button>
            </div>
          </div>
          <Button variant="outline" disabled={!!busy} onClick={() => fileRef.current?.click()}>
            <Upload /> {t("Import JSON …")}
          </Button>
        </div>

        {busy && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> {busy}
          </p>
        )}

        {/* Off-screen render target for the preview capture. */}
        {pending && (
          <div aria-hidden style={{ position: "fixed", left: -20000, top: 0, opacity: 0 }}>
            <CardStage
              card={pending}
              width={TRIM_RECT.w}
              stageRef={(s) => {
                stageRef.current = s;
              }}
            />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto" style={previewCssVars()}>
          {bundles.length === 0 ? (
            <p className="py-10 text-sm text-muted-foreground">
              {t("No templates yet. Save the current one above, or import a JSON file.")}
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
              {bundles.map((b) => (
                <div key={b.id} className="flex flex-col gap-1.5">
                  <div
                    className="overflow-hidden bg-muted ring-1 ring-border"
                    style={{
                      aspectRatio: "var(--aspect, 638 / 1011)",
                      borderRadius: "var(--radius-x, 5.889%) / var(--radius-y, 3.716%)",
                    }}
                  >
                    {b.preview ? (
                      <img
                        src={b.preview}
                        alt={b.name}
                        draggable={false}
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="grid size-full place-items-center text-xs text-muted-foreground">
                        {t("no preview")}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{b.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t("{n} console template(s)", { n: b.consoles.length })}
                      {b.global && ` · ${t("global")}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      className="h-7 flex-1"
                      disabled={!!busy}
                      onClick={() => void apply(b)}
                    >
                      {t("Apply")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      title={t("Export JSON")}
                      onClick={() =>
                        downloadBlob(
                          new Blob([serializeBundle(b)], { type: "application/json" }),
                          bundleFileName(b),
                        )
                      }
                    >
                      <Download />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7"
                      title={t("Delete")}
                      onClick={async () => {
                        const ok = await askConfirm({
                          title: t("Really delete “{name}”?", { name: b.name }),
                          confirmLabel: t("Delete"),
                          destructive: true,
                        });
                        if (ok) void deleteBundle(b.id).then(refresh);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={cn("flex justify-end border-t pt-3")}>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("Close")}
          </Button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importJson(f);
            e.target.value = "";
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
