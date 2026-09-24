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
import { ApiKeysDialog } from "./components/ApiKeysDialog";
import { CustomFontsDialog } from "./components/CustomFontsDialog";
import { ManageLogosDialog } from "./components/ManageLogosDialog";
import { BleedDialog } from "./components/BleedDialog";
import { ConfirmHost } from "./components/ConfirmDialog";
import { ShortcutsDialog } from "./components/ShortcutsDialog";
import {
  WalkthroughDialog,
  walkthroughSeen,
  markWalkthroughSeen,
} from "./components/WalkthroughDialog";
import { Toolbar } from "./components/Toolbar";
import { BaseImportDialog } from "./components/BaseImportDialog";
import { CutSheetDialog } from "./components/CutSheetDialog";
import { ExportAllDialog } from "./components/ExportAllDialog";
import { CardTrayDialog } from "./components/CardTrayDialog";
import { CoverPdfDialog } from "./components/CoverPdfDialog";
import { ExportDialog } from "./components/ExportDialog";
import { ExportProjectDialog } from "./components/ExportProjectDialog";
import { ZaparooImportDialog } from "./components/ZaparooImportDialog";
import {
  GLOBAL_TEMPLATE_ID,
  isBackground,
  newConsoleTemplate,
  newGlobalTemplate,
  newProject,
  templateId,
} from "./factory";
import { getCatalog } from "./data/catalog";
import { ensureCustomFontsLoaded } from "./customFonts";
import { getGameProject, linkGameProject } from "./gameIndex";
import { loadGuides, newGuideId, saveGuides, type GuidesState } from "./guides";
import { maskOptions, type MaskOption } from "./templates";
import { backgroundFillOverride, withFillOverride } from "./fillOverrides";
import { buildOverlay } from "./faceLayers";
import { getFormatId } from "./formats";
import {
  lastProjectId,
  lastViewId,
  loadProject,
  saveProject,
  setLastViewId,
} from "./persist";
import { StoreProvider, useStore } from "./store";
import { t, useT } from "./i18n";
import type { CardBackground, Layer, Project } from "./types";

interface Templates {
  overlay: Layer[];
  // `overlay` split back into its two pieces, for the Layers panel (which
  // labels each row "console" / "global" and doesn't need the alpha-mask
  // splicing buildFaceLayers does for the canvas) — see src/App.tsx#L149.
  consoleLayers: Layer[];
  globalLayers: Layer[];
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

  // Boot: restore whatever was last open (a design, a console template or
  // the global one). There must always be something selected — never a
  // detached blank project — so the global template is the fallback.
  useEffect(() => {
    (async () => {
      // Make sure the "All consoles" template exists (cards may reference it).
      let globalP = await loadProject(GLOBAL_TEMPLATE_ID);
      if (!globalP) {
        globalP = newGlobalTemplate();
        await saveProject(globalP);
      }

      const id = lastViewId() ?? lastProjectId();
      let restored = id ? await loadProject(id) : undefined;
      // A console template that was opened but never edited isn't saved —
      // rebuild it from the catalogue so the reload lands back on it.
      if (!restored && id && id !== GLOBAL_TEMPLATE_ID) {
        const c = getCatalog().find((c) => templateId(c.id) === id);
        if (c) restored = newConsoleTemplate(c.id, c.name);
      }
      // Only restore it if it belongs to the active format.
      setProject(
        restored && (restored.format ?? "card") === getFormatId()
          ? restored
          : globalP,
      );
    })();
    // Register uploaded fonts as early as possible — no need to block the
    // boot on it, the font pickers just fill in once it resolves.
    void ensureCustomFontsLoaded();
  }, []);

  // Remember what's open so a reload comes back to it.
  useEffect(() => {
    if (project) setLastViewId(project.id);
  }, [project]);

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
    <>
    <StoreProvider key={project.id} initial={project}>
      <Shell
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
      />
      <ProjectsDialog
        open={showProjects}
        onOpenChange={setShowProjects}
        currentId={project.id}
        onOpen={openProject}
      />
    </StoreProvider>
    <ConfirmHost />
    </>
  );
}

