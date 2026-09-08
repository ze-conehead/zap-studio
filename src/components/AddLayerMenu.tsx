import {
  Award,
  CalendarDays,
  Circle,
  Crop,
  ImageIcon,
  Link2,
  Loader2,
  PaintBucket,
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
  fitImageToSlot,
  isBackground,
  makeBackgroundLayer,
  makeImageLayer,
  makeAlphaMaskLayer,
  makeLogoSlotLayer,
  makeMetaBadgeLayer,
  makeShapeLayer,
  makeTextLayer,
  type MetaBadgeKind,
} from "../factory";
import { useT } from "../i18n";
import { fileToLayerSource, nameFromUrl, urlToLayerSource } from "../image";
import { useStore } from "../store";
import { loadLogoSlot } from "../templates";
import { CoverSearchDialog } from "./CoverSearchDialog";
import type { ShapeKind } from "../types";

// The single "+" entry point for adding a layer, shown in the Layers panel.
// Owns everything that used to live in the toolbar's Text / Image / Shape
// controls.
export function AddLayerMenu() {
  const { state, dispatch } = useStore();
  const t = useT();
  const { project, side } = state;
  const onBack = side === "back";
  const faceLayers = onBack ? project.back?.layers ?? [] : project.layers;
  const hasBg = faceLayers.some(isBackground);
  // Frames get a running number so several don't land on top of each other.
  const nextMask = faceLayers.filter((l) => l.alphaMask).length + 1;
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [logoOpen, setLogoOpen] = useState(false);

  // A freshly added image goes in as-is; which alpha mask it fills (if any)
  // is picked in the Inspector, or set for you by the cover flow.
  const addImageLayer = (img: Parameters<typeof makeImageLayer>[0]) => {
    dispatch({ type: "ADD_LAYER", layer: makeImageLayer(img) });
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

  // A logo is an ordinary image layer flagged `logo` — never the card's main
  // image, and it keeps its aspect ratio rather than filling the mask.
  const addLogoFromUrl = async (value: string) => {
    try {
      setBusy(true);
      const img = await urlToLayerSource(value);
      const layer = fitImageToSlot(
        { ...makeImageLayer({ ...img, name: t("Logo") }), logo: true },
        await loadLogoSlot(),
      );
      dispatch({ type: "ADD_LAYER", layer });
      setLogoOpen(false);
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
          {!hasBg && (
            <DropdownMenuItem
              onClick={() =>
                dispatch({ type: "ADD_LAYER", layer: makeBackgroundLayer() })
              }
            >
              <PaintBucket /> {t("Background")}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("Image")}</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => fileRef.current?.click()}>
            <Upload /> {t("Upload file …")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setUrlOpen(true)}>
            <Link2 /> {t("Add from URL")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("Logo")}</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setLogoOpen(true)}>
            <ImageIcon /> {t("Find logo (SteamGridDB) …")}
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

          {!onBack && (
            <>
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
            </>
          )}

          {!onBack && project.isTemplate && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  dispatch({ type: "ADD_LAYER", layer: makeAlphaMaskLayer(nextMask) })
                }
              >
                <Crop /> {t("Alpha mask")}
              </DropdownMenuItem>
            </>
          )}

          {!onBack && project.isGlobalTemplate && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  dispatch({ type: "ADD_LAYER", layer: makeLogoSlotLayer() })
                }
              >
                <ImageIcon /> {t("Logo slot")}
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

      <CoverSearchDialog
        open={logoOpen}
        onOpenChange={setLogoOpen}
        kind="logo"
        consoleName={project.consoleName ?? ""}
        gameTitle={project.name}
        busy={busy}
        onPick={(u) => void addLogoFromUrl(u)}
      />

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
