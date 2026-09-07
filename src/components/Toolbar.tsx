import {
  Box,
  ChevronDown,
  Download,
  FilePlus2,
  FolderOpen,
  Import,
  Languages,
  ListPlus,
  MoveHorizontal,
  MoveVertical,
  Palette,
  Redo2,
  Ruler,
  Shapes,
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
import { cn } from "@/lib/utils";
import { exportBackup, importBackup } from "../backup";
import {
  EXPORT_MODES,
  downloadBlob,
  downloadDataUrl,
  exportLabel,
  exportPng,
  type ExportMode,
} from "../export";
import { serializeProject } from "../projectFile";
import { useStore } from "../store";
import { useLang, useT } from "../i18n";
import { FORMAT_IDS, FORMATS, getFormat, getFormatId, setFormat } from "../formats";
import { accentColor, setTheme, THEME_IDS, THEMES, useTheme } from "../theme";
import type { GuideApi } from "../App";
import { CoverSweepDialog } from "./CoverSweepDialog";
import type { CanvasHandle } from "./EditorCanvas";

interface Props {
  canvas: React.MutableRefObject<CanvasHandle | null>;
  guides: GuideApi;
  onNewProject: () => void;
  onOpenProjects: () => void;
  onOpenPreview: () => void;
  onOpenDemo: () => void;
  onImportJson: (file: File) => void;
  // Owned by the Shell so the menu bar can open the same dialogs.
  onOpenCutSheet: () => void;
  onOpenBaseImport: () => void;
  onOpenQuickImport: () => void;
}

export function Toolbar({
  canvas,
  guides,
  onNewProject,
  onOpenProjects,
  onOpenPreview,
  onOpenDemo,
  onImportJson,
  onOpenCutSheet,
  onOpenBaseImport,
  onOpenQuickImport,
}: Props) {
  const { state, dispatch } = useStore();
  const t = useT();
  const [lang, setLang] = useLang();
  const theme = useTheme();
  const { project, side, past, future, showBleed } = state;
  const jsonRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [coverSweepOpen, setCoverSweepOpen] = useState(false);


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

  const runExport = async (mode: ExportMode) => {
    const stage = canvas.current?.getStage();
    const w = canvas.current?.getStageWidth() ?? 0;
    if (!stage || !w) return;
    try {
      setBusy(t("Generating PNG …"));
      const url = await exportPng({ stage, stageWidth: w, mode });
      const safe = project.name.replace(/[^\w\-]+/g, "_").slice(0, 40) || "sticker";
      const face = project.back ? (side === "back" ? "_back" : "_front") : "";
      downloadDataUrl(url, `${safe}${face}_${mode}.png`);
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
          className="text-xs text-muted-foreground"
          title={state.dirty ? t("unsaved") : t("saved")}
        >
          {state.dirty ? "●" : "○"}
        </span>
      </div>

      {project.isGlobalTemplate && (
        <>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCoverSweepOpen(true)}
          >
            {t("Find covers")}
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
            checked={guides.state.on}
            onCheckedChange={() => guides.toggle()}
          />
          {t("Guides")}
        </label>
        {guides.state.items.length > 0 && (
          <label
            className={cn(
              "flex items-center gap-1.5",
              !guides.state.on && "opacity-40",
            )}
          >
            <Checkbox
              checked={guides.state.snap}
              disabled={!guides.state.on}
              onCheckedChange={(v) => guides.setSnap(!!v)}
            />
            {t("Snap")}
          </label>
        )}
        {project.isGlobalTemplate && (
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
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" title={t("Format")}>
              <Shapes /> {t(getFormat().name)}
              <ChevronDown className="opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {FORMAT_IDS.map((id) => (
              <DropdownMenuItem
                key={id}
                onClick={() => setFormat(id)}
                disabled={id === getFormatId()}
              >
                {t(FORMATS[id].name)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" title={t("Theme")}>
              <Palette />
              <span
                className="size-3 rounded-full ring-1 ring-white/25"
                style={{ background: accentColor(theme) }}
              />
              {t(theme.name)}
              <ChevronDown className="opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("Accent colour")}</DropdownMenuLabel>
            {THEME_IDS.map((id) => (
              <DropdownMenuItem
                key={id}
                onClick={() => setTheme(id)}
                disabled={id === theme.id}
              >
                <span
                  className="size-3.5 rounded-full ring-1 ring-white/25"
                  style={{ background: accentColor(THEMES[id]) }}
                />
                {t(THEMES[id].name)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
            <DropdownMenuLabel>{t("This card")}</DropdownMenuLabel>
            {EXPORT_MODES.map((m) => (
              <DropdownMenuItem key={m} onClick={() => runExport(m)}>
                {exportLabel(m)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t("Multiple cards")}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onOpenCutSheet()}>
              {t("Print / cut sheet (Cricut · wir-machen-druck) …")}
            </DropdownMenuItem>
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
          onClick={() => onOpenBaseImport()}
          title={t("Import consoles & games from the base list (base_game_list.csv)")}
        >
          <ListPlus /> {t("Base set")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenQuickImport()}
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

      {project.isGlobalTemplate && (
        <CoverSweepDialog open={coverSweepOpen} onOpenChange={setCoverSweepOpen} />
      )}



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
