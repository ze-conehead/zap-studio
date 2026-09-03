import { useEffect, useRef, useState } from "react";
import { EditorCanvas, type CanvasHandle } from "./components/EditorCanvas";
import { Inspector } from "./components/Inspector";
import { LayerList } from "./components/LayerList";
import { ProjectsDialog } from "./components/ProjectsDialog";
import { Toolbar } from "./components/Toolbar";
import { newProject } from "./factory";
import { lastProjectId, loadProject, saveProject } from "./persist";
import { parseProject } from "./projectFile";
import { StoreProvider } from "./store";
import type { Project } from "./types";

export default function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [showProjects, setShowProjects] = useState(false);

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

  if (!project) return <div className="boot">lädt …</div>;

  return (
    <StoreProvider key={project.id} initial={project}>
      <Shell
        onNewProject={() => swap(newProject())}
        onOpenProjects={() => setShowProjects(true)}
        onImportJson={importJson}
      />
      {showProjects && (
        <ProjectsDialog
          currentId={project.id}
          onClose={() => setShowProjects(false)}
          onOpen={openProject}
        />
      )}
    </StoreProvider>
  );
}

function Shell({
  onNewProject,
  onOpenProjects,
  onImportJson,
}: {
  onNewProject: () => void;
  onOpenProjects: () => void;
  onImportJson: (file: File) => void;
}) {
  const canvas = useRef<CanvasHandle | null>(null);
  return (
    <div className="app">
      <Toolbar
        canvas={canvas}
        onNewProject={onNewProject}
        onOpenProjects={onOpenProjects}
        onImportJson={onImportJson}
      />
      <div className="workspace">
        <EditorCanvas handleRef={canvas} />
        <aside className="sidebar">
          <LayerList />
          <Inspector />
        </aside>
      </div>
    </div>
  );
}
