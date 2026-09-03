import { useEffect, useState } from "react";
import { deleteProject, listProjects, loadProject } from "../persist";
import type { ProjectMeta } from "../types";

interface Props {
  currentId: string;
  onClose: () => void;
  onOpen: (id: string) => void;
}

export function ProjectsDialog({ currentId, onClose, onOpen }: Props) {
  const [items, setItems] = useState<ProjectMeta[]>([]);

  const refresh = () => listProjects().then(setItems);
  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Deine Designs</h2>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </header>
        {items.length === 0 && <p className="hint">Noch keine gespeicherten Designs.</p>}
        <ul className="project-list">
          {items.map((p) => (
            <li key={p.id} className={p.id === currentId ? "current" : ""}>
              <button
                className="project-open"
                onClick={async () => {
                  const full = await loadProject(p.id);
                  if (full) onOpen(p.id);
                }}
              >
                <strong>{p.name}</strong>
                <small>{new Date(p.updatedAt).toLocaleString("de-DE")}</small>
                {p.id === currentId && <em> · geöffnet</em>}
              </button>
              <button
                className="icon-btn danger"
                title="Löschen"
                disabled={p.id === currentId}
                onClick={async () => {
                  if (confirm(`„${p.name}" wirklich löschen?`)) {
                    await deleteProject(p.id);
                    refresh();
                  }
                }}
              >
                🗑️
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
