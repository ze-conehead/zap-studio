import {
  Award,
  CalendarDays,
  Circle,
  Database,
  Crop,
  GitBranch,
  ImageIcon,
  Images,
  Link2,
  Loader2,
  PaintBucket,
  Pill,
  Plus,
  QrCode,
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
  isBackground,
  makeBackgroundLayer,
  makeConditionLayer,
  makeImageLayer,
  makeAlphaMaskLayer,
  makeLogoSlotLayer,
  makeMetaBadgeLayer,
  makeMetaTextLayer,
  makeQrLayer,
  makeShapeLayer,
  makeTextLayer,
  uid,
  type MetaBadgeKind,
} from "../factory";
import { useT } from "../i18n";
import { fileToLayerSource, nameFromUrl, urlToLayerSource } from "../image";
import {
  listLocalCovers,
  listLocalLogos,
  localCoverUrl,
  localLogoUrl,
} from "../localLogos";
import { LocalImagePickerDialog } from "./LocalImagePickerDialog";
import { TRIM_RECT } from "../card";
import { CONTRAST_TOKEN } from "../contrast";
import { hasSpine, isSpineBg, spineRect } from "../spine";
import { useStore } from "../store";
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
  const spineRef = useRef<HTMLInputElement>(null);
  // A console template with a spine panel can carry one picture spread over
  // all its games' spines.
  const canSpineBg =
    !onBack &&
    project.isTemplate &&
    !project.isGlobalTemplate &&
    hasSpine() &&
    !faceLayers.some(isSpineBg);
  const [busy, setBusy] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [logoPickerOpen, setLogoPickerOpen] = useState(false);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);

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

  // Spine furniture for a template: the game's title running along the
  // spine (one line, shrunk to fit), and a copy of the console's logo at
  // the foot of it.
  const spine = !onBack && project.isTemplate ? spineRect() : null;
  const consoleLogo = project.isGlobalTemplate
    ? undefined
    : faceLayers.find((l) => l.type === "image" && l.logo);

  // With a console logo around, the title keeps clear of the foot of the
  // spine, where "Spine logo" goes (the lowest ~25 %).
  const addSpineTitle = () => {
    if (!spine) return;
    const span = consoleLogo ? 0.66 : 0.84;
    dispatch({
      type: "ADD_LAYER",
      layer: {
        ...makeMetaTextLayer("title"),
        name: t("Spine title"),
        x: spine.x + spine.w / 2,
        y: TRIM_RECT.y + TRIM_RECT.h * (consoleLogo ? 0.06 + span / 2 : 0.5),
        rotation: 90, // reads top to bottom; 270 for bottom to top
        width: TRIM_RECT.h * span,
        fontSize: Math.round(spine.w * 0.5),
        bold: true,
        fill: CONTRAST_TOKEN, // stays readable on any spine background
        autoFit: true,
        autoFitLines: 1,
      },
    });
  };

  const addSpineLogo = () => {
    if (!spine || consoleLogo?.type !== "image") return;
    // Turned 90°, its width runs along the spine and its height across it.
    const s = Math.min((spine.w * 0.7) / consoleLogo.height, (TRIM_RECT.h * 0.22) / consoleLogo.width);
    const w = consoleLogo.width * s;
    const h = consoleLogo.height * s;
    dispatch({
      type: "ADD_LAYER",
      layer: {
        ...consoleLogo,
        id: uid(),
        name: t("Spine logo"),
        logo: false,
        stackAfterId: undefined,
        x: spine.x + spine.w / 2,
        y: TRIM_RECT.y + TRIM_RECT.h * 0.94 - w / 2,
        rotation: 90,
        scaleX: 1,
        scaleY: 1,
        width: w,
        height: h,
      },
    });
  };

  const addSpineBgFromFile = async (file: File) => {
    try {
      setBusy(true);
      const img = await fileToLayerSource(file);
      dispatch({
        type: "ADD_LAYER",
        layer: {
          ...makeImageLayer({ ...img, name: t("Spine background"), fit: "cover" }),
          spineBg: true,
        },
      });
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

  // Embeds a copy of the picked logo/cover, same as an upload — it stays
  // usable (movable, filterable, exportable) even if that library entry is
  // later renamed or removed.
  const addFromLibrary = async (libraryKind: "logo" | "cover", id: string) => {
    const entry = (libraryKind === "cover" ? listLocalCovers() : listLocalLogos()).find(
      (l) => l.id === id,
    );
    const getUrl = libraryKind === "cover" ? localCoverUrl : localLogoUrl;
    try {
      setBusy(true);
      const blobUrl = await getUrl(id);
      if (!blobUrl) throw new Error(t("That file is no longer available."));
      const img = await urlToLayerSource(blobUrl);
      addImageLayer({ ...img, name: entry?.name ?? nameFromUrl(blobUrl) });
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
          {!onBack && project.isTemplate && (
            <>
              <DropdownMenuLabel>{t("Template")}</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() =>
                  dispatch({
                    type: "ADD_LAYER",
                    layer: makeAlphaMaskLayer(nextMask),
                  })
                }
              >
                <Crop /> {t("Alpha mask")}
              </DropdownMenuItem>
              {project.isGlobalTemplate && (
                <DropdownMenuItem
                  onClick={() =>
                    dispatch({ type: "ADD_LAYER", layer: makeLogoSlotLayer() })
                  }
                >
                  <ImageIcon /> {t("Logo slot")}
                </DropdownMenuItem>
              )}
              {canSpineBg && (
                <DropdownMenuItem onClick={() => spineRef.current?.click()}>
                  <Images /> {t("Spine background …")}
                </DropdownMenuItem>
              )}
              {spine && (
                <DropdownMenuItem onClick={addSpineTitle}>
                  <Type /> {t("Spine title")}
                </DropdownMenuItem>
              )}
              {spine && consoleLogo && (
                <DropdownMenuItem onClick={addSpineLogo}>
                  <ImageIcon /> {t("Spine logo")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem
            onClick={() => dispatch({ type: "ADD_LAYER", layer: makeTextLayer() })}
          >
            <Type /> {t("Text")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => dispatch({ type: "ADD_LAYER", layer: makeQrLayer() })}
          >
            <QrCode /> {t("QR code")}
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
          <DropdownMenuItem onClick={() => setLogoPickerOpen(true)}>
            <ImageIcon /> {t("Add logo …")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setCoverPickerOpen(true)}>
            <Images /> {t("Add cover …")}
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
              <DropdownMenuLabel>{t("Metadata")}</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => dispatch({ type: "ADD_LAYER", layer: makeMetaTextLayer() })}
              >
                <Database /> {t("Property")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  dispatch({ type: "ADD_LAYER", layer: makeConditionLayer() })
                }
              >
                <GitBranch /> {t("Condition")}
              </DropdownMenuItem>
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

      <LocalImagePickerDialog
        open={logoPickerOpen}
        onOpenChange={setLogoPickerOpen}
        kind="logo"
        onPick={(id) => {
          setLogoPickerOpen(false);
          void addFromLibrary("logo", id);
        }}
      />
      <LocalImagePickerDialog
        open={coverPickerOpen}
        onOpenChange={setCoverPickerOpen}
        kind="cover"
        onPick={(id) => {
          setCoverPickerOpen(false);
          void addFromLibrary("cover", id);
        }}
      />

      <input
        ref={spineRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void addSpineBgFromFile(f);
          e.target.value = "";
        }}
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
