import { Images, Loader2, Move, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { fileToLayerSource } from "../../image";
import { useT } from "../../i18n";
import { spineCountOf, spineSliceForConsole } from "../../spine";
import { useStore } from "../../store";
import type { ImageLayer } from "../../types";
import { SpineArrangeDialog } from "../SpineArrangeDialog";
import { SpinePreviewDialog } from "../SpinePreviewDialog";
import { AdjustControls, NumberField, Panel, SliderField, type Patch } from "./fields";

// The "Spine background" layer: a picture for the whole console, whose
// placement is automatic — so no position / size fields, just the picture,
// how many spines it spans and which part of it is kept.
export function SpineBgProps({ layer, patch }: { layer: ImageLayer; patch: Patch }) {
  const t = useT();
  const { state } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [arrange, setArrange] = useState(false);
  const slice = spineSliceForConsole(state.project.consoleId);
  const count = spineCountOf(layer, slice);
  const focus = layer.spineFocus ?? { x: 0.5, y: 0.5 };

  const replace = async (file: File) => {
    try {
      setBusy(true);
      const img = await fileToLayerSource(file);
      patch({ src: img.src, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={t("Spine background")}>
      <p className="text-xs text-muted-foreground">
        {t(
          "One picture across the spines of all {n} games in this console — each card shows its own slice. The editor shows the first spine.",
          { n: slice.count },
        )}
      </p>

      <div className="flex flex-col gap-2 rounded-md border p-2.5">
        <img
          src={layer.src}
          alt=""
          draggable={false}
          className="max-h-28 w-full rounded bg-muted/40 object-contain"
        />
        <span className="text-xs text-muted-foreground">
          {t("Original: {w}×{h} px", { w: layer.naturalWidth, h: layer.naturalHeight })}
        </span>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="animate-spin" /> : <Upload />} {t("Choose picture …")}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void replace(f);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex flex-col gap-2 rounded-md border p-2.5">
        <NumberField
          label={t("Number of spines")}
          value={count}
          onChange={(v) => patch({ spineCount: Math.max(1, Math.round(v)) })}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {layer.spineCount ? t("Fixed") : t("Automatic: one per game")}
          </span>
          {layer.spineCount ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => patch({ spineCount: undefined })}
            >
              {t("Automatic")}
            </Button>
          ) : null}
        </div>
        <SliderField
          label={t("Horizontal focus {n}%", { n: Math.round(focus.x * 100) })}
          min={0}
          max={1}
          step={0.01}
          value={focus.x}
          onChange={(x, done) => patch({ spineFocus: { ...focus, x } }, done)}
        />
        <SliderField
          label={t("Vertical focus {n}%", { n: Math.round(focus.y * 100) })}
          min={0}
          max={1}
          step={0.01}
          value={focus.y}
          onChange={(y, done) => patch({ spineFocus: { ...focus, y } }, done)}
        />
        <SliderField
          label={t("Opacity {n}%", { n: Math.round(layer.opacity * 100) })}
          min={0}
          max={1}
          step={0.01}
          value={layer.opacity}
          onChange={(v, done) => patch({ opacity: v }, done)}
        />
      </div>

      <Button variant="outline" size="sm" onClick={() => setArrange(true)}>
        <Move /> {t("Arrange across all spines …")}
      </Button>
      {arrange && (
        <SpineArrangeDialog
          open
          onOpenChange={(o) => !o && setArrange(false)}
          layer={layer}
          count={count}
          patch={patch}
        />
      )}

      <AdjustControls value={layer.adjust} onChange={(adjust, history) => patch({ adjust }, history)} />

      <Button variant="outline" size="sm" onClick={() => setPreview(true)}>
        <Images /> {t("Preview all spines …")}
      </Button>
      {preview && state.project.consoleId && (
        <SpinePreviewDialog
          open
          onOpenChange={(o) => !o && setPreview(false)}
          consoleId={state.project.consoleId}
          consoleName={state.project.consoleName ?? ""}
        />
      )}
    </Panel>
  );
}
