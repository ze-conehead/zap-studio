import { AlertTriangle, Loader2, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { downloadBlob } from "../export";
import { FORMATS, getFormatId } from "../formats";
import { useT } from "../i18n";
import { saveProject } from "../persist";
import { useStore } from "../store";
import {
  buildPack,
  describeImport,
  importPack,
  listTemplates,
  readPack,
  type PackTemplate,
  type TemplatePack,
} from "../templatePack";
import { getWorkspace } from "../workspace";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

// Export the project's templates as a pack (src/templatePack.ts), or bring a
// pack's templates into this project — each one picked individually.
export function TemplatePackDialog({
  mode,
  file,
  onClose,
}: {
  mode: "export" | "import";
  file?: File; // import: the pack the user chose
  onClose: () => void;
}) {
  const t = useT();
  const { state } = useStore();
  const [items, setItems] = useState<PackTemplate[] | null>(null);
  const [pack, setPack] = useState<TemplatePack | null>(null);
  const [notes, setNotes] = useState<Record<number, { replaces: boolean; newConsole: boolean; name: string }>>({});
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (state.dirty) await saveProject(state.project);
        if (mode === "export") {
          const list = await listTemplates();
          if (!alive) return;
          setItems(list);
          setPicked(new Set(list.map((_, i) => i)));
        } else if (file) {
          const p = await readPack(file);
          const n: typeof notes = {};
          for (const [i, tpl] of p.templates.entries()) n[i] = await describeImport(tpl);
          if (!alive) return;
          setPack(p);
          setNotes(n);
          setItems(p.templates);
          setPicked(new Set(p.templates.map((_, i) => i)));
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, file]);

  const label = (p: PackTemplate) => (p.consoleId ? p.consoleName ?? p.consoleId : t("Global template"));
  const chosen = (items ?? []).filter((_, i) => picked.has(i));

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "export") {
        const blob = await buildPack(chosen);
        const name = getWorkspace().name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "templates";
        downloadBlob(blob, `${name} – ${t("templates")}.zip`);
        onClose();
      } else if (pack) {
        await importPack(pack, chosen);
        location.reload(); // templates, catalogue and fonts are read at load
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const formatMismatch = pack && pack.format !== getFormatId();

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="flex max-h-[80vh] max-w-md flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-4" />
            {mode === "export" ? t("Export templates") : t("Import templates")}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          {mode === "export"
            ? t("Saves the chosen templates — layers, pictures and the custom fonts they use — as one file, to reuse in another project or share. Cards are not included.")
            : t("Each chosen template replaces the one here (a snapshot of it is kept, see Edit ▸ Snapshots). Consoles you don't have yet are added. The page reloads afterwards.")}
        </p>

        {formatMismatch && (
          <p className="flex items-start gap-1.5 rounded-md bg-amber-500/10 p-2 text-xs text-amber-500">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            {t("This pack was made for “{a}”, this project is “{b}” — positions and sizes won't fit the new format exactly.", {
              a: t(FORMATS[pack.format]?.name ?? pack.format),
              b: t(FORMATS[getFormatId()].name),
            })}
          </p>
        )}

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !items ? (
          <Loader2 className="mx-auto my-4 size-4 animate-spin text-muted-foreground" />
        ) : items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("No templates yet.")}</p>
        ) : (
          <div className="-mx-1 flex min-h-0 flex-col gap-0.5 overflow-y-auto px-1">
            {items.map((p, i) => (
              <label key={i} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent">
                <Checkbox
                  checked={picked.has(i)}
                  onCheckedChange={(v) =>
                    setPicked((s) => {
                      const n = new Set(s);
                      if (v) n.add(i);
                      else n.delete(i);
                      return n;
                    })
                  }
                />
                <span className="flex-1 truncate">{label(p)}</span>
                <span className="text-[11px] text-muted-foreground">
                  {mode === "import" && notes[i]
                    ? notes[i].newConsole
                      ? t("new console")
                      : notes[i].replaces
                        ? t("replaces")
                        : t("new")
                    : t("{n} layer(s)", { n: p.project.layers.length })}
                </span>
              </label>
            ))}
          </div>
        )}

        {mode === "import" && pack && pack.fonts.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("Also installs {n} font(s): {names}", {
              n: pack.fonts.length,
              names: pack.fonts.map((f) => f.name).join(", "),
            })}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button disabled={busy || !chosen.length || !!error} onClick={() => void run()}>
            {busy && <Loader2 className="animate-spin" />}
            {mode === "export" ? t("Export") : t("Import")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
