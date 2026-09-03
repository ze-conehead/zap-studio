import { isImage } from "../factory";
import { useStore } from "../store";
import type { Layer } from "../types";

const icon = (l: Layer) => (isImage(l) ? "🖼️" : "🅣");

export function LayerList() {
  const { state, dispatch } = useStore();
  const layers = [...state.project.layers].reverse(); // top of stack first

  return (
    <section className="panel">
      <h2>Ebenen</h2>
      {layers.length === 0 && (
        <p className="hint">Noch keine Ebenen. Füge oben Text, ein Bild oder ein Logo hinzu.</p>
      )}
      <ul className="layer-list">
        {layers.map((l) => {
          const active = l.id === state.selectedId;
          return (
            <li
              key={l.id}
              className={active ? "layer-row active" : "layer-row"}
              onClick={() => dispatch({ type: "SELECT", id: l.id })}
            >
              <span className="layer-icon">{icon(l)}</span>
              <span className="layer-name" title={l.name}>
                {l.name}
              </span>
              <button
                className="icon-btn"
                title={l.visible ? "Ausblenden" : "Einblenden"}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: "PATCH_LAYER", id: l.id, patch: { visible: !l.visible } });
                }}
              >
                {l.visible ? "👁️" : "🚫"}
              </button>
              <button
                className="icon-btn"
                title={l.locked ? "Entsperren" : "Sperren"}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: "PATCH_LAYER", id: l.id, patch: { locked: !l.locked } });
                }}
              >
                {l.locked ? "🔒" : "🔓"}
              </button>
              <button
                className="icon-btn"
                title="Nach vorne"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: "REORDER", id: l.id, dir: "up" });
                }}
              >
                ↑
              </button>
              <button
                className="icon-btn"
                title="Nach hinten"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: "REORDER", id: l.id, dir: "down" });
                }}
              >
                ↓
              </button>
              <button
                className="icon-btn"
                title="Duplizieren"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: "DUPLICATE_LAYER", id: l.id });
                }}
              >
                ⧉
              </button>
              <button
                className="icon-btn danger"
                title="Löschen"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: "DELETE_LAYER", id: l.id });
                }}
              >
                🗑️
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
