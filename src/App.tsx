import { useEffect, useRef, useState } from "react";
import { TRIM_RECT } from "./card";
import { EditorCanvas, type CanvasHandle } from "./components/EditorCanvas";
import { GameTree } from "./components/GameTree";
import { Inspector } from "./components/Inspector";
import { LayerList } from "./components/LayerList";
import { ProjectsDialog } from "./components/ProjectsDialog";
import { Toolbar } from "./components/Toolbar";
import { makeTextLayer, newConsoleTemplate, newProject, templateId } from "./factory";
import { getGameProject, linkGameProject } from "./gameIndex";
import { lastProjectId, loadProject, loadTemplateLayers, saveProject } from "./persist";
import { parseProject } from "./projectFile";
import { StoreProvider } from "./store";
import type { Layer, Project } from "./types";

export default function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [overlay, setOverlay] = useState<Layer[]>([]);
  const [showProjects, setShowProjects] = useState(false);

  // Load the console template layers to overlay on the current game sticker.
  useEffect(() => {
    let alive = true;
    const consoleId = project && !project.isTemplate ? project.gameKey?.split("/")[0] : undefined;
    if (!consoleId) {
      setOverlay([]);
      return;
    }
    loadTemplateLayers(consoleId).then((ls) => {
      if (alive) setOverlay(ls);
    });
    return () => {
      alive = false;
    };
  }, [project]);

  // Boot: restore last project or start a fresh one.
  useEffect(() => {
    (async () => {
      const id = lastProjectId();
      const existing = id ? await loadProject(id) : undefined;
      if (existing) {
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

    const p = newProject(gameTitle);
    p.gameKey = gameKey;
    p.consoleName = consoleName;
    p.layers = [
      {
        ...makeTextLayer(gameTitle),
        name: gameTitle,
        y: TRIM_RECT.y + TRIM_RECT.h * 0.16,
        width: TRIM_RECT.w * 0.86,
        fontSize: 40,
      },
    ];
    linkGameProject(gameKey, p.id);
    await swap(p);
  };

  const openConsoleTemplate = async (consoleId: string, consoleName: string) => {
    if (project?.id === templateId(consoleId)) return;
    const existing = await loadProject(templateId(consoleId));
    setProject(existing ?? newConsoleTemplate(consoleId, consoleName));
  };

  if (!project) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">
        lädt …
      </div>
    );
  }

  return (
    <StoreProvider key={project.id} initial={project}>
      <Shell
        overlay={overlay}
        activeGameKey={project.gameKey}
        activeConsoleId={project.isTemplate ? project.consoleId : undefined}
        onPickGame={pickGame}
        onOpenConsole={openConsoleTemplate}
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
  activeGameKey,
  activeConsoleId,
  onPickGame,
  onOpenConsole,
  onNewProject,
  onOpenProjects,
  onImportJson,
}: {
  overlay: Layer[];
  activeGameKey?: string;
  activeConsoleId?: string;
  onPickGame: (consoleName: string, gameTitle: string, gameKey: string) => void;
  onOpenConsole: (consoleId: string, consoleName: string) => void;
  onNewProject: () => void;
  onOpenProjects: () => void;
  onImportJson: (file: File) => void;
}) {
  const canvas = useRef<CanvasHandle | null>(null);
  return (
    <div className="flex h-full flex-col">
      <Toolbar
        canvas={canvas}
        onNewProject={onNewProject}
        onOpenProjects={onOpenProjects}
        onImportJson={onImportJson}
      />
      <div className="flex min-h-0 flex-1">
        <GameTree
          activeGameKey={activeGameKey}
          activeConsoleId={activeConsoleId}
          onPickGame={onPickGame}
          onOpenConsole={onOpenConsole}
        />
        <EditorCanvas handleRef={canvas} overlay={overlay} />
        <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l bg-sidebar">
          <LayerList />
          <Inspector />
        </aside>
      </div>
    </div>
  );
}
