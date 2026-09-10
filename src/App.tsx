import { useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CANVAS } from "./card";
import { CardPreview } from "./components/CardPreview";
import { DemoMode } from "./components/DemoMode";
import { EditorCanvas, type CanvasHandle } from "./components/EditorCanvas";
import { GameTree } from "./components/GameTree";
import { Inspector } from "./components/Inspector";
import { FaceControl } from "./components/FaceControl";
import { LayerList } from "./components/LayerList";
import { MetadataPanel } from "./components/MetadataPanel";
import { ProjectsDialog } from "./components/ProjectsDialog";
import { MenuBar } from "./components/MenuBar";
import { OverviewDialog } from "./components/OverviewDialog";
import { DataSafetyDialog } from "./components/DataSafetyDialog";
import { WorkspaceDialog } from "./components/WorkspaceDialog";
import { PreflightDialog } from "./components/PreflightDialog";
import { TemplateDialog } from "./components/TemplateDialog";
import { ApiKeysDialog } from "./components/ApiKeysDialog";
import { Toolbar } from "./components/Toolbar";
import { BaseImportDialog } from "./components/BaseImportDialog";
import { CutSheetDialog } from "./components/CutSheetDialog";
import { QuickImportDialog } from "./components/QuickImportDialog";
import { ZaparooImportDialog } from "./components/ZaparooImportDialog";
import {
  GLOBAL_TEMPLATE_ID,
  isBackground,
  newConsoleTemplate,
  newGlobalTemplate,
  newProject,
  templateId,
} from "./factory";
import { getGameProject, linkGameProject } from "./gameIndex";
import { loadGuides, newGuideId, saveGuides, type GuidesState } from "./guides";
import { maskOptions, type MaskOption } from "./templates";
import { getFormatId } from "./formats";
import { lastProjectId, loadProject, saveProject } from "./persist";
import { parseProject } from "./projectFile";
import { StoreProvider, useStore } from "./store";
import { t, useT } from "./i18n";
import type { CardBackground, Layer, Project } from "./types";

interface Templates {
  overlay: Layer[];
  consoleBg?: CardBackground;
  globalBg?: CardBackground;
  logoSlot?: Layer; // "All consoles" placement frame for logos
  masks: MaskOption[]; // alpha frames from the global + console templates
}

export interface GuideApi {
  state: GuidesState;
  toggle: () => void;
  setLocked: (locked: boolean) => void;
  setSnap: (snap: boolean) => void;
  add: (axis: "x" | "y") => void;
  update: (id: string, pos: number) => void;
  remove: (id: string) => void;
}

