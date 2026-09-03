import { useRef, useState } from "react";
import { LOGO_PRESETS, logoDataUri } from "../assets/logos";
import { EXPORT_LABELS, downloadDataUrl, exportPng, type ExportMode } from "../export";
import { makeImageLayer, makeTextLayer } from "../factory";
import { dataUriDimensions, fileToLayerSource, nameFromUrl, urlToLayerSource } from "../image";
import { serializeProject } from "../projectFile";
import { useStore } from "../store";
import type { CanvasHandle } from "./EditorCanvas";

interface Props {
  canvas: React.MutableRefObject<CanvasHandle | null>;
  onNewProject: () => void;
  onOpenProjects: () => void;
  onImportJson: (file: File) => void;
}

export function Toolbar({ canvas, onNewProject, onOpenProjects, onImportJson }: Props) {
  const { state, dispatch } = useStore();
  const { project, past, future, showBleed, showSafe } = state;
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const [logoOpen, setLogoOpen] = useState(false);
  const [imgOpen, setImgOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [imgUrl, setImgUrl] = useState("");

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
      dispatch({
        type: "ADD_LAYER",
        layer: makeImageLayer({ ...img, name: nameFromUrl(url) }),
      });
      setImgUrl("");
      setImgOpen(false);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const addLogo = async (svg: string, label: string) => {
    setLogoOpen(false);
    const uri = logoDataUri(svg);
    const dims = await dataUriDimensions(uri);
    dispatch({
      type: "ADD_LAYER",
      layer: makeImageLayer({ ...dims, name: label, fit: "contain" }),
    });
  };

  const runExport = async (mode: ExportMode) => {
    setExportOpen(false);
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
    <header className="toolbar">
      <div className="tb-group">
        {project.isTemplate && <span className="mode-pill">Vorlage</span>}
        <input
          className="project-name"
          value={project.name}
          onChange={(e) => dispatch({ type: "RENAME", name: e.target.value })}
        />
        <span className="save-dot" title={state.dirty ? "nicht gespeichert" : "gespeichert"}>
          {state.dirty ? "●" : "○"}
        </span>
      </div>

      <div className="tb-group">
        <button onClick={() => dispatch({ type: "ADD_LAYER", layer: makeTextLayer() })}>
          + Text
        </button>
        <div className="menu">
          <button onClick={() => setImgOpen((v) => !v)}>+ Bild ▾</button>
          {imgOpen && (
            <div className="dropdown">
              <button
                onClick={() => {
                  setImgOpen(false);
                  fileRef.current?.click();
                }}
              >
                Datei hochladen …
              </button>
              <hr />
              <span className="dropdown-label">Von URL einfügen</span>
              <div className="url-row">
                <input
                  type="url"
                  placeholder="https://…/bild.png"
                  value={imgUrl}
                  onChange={(e) => setImgUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void addImageFromUrl();
                  }}
                />
                <button className="primary" onClick={() => void addImageFromUrl()}>
                  OK
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="menu">
          <button onClick={() => setLogoOpen((v) => !v)}>+ Logo ▾</button>
          {logoOpen && (
            <div className="dropdown logo-grid">
              {LOGO_PRESETS.map((l) => (
                <button
                  key={l.id}
                  className="logo-choice"
                  onClick={() => addLogo(l.svg, l.label)}
                  title={l.label}
                >
                  <img src={logoDataUri(l.svg)} alt={l.label} />
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="tb-group">
        <button
          disabled={!past.length}
          onClick={() => dispatch({ type: "UNDO" })}
          title="Rückgängig (⌘Z)"
        >
          Undo
        </button>
        <button
          disabled={!future.length}
          onClick={() => dispatch({ type: "REDO" })}
          title="Wiederholen (⌘⇧Z)"
        >
          Redo
        </button>
      </div>

      <div className="tb-group">
        <label className="chk">
          <input
            type="checkbox"
            checked={showBleed}
            onChange={() => dispatch({ type: "TOGGLE", key: "showBleed" })}
          />
          Beschnitt
        </label>
        <label className="chk">
          <input
            type="checkbox"
            checked={showSafe}
            onChange={() => dispatch({ type: "TOGGLE", key: "showSafe" })}
          />
          Sicherheitszone
        </label>
      </div>

      <div className="tb-group push">
        <div className="menu">
          <button className="primary" onClick={() => setExportOpen((v) => !v)}>
            Export ▾
          </button>
          {exportOpen && (
            <div className="dropdown">
              {(Object.keys(EXPORT_LABELS) as ExportMode[]).map((m) => (
                <button key={m} onClick={() => runExport(m)}>
                  {EXPORT_LABELS[m]}
                </button>
              ))}
              <hr />
              <button onClick={saveJson}>Projekt als JSON speichern</button>
              <button onClick={() => jsonRef.current?.click()}>JSON-Projekt öffnen …</button>
            </div>
          )}
        </div>
        <button onClick={onOpenProjects}>Projekte</button>
        <button onClick={onNewProject}>Neu</button>
      </div>

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

      {busy && <div className="busy">{busy}</div>}
    </header>
  );
}
