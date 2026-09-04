import {
  Award,
  Box,
  CalendarDays,
  ChevronDown,
  Circle,
  Download,
  FilePlus2,
  FolderOpen,
  ImagePlus,
  MoveHorizontal,
  MoveVertical,
  Pill,
  Redo2,
  Ruler,
  Shapes,
  Square,
  Star,
  Type,
  Undo2,
  Users,
} from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LOGO_PRESETS, logoDataUri } from "../assets/logos";
import { exportBackup, importBackup } from "../backup";
import {
  EXPORT_LABELS,
  downloadBlob,
  downloadDataUrl,
  exportPng,
  type ExportMode,
} from "../export";
import {
  makeImageLayer,
  makeMetaBadgeLayer,
  makeShapeLayer,
  makeTextLayer,
  type MetaBadgeKind,
} from "../factory";
import type { ShapeKind } from "../types";
import { dataUriDimensions, fileToLayerSource, nameFromUrl, urlToLayerSource } from "../image";
import { serializeProject } from "../projectFile";
import { useStore } from "../store";
import type { GuideApi } from "../App";
import type { CanvasHandle } from "./EditorCanvas";

interface Props {
  canvas: React.MutableRefObject<CanvasHandle | null>;
  guides: GuideApi;
  onNewProject: () => void;
  onOpenProjects: () => void;
  onOpenPreview: () => void;
  onImportJson: (file: File) => void;
}

