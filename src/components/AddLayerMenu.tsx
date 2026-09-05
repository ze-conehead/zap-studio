import {
  Award,
  CalendarDays,
  Circle,
  Crop,
  Link2,
  Loader2,
  Pill,
  Plus,
  Square,
  Star,
  Type,
  Upload,
  Users,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  fitImageToMask,
  makeImageLayer,
  makeMainMaskLayer,
  makeMetaBadgeLayer,
  makeShapeLayer,
  makeTextLayer,
  type MetaBadgeKind,
} from "../factory";
import { useT } from "../i18n";
import { fileToLayerSource, nameFromUrl, urlToLayerSource } from "../image";
import { useStore } from "../store";
import type { Layer, ShapeKind } from "../types";

// The single "+" entry point for adding a layer, shown in the Layers panel.
// Owns everything that used to live in the toolbar's Text / Image / Shape
// controls.
export function AddLayerMenu({ mainMask }: { mainMask?: Layer }) {
  const { state, dispatch } = useStore();
  const t = useT();
  const { project } = state;
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState("");

  // Fresh image on a game card: the first image is the card's main image,
  // and a main image is sized to fully cover the global alpha mask.
  const addImageLayer = (img: Parameters<typeof makeImageLayer>[0]) => {
    const firstImage = !project.layers.some((l) => l.type === "image");
    let layer = makeImageLayer(img);
    if (firstImage && !project.isTemplate) layer = { ...layer, main: true };
    dispatch({ type: "ADD_LAYER", layer: fitImageToMask(layer, mainMask) });
  };

  const addImageFromFile = async (file: File) => {
    try {
      setBusy(true);
      const img = await fileToLayerSource(file);
      addImageLayer({ ...img, name: file.name.replace(/\.[^.]+$/, "") });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addImageFromUrl = async () => {
    const value = url.trim();
    if (!value) return;
    try {
      setBusy(true);
      const img = await urlToLayerSource(value);
      addImageLayer({ ...img, name: nameFromUrl(value) });
      setUrl("");
      setUrlOpen(false);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const shapes = [
    ["capsule", "Capsule", Pill],
    ["rect", "Square", Square],
    ["circle", "Circle", Circle],
  ] as const;

  const badges = [
    ["rating", "Rating", Star],
    ["year", "Release year", CalendarDays],
    ["players", "Player count", Users],
    ["combo", "All combined", Award],
  ] as const;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            title={t("Add layer")}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => dispatch({ type: "ADD_LAYER", layer: makeTextLayer() })}
          >
            <Type /> {t("Text")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("Image")}</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => fileRef.current?.click()}>
            <Upload /> {t("Upload file …")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setUrlOpen(true)}>
            <Link2 /> {t("Add from URL")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("Shape")}</DropdownMenuLabel>
          {shapes.map(([kind, label, Icon]) => (
            <DropdownMenuItem
              key={kind}
              onClick={() =>
                dispatch({
                  type: "ADD_LAYER",
                  layer: makeShapeLayer(kind as ShapeKind),
                })
              }
            >
              <Icon /> {t(label)}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("From gamelist.xml")}</DropdownMenuLabel>
          {badges.map(([kind, label, Icon]) => (
            <DropdownMenuItem
              key={kind}
              onClick={() =>
                dispatch({
                  type: "ADD_LAYER",
                  layer: makeMetaBadgeLayer(kind as MetaBadgeKind),
                })
              }
            >
              <Icon /> {t(label)}
            </DropdownMenuItem>
          ))}

          {project.isGlobalTemplate && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  dispatch({ type: "ADD_LAYER", layer: makeMainMaskLayer() })
                }
              >
                <Crop /> {t("Main alpha mask")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={urlOpen} onOpenChange={setUrlOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Add from URL")}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-1.5">
            <Input
              type="url"
              autoFocus
              placeholder={t("https://…/image.png")}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addImageFromUrl();
              }}
            />
            <Button disabled={busy} onClick={() => void addImageFromUrl()}>
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void addImageFromFile(f);
          e.target.value = "";
        }}
      />
    </>
  );
}