export default function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [templates, setTemplates] = useState<Templates>({ overlay: [], masks: [] });
  const [showProjects, setShowProjects] = useState(false);

  // Global guide lines: same set on every card, on/off remembered.
  const [guides, setGuides] = useState<GuidesState>(() => loadGuides());
  useEffect(() => {
    saveGuides(guides);
  }, [guides]);

  const toggleGuides = () => setGuides((g) => ({ ...g, on: !g.on }));
  const setGuidesLocked = (locked: boolean) =>
    setGuides((g) => ({ ...g, locked }));
  const setGuidesSnap = (snap: boolean) => setGuides((g) => ({ ...g, snap }));
  const addGuide = (axis: "x" | "y") =>
    setGuides((g) => ({
      ...g,
      on: true,
      items: [
        ...g.items,
        { id: newGuideId(), axis, pos: axis === "x" ? CANVAS.w / 2 : CANVAS.h / 2 },
      ],
    }));
  const updateGuide = (id: string, pos: number) =>
    setGuides((g) =>
      g.locked
        ? g
        : { ...g, items: g.items.map((x) => (x.id === id ? { ...x, pos } : x)) },
    );
  const removeGuide = (id: string) =>
    setGuides((g) =>
      g.locked ? g : { ...g, items: g.items.filter((x) => x.id !== id) },
    );

  // Load the console + global template projects for the current view and
  // derive the read-only overlay layers and their backgrounds:
  // - game sticker → console layers + global layers (global on top)
  // - console template edit → global layers as context underlay
  // - global template edit → nothing
  useEffect(() => {
    let alive = true;
    if (!project) return;
    (async () => {
      const consoleId = project.isGlobalTemplate
        ? undefined
        : project.gameKey?.split("/")[0] ?? project.consoleId;
      const [globalP, consoleP] = await Promise.all([
        loadProject(GLOBAL_TEMPLATE_ID),
        consoleId ? loadProject(templateId(consoleId)) : Promise.resolve(undefined),
      ]);
      if (!alive) return;

      // A template's own (visible) background layer is what a card inherits
      // when its background source is "console" / "global".
      const bgFill = (p?: Project) => {
        const bg = p?.layers.find(isBackground);
        return bg?.visible ? bg.fill : undefined;
      };
      const globalBg = bgFill(globalP);
      const consoleBg = bgFill(consoleP);

      // The global "main alpha mask" clips each card's main image; it never
      // paints as an overlay layer itself. Background layers never overlay.
      const logoSlot = globalP?.layers.find((l) => l.logoSlot);
      // A card can point at any frame from the global template or its own
      // console; the template that owns one edits it in place instead.
      const masks = project.isTemplate ? [] : maskOptions(globalP, consoleP);
      const overlayable = (p?: Project) =>
        (p?.layers ?? []).filter(
          (l) => !l.alphaMask && !l.logoSlot && !isBackground(l),
        );
      const globalLayers = overlayable(globalP);

      let overlay: Layer[] = [];
      if (project.isGlobalTemplate) {
        overlay = [];
      } else if (project.isTemplate) {
        overlay = globalLayers;
      } else {
        overlay = [...overlayable(consoleP), ...globalLayers];
      }
      setTemplates({
        overlay,
        consoleBg,
        globalBg,
        logoSlot: project.isGlobalTemplate ? undefined : logoSlot,
        masks,
      });
    })();
    return () => {
      alive = false;
    };
  }, [project]);

  // Boot: restore last project or start a fresh one.
  useEffect(() => {
    (async () => {
      // Make sure the "All consoles" template exists (cards may reference it).
      if (!(await loadProject(GLOBAL_TEMPLATE_ID))) {
        await saveProject(newGlobalTemplate());
      }

      const id = lastProjectId();
      const existing = id ? await loadProject(id) : undefined;
      // Only restore the last design if it belongs to the active format.
      if (existing && (existing.format ?? "card") === getFormatId()) {
        setProject(existing);
      } else {
        const p = newProject();
        await saveProject(p);
        setProject(p);
      }
    })();
  }, []);

  const swap = async (p: Project) => {
    await saveProject(p);
    setProject(p);
  };

  const openProject = async (id: string) => {
    const p = await loadProject(id);
    if (p) {
      setProject(p);
      setShowProjects(false);
    }
  };

  const importJson = async (file: File) => {
    try {
      const text = await file.text();
      const p = parseProject(text);
      await swap(p);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const pickGame = async (consoleName: string, gameTitle: string, gameKey: string) => {
    if (project?.gameKey === gameKey) return;

    const linkedId = getGameProject(gameKey);
    if (linkedId) {
      const existing = await loadProject(linkedId);
      if (existing) {
        setProject(existing);
        return;
      }
    }

    // A fresh game design starts empty — no auto title layer.
    const p = newProject(gameTitle);
    p.gameKey = gameKey;
    p.consoleName = consoleName;
    linkGameProject(gameKey, p.id);
    await swap(p);
  };

  const openConsoleTemplate = async (consoleId: string, consoleName: string) => {
    if (project?.id === templateId(consoleId)) return;
    const existing = await loadProject(templateId(consoleId));
    // keep the stored label in sync with a console renamed in the tree
    if (existing) existing.consoleName = consoleName;
    setProject(existing ?? newConsoleTemplate(consoleId, consoleName));
  };

  const openGlobalTemplate = async () => {
    if (project?.id === GLOBAL_TEMPLATE_ID) return;
    const existing = await loadProject(GLOBAL_TEMPLATE_ID);
    setProject(existing ?? newGlobalTemplate());
  };

  if (!project) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">
        {t("loading …")}
      </div>
    );
  }

  const guideApi: GuideApi = {
    state: guides,
    toggle: toggleGuides,
    setLocked: setGuidesLocked,
    setSnap: setGuidesSnap,
    add: addGuide,
    update: updateGuide,
    remove: removeGuide,
  };

  return (
    <StoreProvider key={project.id} initial={project}>
      <Shell
        overlay={templates.overlay}
        consoleBg={templates.consoleBg}
        globalBg={templates.globalBg}
        logoSlot={templates.logoSlot}
        masks={templates.masks}
        guides={guideApi}
        activeGameKey={project.gameKey}
        activeConsoleId={project.isGlobalTemplate ? undefined : project.consoleId}
        activeGlobal={!!project.isGlobalTemplate}
        showMeta={!project.isTemplate}
        onPickGame={pickGame}
        onOpenConsole={openConsoleTemplate}
        onOpenGlobal={openGlobalTemplate}
        onNewProject={() => swap(newProject())}
        onOpenProjects={() => setShowProjects(true)}
        onImportJson={importJson}
      />
      <ProjectsDialog
        open={showProjects}
        onOpenChange={setShowProjects}
        currentId={project.id}
        onOpen={openProject}
      />
    </StoreProvider>
  );
}

