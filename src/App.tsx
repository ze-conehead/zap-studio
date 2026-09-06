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
import { Toolbar } from "./components/Toolbar";
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
import { getFormatId } from "./formats";
import { lastProjectId, loadProject, saveProject } from "./persist";
import { parseProject } from "./projectFile";
import { StoreProvider } from "./store";
import { t, useT } from "./i18n";
import type { CardBackground, Layer, Project } from "./types";

interface Templates {
  overlay: Layer[];
  consoleBg?: CardBackground;
  globalBg?: CardBackground;
  mainMask?: Layer; // "All consoles" alpha frame for the card's main image
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
  const [templates, setTemplates] = useState<Templates>({ overlay: [] });
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
      const mainMask = globalP?.layers.find((l) => l.mainMask && l.visible);
      const overlayable = (p?: Project) =>
        (p?.layers ?? []).filter((l) => !l.mainMask && !isBackground(l));
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
        // Editable in place on "All consoles"; a reference outline everywhere
        // else (console templates + game cards).
        mainMask: project.isGlobalTemplate ? undefined : mainMask,
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
        mainMask={templates.mainMask}
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
  mainMask,
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
  mainMask?: Layer;
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
  const canvas = useRef<CanvasHandle | null>(null);
  const [preview, setPreview] = useState(false);
  const [demo, setDemo] = useState(false);
  const t = useT();
  return (
    <div className="flex h-full flex-col">
      <Toolbar
        canvas={canvas}
        guides={guides}
        onNewProject={onNewProject}
        onOpenProjects={onOpenProjects}
        onOpenPreview={() => setPreview(true)}
        onOpenDemo={() => setDemo(true)}
        onImportJson={onImportJson}
      />
      <div className="flex min-h-0 flex-1">
        <GameTree
          activeGameKey={activeGameKey}
          activeConsoleId={activeConsoleId}
          activeGlobal={activeGlobal}
          mainMask={mainMask}
          onPickGame={onPickGame}
          onOpenConsole={onOpenConsole}
          onOpenGlobal={onOpenGlobal}
        />
        <EditorCanvas
          handleRef={canvas}
          overlay={overlay}
          consoleBg={consoleBg}
          globalBg={globalBg}
          mainMask={mainMask}
          guides={guides}
        />
        <aside className="flex w-96 shrink-0 flex-col overflow-y-auto border-l bg-sidebar">
          <FaceControl />
          <LayerList mainMask={mainMask} />
          <Tabs defaultValue="props">
            <TabsList className="mx-3 mt-3 flex w-auto">
              <TabsTrigger value="props">{t("Properties")}</TabsTrigger>
              {showMeta && <TabsTrigger value="meta">{t("Metadata")}</TabsTrigger>}
            </TabsList>
            <TabsContent value="props" className="mt-0">
              <Inspector consoleBg={consoleBg} globalBg={globalBg} guides={guides} />
            </TabsContent>
            {showMeta && (
              <TabsContent value="meta" className="mt-0">
                <MetadataPanel />
              </TabsContent>
            )}
          </Tabs>
        </aside>
      </div>

      {preview && <CardPreview canvas={canvas} onClose={() => setPreview(false)} />}
      {demo && <DemoMode onClose={() => setDemo(false)} />}
    </div>
  );
}