export function Toolbar({
  canvas,
  guides,
  onNewProject,
  onOpenProjects,
  onOpenPreview,
  onImportJson,
}: Props) {
  const { state, dispatch } = useStore();
  const { project, past, future, showBleed, showSafe } = state;
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const [imgOpen, setImgOpen] = useState(false);
  const [imgUrl, setImgUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const saveBackup = async () => {
    try {
      setBusy("Backup wird gepackt …");
      const { blob, name } = await exportBackup();
      downloadBlob(blob, name);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const loadBackup = async (file: File) => {
    if (
      !confirm(
        "Backup laden? Projekte und Vorlagen aus der Datei werden übernommen " +
          "(vorhandene mit gleicher ID überschrieben). Die Seite wird danach neu geladen.",
      )
    ) {
      return;
    }
    try {
      setBusy("Backup wird geladen …");
      const { projects, templates } = await importBackup(file);
      alert(`${projects} Projekt(e) und ${templates} Vorlage(n) übernommen.`);
      location.reload();
    } catch (e) {
      alert((e as Error).message);
      setBusy(null);
    }
  };

  const addImageFromFile = async (file: File) => {
    try {
      setBusy("Bild wird geladen …");
      const img = await fileToLayerSource(file);
      dispatch({
        type: "ADD_LAYER",
        layer: makeImageLayer({ ...img, name: file.name.replace(/\.[^.]+$/, "") }),
      });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const addImageFromUrl = async () => {
    const url = imgUrl.trim();
    if (!url) return;
    try {
      setBusy("Bild wird geladen …");
      const img = await urlToLayerSource(url);
      dispatch({ type: "ADD_LAYER", layer: makeImageLayer({ ...img, name: nameFromUrl(url) }) });
      setImgUrl("");
      setImgOpen(false);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const addLogo = async (svg: string, label: string) => {
    const dims = await dataUriDimensions(logoDataUri(svg));
    dispatch({
      type: "ADD_LAYER",
      layer: makeImageLayer({ ...dims, name: label, fit: "contain" }),
    });
  };

  const runExport = async (mode: ExportMode) => {
    const stage = canvas.current?.getStage();
    const w = canvas.current?.getStageWidth() ?? 0;
    if (!stage || !w) return;
    try {
      setBusy("PNG wird erzeugt …");
      const url = await exportPng({ stage, stageWidth: w, mode });
      const safe = project.name.replace(/[^\w\-]+/g, "_").slice(0, 40) || "sticker";
      downloadDataUrl(url, `${safe}_${mode}.png`);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const saveJson = () => {
    const blob = new Blob([serializeProject(project)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const safe = project.name.replace(/[^\w\-]+/g, "_").slice(0, 40) || "sticker";
    downloadDataUrl(url, `${safe}.json`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <header className="relative z-20 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-sidebar px-3.5 py-2">
      <div className="flex items-center gap-2">
        {project.isTemplate && (
          <Badge>{project.isGlobalTemplate ? "Global" : "Vorlage"}</Badge>
        )}
        <Input
          className="h-8 w-52 font-semibold"
          value={project.name}
          onChange={(e) => dispatch({ type: "RENAME", name: e.target.value })}
        />
        <span
          className="text-xs text-muted-foreground"
          title={state.dirty ? "nicht gespeichert" : "gespeichert"}
        >
          {state.dirty ? "●" : "○"}
        </span>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => dispatch({ type: "ADD_LAYER", layer: makeTextLayer() })}
        >
          <Type /> Text
        </Button>

        <Popover open={imgOpen} onOpenChange={setImgOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <ImagePlus /> Bild <ChevronDown className="opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 space-y-3">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setImgOpen(false);
                fileRef.current?.click();
              }}
            >
              Datei hochladen …
            </Button>
            <Separator />
            <div className="space-y-1.5">
              <Label>Von URL einfügen</Label>
              <div className="flex gap-1.5">
                <Input
                  type="url"
                  placeholder="https://…/bild.png"
                  value={imgUrl}
                  onChange={(e) => setImgUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void addImageFromUrl();
                  }}
                />
                <Button onClick={() => void addImageFromUrl()}>OK</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Square /> Form <ChevronDown className="opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(
              [
                ["capsule", "Kapsel", Pill],
                ["rect", "Quadrat", Square],
                ["circle", "Kreis", Circle],
              ] as const
            ).map(([kind, label, Icon]) => (
              <DropdownMenuItem
                key={kind}
                onClick={() =>
                  dispatch({
                    type: "ADD_LAYER",
                    layer: makeShapeLayer(kind as ShapeKind),
                  })
                }
              >
                <Icon /> {label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Aus gamelist.xml</DropdownMenuLabel>
            {(
              [
                ["rating", "Bewertung", Star],
                ["year", "Erscheinungsjahr", CalendarDays],
                ["players", "Spieleranzahl", Users],
                ["combo", "Alle kombiniert", Award],
              ] as const
            ).map(([kind, label, Icon]) => (
              <DropdownMenuItem
                key={kind}
                onClick={() =>
                  dispatch({
                    type: "ADD_LAYER",
                    layer: makeMetaBadgeLayer(kind as MetaBadgeKind),
                  })
                }
              >
                <Icon /> {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Shapes /> Logo <ChevronDown className="opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="grid w-64 grid-cols-3 gap-1">
            {LOGO_PRESETS.map((l) => (
              <button
                key={l.id}
                className="flex flex-col items-center gap-1 rounded-md p-2 text-[11px] hover:bg-accent"
                title={l.label}
                onClick={() => addLogo(l.svg, l.label)}
              >
                <img
                  src={logoDataUri(l.svg)}
                  alt={l.label}
                  className="h-8 w-14 object-contain"
                />
                <span className="truncate">{l.label}</span>
              </button>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-1">
        <IconBtn
          label="Rückgängig (⌘Z)"
          disabled={!past.length}
          onClick={() => dispatch({ type: "UNDO" })}
        >
          <Undo2 />
        </IconBtn>
        <IconBtn
          label="Wiederholen (⌘⇧Z)"
          disabled={!future.length}
          onClick={() => dispatch({ type: "REDO" })}
        >
          <Redo2 />
        </IconBtn>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <label className="flex items-center gap-1.5">
          <Checkbox
            checked={showBleed}
            onCheckedChange={() => dispatch({ type: "TOGGLE", key: "showBleed" })}
          />
          Beschnitt
        </label>
        <label className="flex items-center gap-1.5">
          <Checkbox
            checked={showSafe}
            onCheckedChange={() => dispatch({ type: "TOGGLE", key: "showSafe" })}
          />
          Sicherheitszone
        </label>
        <label className="flex items-center gap-1.5">
          <Checkbox checked={guides.state.on} onCheckedChange={() => guides.toggle()} />
          Hilfslinien
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" title="Hilfslinie hinzufügen">
              <Ruler />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => guides.add("x")}>
              <MoveVertical /> Vertikale Hilfslinie
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => guides.add("y")}>
              <MoveHorizontal /> Horizontale Hilfslinie
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={onOpenPreview}>
          <Box /> 3D-Vorschau
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Download /> Export <ChevronDown className="opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {(Object.keys(EXPORT_LABELS) as ExportMode[]).map((m) => (
              <DropdownMenuItem key={m} onClick={() => runExport(m)}>
                {EXPORT_LABELS[m]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Projektdatei</DropdownMenuLabel>
            <DropdownMenuItem onClick={saveJson}>Als JSON speichern</DropdownMenuItem>
            <DropdownMenuItem onClick={() => jsonRef.current?.click()}>
              JSON-Projekt öffnen …
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Komplett-Backup</DropdownMenuLabel>
            <DropdownMenuItem onClick={saveBackup}>
              Backup (.zip) speichern
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => zipRef.current?.click()}>
              Backup (.zip) laden …
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" onClick={onOpenProjects}>
          <FolderOpen /> Projekte
        </Button>
        <Button variant="outline" size="sm" onClick={onNewProject}>
          <FilePlus2 /> Neu
        </Button>
      </div>

      {busy && (
        <div className="absolute -bottom-7 right-3.5 rounded-b-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
          {busy}
        </div>
      )}

      <input
        ref={zipRef}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadBackup(f);
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
      <input
        ref={jsonRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportJson(f);
          e.target.value = "";
        }}
      />
    </header>
  );
}

function IconBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" disabled={disabled} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