function Shell({
  overlay,
  consoleBg,
  globalBg,
  logoSlot,
  masks,
  guides,
  activeGameKey,
  activeConsoleId,
  activeGlobal,
  showMeta,
  onPickGame,
  onOpenConsole,
  onOpenGlobal,
  onNewProject,
  onOpenProjects,
  onImportJson,
}: {
  overlay: Layer[];
  consoleBg?: CardBackground;
  globalBg?: CardBackground;
  logoSlot?: Layer;
  masks: MaskOption[];
  guides: GuideApi;
  activeGameKey?: string;
  activeConsoleId?: string;
  activeGlobal: boolean;
  showMeta: boolean;
  onPickGame: (consoleName: string, gameTitle: string, gameKey: string) => void;
  onOpenConsole: (consoleId: string, consoleName: string) => void;
  onOpenGlobal: () => void;
  onNewProject: () => void;
  onOpenProjects: () => void;
  onImportJson: (file: File) => void;
}) {
  const { dispatch } = useStore();
  const canvas = useRef<CanvasHandle | null>(null);
  const [preview, setPreview] = useState(false);
  const [demo, setDemo] = useState(false);
  // Dialogs the menu bar and the toolbar both open.
  const [cutSheet, setCutSheet] = useState(false);
  const [baseImport, setBaseImport] = useState(false);
  const [quickImport, setQuickImport] = useState(false);
  const [zaparoo, setZaparoo] = useState(false);
  const [overview, setOverview] = useState(false);
  const [dataSafety, setDataSafety] = useState(false);
  const [workspaces, setWorkspaces] = useState(false);
  const [preflight, setPreflight] = useState(false);
  const [templates, setTemplates] = useState(false);
  const [apiKeys, setApiKeys] = useState(false);
  const t = useT();
  // View-level shortcuts. The layer ones live in the store, which owns the
  // selection; these need the guides API and the Shell's dialogs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "n") {
        e.preventDefault();
        onNewProject();
      } else if (mod) {
        return; // leave every other modifier combo to the browser
      } else if (key === "b") {
        dispatch({ type: "TOGGLE", key: "showBleed" });
      } else if (key === "g") {
        guides.toggle();
      } else if (key === "p") {
        setPreview(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, guides, onNewProject]);

  const bar = {
    canvas,
    guides,
    onNewProject,
    onOpenProjects,
    onOpenPreview: () => setPreview(true),
    onOpenDemo: () => setDemo(true),
    onImportJson,
    onOpenCutSheet: () => setCutSheet(true),
    onOpenBaseImport: () => setBaseImport(true),
    onOpenQuickImport: () => setQuickImport(true),
    onOpenZaparoo: () => setZaparoo(true),
    onOpenOverview: () => setOverview(true),
    onOpenDataSafety: () => setDataSafety(true),
    onOpenWorkspaces: () => setWorkspaces(true),
    onOpenPreflight: () => setPreflight(true),
    onOpenTemplates: () => setTemplates(true),
    onOpenApiKeys: () => setApiKeys(true),
  };
  return (
    <div className="flex h-full flex-col">
      <MenuBar {...bar} />
      <Toolbar {...bar} />
      <div className="flex min-h-0 flex-1">
        <GameTree
          activeGameKey={activeGameKey}
          activeConsoleId={activeConsoleId}
          activeGlobal={activeGlobal}
          masks={masks.map((m) => m.layer)}
          onPickGame={onPickGame}
          onOpenConsole={onOpenConsole}
          onOpenGlobal={onOpenGlobal}
        />
        <EditorCanvas
          handleRef={canvas}
          overlay={overlay}
          consoleBg={consoleBg}
          globalBg={globalBg}
          masks={masks.map((m) => m.layer)}
          logoSlot={logoSlot}
          guides={guides}
        />
        <aside className="flex w-96 shrink-0 flex-col overflow-y-auto border-l bg-sidebar">
          <FaceControl />
          <LayerList masks={masks} />
          <Tabs defaultValue="props">
            <TabsList className="mx-3 mt-3 flex w-auto">
              <TabsTrigger value="props">{t("Properties")}</TabsTrigger>
              {showMeta && <TabsTrigger value="meta">{t("Metadata")}</TabsTrigger>}
            </TabsList>
            <TabsContent value="props" className="mt-0">
              <Inspector
                consoleBg={consoleBg}
                globalBg={globalBg}
                masks={masks}
                guides={guides}
              />
            </TabsContent>
            {showMeta && (
              <TabsContent value="meta" className="mt-0">
                <MetadataPanel />
              </TabsContent>
            )}
          </Tabs>
        </aside>
      </div>

      {preview && (
        <CardPreview
          canvas={canvas}
          activeGameKey={activeGameKey}
          activeConsoleId={activeConsoleId}
          onClose={() => setPreview(false)}
        />
      )}
      {demo && <DemoMode onClose={() => setDemo(false)} />}

      <OverviewDialog
        open={overview}
        onOpenChange={setOverview}
        activeGameKey={activeGameKey}
        onPick={onPickGame}
      />
      <DataSafetyDialog open={dataSafety} onOpenChange={setDataSafety} />
      <WorkspaceDialog open={workspaces} onOpenChange={setWorkspaces} />
      <PreflightDialog
        open={preflight}
        onOpenChange={setPreflight}
        overlay={overlay}
        onPick={onPickGame}
      />
      <TemplateDialog open={templates} onOpenChange={setTemplates} />
      <ApiKeysDialog open={apiKeys} onOpenChange={setApiKeys} />
      <CutSheetDialog open={cutSheet} onOpenChange={setCutSheet} />
      <BaseImportDialog open={baseImport} onOpenChange={setBaseImport} />
      <ZaparooImportDialog open={zaparoo} onOpenChange={setZaparoo} />
      <QuickImportDialog
        open={quickImport}
        onOpenChange={setQuickImport}
        currentGameKey={activeGameKey}
        onAddLayerToCurrent={(layer) => dispatch({ type: "ADD_LAYER", layer })}
      />
    </div>
  );
}
