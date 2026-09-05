import {
  Box,
  ChevronDown,
  Download,
  FilePlus2,
  FolderOpen,
  Images,
  Import,
  Languages,
  ListPlus,
  MoveHorizontal,
  MoveVertical,
  Redo2,
  Ruler,
  Sparkles,
  Undo2,
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
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { exportBackup, importBackup } from "../backup";
import { findGame } from "../data/catalog";
import {
  EXPORT_MODES,
  downloadBlob,
  downloadDataUrl,
  exportLabel,
  exportPng,
  type ExportMode,
} from "../export";
import { fitImageToMask, makeImageLayer } from "../factory";
import type { Layer } from "../types";
import { urlToLayerSource } from "../image";
import { serializeProject } from "../projectFile";
import { useStore } from "../store";
import { useLang, useT } from "../i18n";
import type { GuideApi } from "../App";
import { BaseImportDialog } from "./BaseImportDialog";
import { CoverSearchDialog } from "./CoverSearchDialog";
import { CoverSweepDialog } from "./CoverSweepDialog";
import type { CanvasHandle } from "./EditorCanvas";
import { QuickImportDialog } from "./QuickImportDialog";

interface Props {
  canvas: React.MutableRefObject<CanvasHandle | null>;
  guides: GuideApi;
  mainMask?: Layer;
  onNewProject: () => void;
  onOpenProjects: () => void;
  onOpenPreview: () => void;
  onOpenDemo: () => void;
  onImportJson: (file: File) => void;
}

export function Toolbar({
  canvas,
  guides,
  mainMask,
  onNewProject,
  onOpenProjects,
  onOpenPreview,
  onOpenDemo,
  onImportJson,
}: Props) {
  const { state, dispatch } = useStore();
  const t = useT();
  const [lang, setLang] = useLang();
  const { project, past, future, showBleed, showSafe } = state;
  const jsonRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [coverSearchOpen, setCoverSearchOpen] = useState(false);
  const [coverSweepOpen, setCoverSweepOpen] = useState(false);
  const [baseImportOpen, setBaseImportOpen] = useState(false);
  const [quickImportOpen, setQuickImportOpen] = useState(false);

  const foundGame = findGame(project.gameKey);

  const saveBackup = async () => {
    try {
      setBusy(t("Packing backup …"));
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
        t(
          "Load backup? Projects and templates from the file are imported (existing ones with the same ID are overwritten). The page then reloads.",
        ),
      )
    ) {
      return;
    }
    try {
      setBusy(t("Loading backup …"));
      const { projects, templates } = await importBackup(file);
      alert(
        t("{projects} project(s) and {templates} template(s) imported.", {
          projects,
          templates,
        }),
      );
      location.reload();
    } catch (e) {
      alert((e as Error).message);
      setBusy(null);
    }
  };

  const addCoverFromUrl = async (url: string) => {
    setCoverSearchOpen(false);
    try {
      setBusy(t("Loading cover …"));
      const img = await urlToLayerSource(url);
      dispatch({
        type: "ADD_LAYER",
        layer: fitImageToMask(
          {
            ...makeImageLayer({ ...img, name: foundGame?.game.title ?? "Cover" }),
            main: true,
          },
          mainMask,
        ),
      });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const runExport = async (mode: ExportMode) => {
    const stage = canvas.current?.getStage();
    const w = canvas.current?.getStageWidth() ?? 0;
    if (!stage || !w) return;
    try {
      setBusy(t("Generating PNG …"));
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
          <Badge>{project.isGlobalTemplate ? t("Global") : t("Template")}</Badge>
        )}
        <span
          className="max-w-52 truncate text-sm font-semibold"
          title={project.name}
        >
          {project.name}
        </span>
        <span
          className="text-xs text-muted-foreground"
          title={state.dirty ? t("unsaved") : t("saved")}
        >
          {state.dirty ? "●" : "○"}
        </span>
      </div>

      {(foundGame || project.isGlobalTemplate) && (
        <>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              project.isGlobalTemplate
                ? setCoverSweepOpen(true)
                : setCoverSearchOpen(true)
            }
          >
            <Images /> {t("Find cover")}
          </Button>
        </>
      )}

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-1">
        <IconBtn
          label={t("Undo (⌘Z)")}
          disabled={!past.length}
          onClick={() => dispatch({ type: "UNDO" })}
        >
          <Undo2 />
        </IconBtn>
        <IconBtn
          label={t("Redo (⌘⇧Z)")}
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
          {t("Bleed")}
        </label>
        <label className="flex items-center gap-1.5">
          <Checkbox
            checked={showSafe}
            onCheckedChange={() => dispatch({ type: "TOGGLE", key: "showSafe" })}
          />
          {t("Safe zone")}
        </label>
        {project.isGlobalTemplate && (
          <>
            <label className="flex items-center gap-1.5">
              <Checkbox
                checked={guides.state.on}
                onCheckedChange={() => guides.toggle()}
              />
              {t("Guides")}
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title={t("Add guide")}>
                  <Ruler />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => guides.add("x")}>
                  <MoveVertical /> {t("Vertical guide")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => guides.add("y")}>
                  <MoveHorizontal /> {t("Horizontal guide")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" title={t("Language")}>
              <Languages /> {lang.toUpperCase()}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLang("en")} disabled={lang === "en"}>
              English
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLang("de")} disabled={lang === "de"}>
              Deutsch
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="sm" onClick={onOpenDemo}>
          <Sparkles /> Demo
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenPreview}>
          <Box /> {t("3D preview")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Download /> Export <ChevronDown className="opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {EXPORT_MODES.map((m) => (
              <DropdownMenuItem key={m} onClick={() => runExport(m)}>
                {exportLabel(m)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t("Project file")}</DropdownMenuLabel>
            <DropdownMenuItem onClick={saveJson}>{t("Save as JSON")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => jsonRef.current?.click()}>
              {t("Open JSON project …")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t("Full backup")}</DropdownMenuLabel>
            <DropdownMenuItem onClick={saveBackup}>
              {t("Save backup (.zip)")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => zipRef.current?.click()}>
              {t("Load backup (.zip) …")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setBaseImportOpen(true)}
          title={t("Import consoles & games from the base list (base_game_list.csv)")}
        >
          <ListPlus /> {t("Base set")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuickImportOpen(true)}
          title={t("Enter image URLs for every game without an image in a table")}
        >
          <Import /> Quick Import
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenProjects}>
          <FolderOpen /> {t("Projects")}
        </Button>
        <Button variant="outline" size="sm" onClick={onNewProject}>
          <FilePlus2 /> {t("New")}
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

      {foundGame && (
        <CoverSearchDialog
          open={coverSearchOpen}
          onOpenChange={setCoverSearchOpen}
          consoleName={foundGame.console.name}
          gameTitle={foundGame.game.title}
          onPick={(url) => void addCoverFromUrl(url)}
        />
      )}

      {project.isGlobalTemplate && (
        <CoverSweepDialog open={coverSweepOpen} onOpenChange={setCoverSweepOpen} />
      )}

      <BaseImportDialog open={baseImportOpen} onOpenChange={setBaseImportOpen} />

      <QuickImportDialog
        open={quickImportOpen}
        onOpenChange={setQuickImportOpen}
        currentGameKey={project.gameKey}
        onAddLayerToCurrent={(layer) => dispatch({ type: "ADD_LAYER", layer })}
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