function Shell({
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
}: {
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
}) {
  const { state, dispatch } = useStore();
  const project = state.project;
  const canvas = useRef<CanvasHandle | null>(null);

  // Load the console + global template projects for the current view and
  // derive the read-only overlay layers and their backgrounds:
  // - game sticker → console layers + global layers (global on top)
  // - console template edit → global layers as context underlay
  // - global template edit → nothing
  // Re-runs on navigation (a different project) and whenever this project's
  // own fillOverrides change (SET_FILL_OVERRIDE) — it's the live store's
  // state.project, not a snapshot, so an override the user just picked
  // shows immediately instead of only after the next navigation.
  const [tpl, setTpl] = useState<Templates>({
    overlay: [],
    consoleLayers: [],
    globalLayers: [],
    masks: [],
  });
  useEffect(() => {
    let alive = true;
    (async () => {
      const consoleId = project.isGlobalTemplate
        ? undefined
        : project.gameKey?.split("/")[0] ?? project.consoleId;
      const [globalP, consoleP] = await Promise.all([
        loadProject(GLOBAL_TEMPLATE_ID),
        consoleId ? loadProject(templateId(consoleId)) : Promise.resolve(undefined),
      ]);
      if (!alive) return;

      // A shape/background flagged "editable in descendants" (src/fillOverrides.ts)
      // shows the fill the level right below its owner picked for it: a
      // console's own pick for a global layer, or a card's for a console
      // one. Editing the console template itself counts as "right below
      // global" too — descendantOfGlobal is then this live project, not a
      // second, possibly-stale copy reloaded from disk.
      const descendantOfGlobal = project.isTemplate ? project : consoleP;
      const descendantOfConsole = project.isTemplate ? undefined : project;

      // A template's own (visible) background layer is what a card inherits
      // when its background source is "console" / "global".
      const bgFill = (p?: Project, descendant?: Project) => {
        const bg = p?.layers.find(isBackground);
        return bg?.visible ? backgroundFillOverride(bg, descendant) : undefined;
      };
      const globalBg = bgFill(globalP, descendantOfGlobal);
      const consoleBg = bgFill(consoleP, descendantOfConsole);

      // The global "main alpha mask" clips each card's main image; it never
      // paints as an overlay layer itself. Background layers never overlay.
      const logoSlot = globalP?.layers.find((l) => l.logoSlot);
      // A card can point at any frame from the global template or its own
      // console; the template that owns one edits it in place instead.
      const masks = project.isTemplate ? [] : maskOptions(globalP, consoleP);
      // alpha masks AND the logo slot stay in: buildFaceLayers resolves
      // where each one's content actually slots in (or drops the frame
      // itself, if nothing fills it) — see its own comment.
      const overlayable = (p?: Project, descendant?: Project) =>
        (p?.layers ?? [])
          .filter((l) => !isBackground(l))
          .map((l) => withFillOverride(l, descendant));
      const globalLayers = overlayable(globalP, descendantOfGlobal);

      let consoleLayers: Layer[] = [];
      let overlay: Layer[] = [];
      if (project.isGlobalTemplate) {
        overlay = [];
      } else if (project.isTemplate) {
        overlay = globalLayers;
      } else {
        consoleLayers = overlayable(consoleP, descendantOfConsole);
        overlay = buildOverlay(consoleP, descendantOfConsole, globalP, descendantOfGlobal);
      }
      setTpl({
        overlay,
        consoleLayers,
        globalLayers: project.isGlobalTemplate ? [] : globalLayers,
        consoleBg,
        globalBg,
        logoSlot: project.isGlobalTemplate ? undefined : logoSlot,
        masks,
      });
    })();
    return () => {
      alive = false;
    };
    // Deliberately narrow: project.id covers navigation, fillOverrides
    // covers a live override edit — the rest of `project` (isTemplate,
    // gameKey, …) only ever changes together with the id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.fillOverrides]);
  const { overlay, consoleLayers, globalLayers, consoleBg, globalBg, logoSlot, masks } = tpl;

  // A read-only layer picked from the Layers panel (a console's or the
  // global template's own) — its own state, since the store's selectedId
  // only ever names one of this project's own layers. Cleared whenever an
  // own layer is (re)selected, and vice versa.
  const [foreignSelected, setForeignSelected] = useState<Layer | null>(null);
  // A combine entry (ShapeLayer.combine) picked as a sub-layer in the Layers
  // panel — lets the canvas show a drag handle for just that shape. Cleared
  // whenever selection moves elsewhere, same pattern as foreignSelected.
  const [selectedCombine, setSelectedCombine] = useState<{
    parentId: string;
    index: number;
  } | null>(null);
  const selectOwn = (id: string | null) => {
    setForeignSelected(null);
    setSelectedCombine(null);
    dispatch({ type: "SELECT", id });
  };
  const selectForeign = (layer: Layer | null) => {
    setForeignSelected(layer);
    setSelectedCombine(null);
    if (layer) dispatch({ type: "SELECT", id: null });
  };
  const selectCombine = (parentId: string, index: number) => {
    setForeignSelected(null);
    setSelectedCombine({ parentId, index });
    dispatch({ type: "SELECT", id: parentId });
  };
  const [preview, setPreview] = useState(false);
  const [demo, setDemo] = useState(false);
  // Dialogs the menu bar and the toolbar both open.
  const [cutSheet, setCutSheet] = useState(false);
  const [exportAll, setExportAll] = useState(false);
  const [cardTray, setCardTray] = useState(false);
  const [coverPdf, setCoverPdf] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportProjectOpen, setExportProjectOpen] = useState(false);
  const [baseImport, setBaseImport] = useState(false);
  const [zaparoo, setZaparoo] = useState(false);
  const [overview, setOverview] = useState(false);
  const [dataSafety, setDataSafety] = useState(false);
  const [workspaces, setWorkspaces] = useState(false);
  const [preflight, setPreflight] = useState(false);
  const [apiKeys, setApiKeys] = useState(false);
  const [customFonts, setCustomFonts] = useState(false);
  const [manageLogos, setManageLogos] = useState(false);
  const [manageCovers, setManageCovers] = useState(false);
  const [bleedOpen, setBleedOpen] = useState(false);
  // Opens by itself on a fresh install, then only from Help ▸ Walkthrough.
  // Marked seen as soon as it opens: the Shell remounts on every project
  // switch (see the StoreProvider key), so "seen on close" would show it
  // again after the tour's own jump buttons navigate away.
  const [walkthrough, setWalkthrough] = useState(() => !walkthroughSeen());
  const [shortcuts, setShortcuts] = useState(false);
  useEffect(() => {
    if (walkthrough) markWalkthroughSeen();
  }, [walkthrough]);
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
      } else if (e.key === "?") {
        setShortcuts(true);
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
    onOpenExport: () => setExportOpen(true),
    onOpenExportProject: () => setExportProjectOpen(true),
    onOpenCutSheet: () => setCutSheet(true),
    onOpenExportAll: () => setExportAll(true),
    onOpenCardTray: () => setCardTray(true),
    onOpenCoverPdf: () => setCoverPdf(true),
    onOpenBaseImport: () => setBaseImport(true),
    onOpenZaparoo: () => setZaparoo(true),
    onOpenOverview: () => setOverview(true),
    onOpenDataSafety: () => setDataSafety(true),
    onOpenWorkspaces: () => setWorkspaces(true),
    onOpenPreflight: () => setPreflight(true),
    onOpenApiKeys: () => setApiKeys(true),
    onOpenCustomFonts: () => setCustomFonts(true),
    onOpenManageLogos: () => setManageLogos(true),
    onOpenManageCovers: () => setManageCovers(true),
    onOpenBleed: () => setBleedOpen(true),
    onOpenWalkthrough: () => setWalkthrough(true),
    onOpenShortcuts: () => setShortcuts(true),
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
          selectedCombine={selectedCombine}
          onSelectCombine={selectCombine}
        />
        <aside className="flex w-96 shrink-0 flex-col overflow-y-auto border-l bg-sidebar">
          <FaceControl />
          <LayerList
            masks={masks}
            consoleLayers={consoleLayers}
            globalLayers={globalLayers}
            foreignSelectedId={foreignSelected?.id}
            selectedCombine={selectedCombine}
            onSelectOwn={selectOwn}
            onSelectForeign={selectForeign}
            onSelectCombine={selectCombine}
            onClearCombine={() => setSelectedCombine(null)}
          />
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
                foreignSelected={foreignSelected}
                onCloseForeign={() => setForeignSelected(null)}
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
      <ApiKeysDialog open={apiKeys} onOpenChange={setApiKeys} />
      <CustomFontsDialog open={customFonts} onOpenChange={setCustomFonts} />
      <ManageLogosDialog open={manageLogos} onOpenChange={setManageLogos} />
      <ManageLogosDialog kind="cover" open={manageCovers} onOpenChange={setManageCovers} />
      <BleedDialog
        open={bleedOpen}
        onOpenChange={setBleedOpen}
        beforeApply={async () => {
          // Saved and marked clean, so the unload flush can't write the
          // pre-move project back over the shifted one.
          await saveProject(state.project);
          dispatch({ type: "SAVED" });
        }}
      />
      <ShortcutsDialog open={shortcuts} onOpenChange={setShortcuts} />
      <WalkthroughDialog
        open={walkthrough}
        onOpenChange={setWalkthrough}
        targets={{
          onOpenApiKeys: () => setApiKeys(true),
          onOpenWorkspaces: () => setWorkspaces(true),
          onOpenGlobal,
          onOpenPreview: () => setPreview(true),
          onOpenDataSafety: () => setDataSafety(true),
        }}
      />
      <CutSheetDialog open={cutSheet} onOpenChange={setCutSheet} />
      <ExportAllDialog open={exportAll} onOpenChange={setExportAll} />
      <CardTrayDialog open={cardTray} onOpenChange={setCardTray} canvas={canvas} />
      <CoverPdfDialog open={coverPdf} onOpenChange={setCoverPdf} canvas={canvas} />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        canvas={canvas}
        onOpenCardTray={bar.onOpenCardTray}
        onOpenCoverPdf={bar.onOpenCoverPdf}
        onOpenExportAll={bar.onOpenExportAll}
        onOpenCutSheet={bar.onOpenCutSheet}
      />
      <ExportProjectDialog open={exportProjectOpen} onOpenChange={setExportProjectOpen} />
      <BaseImportDialog open={baseImport} onOpenChange={setBaseImport} />
      <ZaparooImportDialog open={zaparoo} onOpenChange={setZaparoo} />
    </div>
  );
}
