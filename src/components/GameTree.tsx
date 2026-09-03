import { useState } from "react";
import { CATALOG, gameKeyOf } from "../data/catalog";

interface Props {
  activeGameKey?: string;
  onPickGame: (consoleName: string, gameTitle: string, gameKey: string) => void;
}

export function GameTree({ activeGameKey, onPickGame }: Props) {
  const activeConsole = activeGameKey?.split("/")[0];
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    activeConsole ? { [activeConsole]: true } : { [CATALOG[0].id]: true },
  );

  return (
    <nav className="tree">
      <h2>Konsolen &amp; Spiele</h2>
      <ul>
        {CATALOG.map((c) => {
          const expanded = !!open[c.id];
          return (
            <li key={c.id} className="tree-console">
              <button
                className="tree-node console"
                onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}
              >
                <span className="twisty">{expanded ? "▾" : "▸"}</span>
                <span className="tree-emoji">🎮</span>
                <span className="tree-label">{c.name}</span>
                <span className="tree-count">{c.games.length}</span>
              </button>
              {expanded && (
                <ul className="tree-games">
                  {c.games.map((g, i) => {
                    const key = gameKeyOf(c, g);
                    const active = key === activeGameKey;
                    return (
                      <li key={g.id}>
                        <button
                          className={active ? "tree-node game active" : "tree-node game"}
                          onClick={() => onPickGame(c.name, g.title, key)}
                          title={g.title}
                        >
                          <span className="tree-rank">{i + 1}</span>
                          <span className="tree-label">{g.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <p className="hint">
        Ein Spiel auswählen legt ein Sticker-Design dafür an (oder öffnet das
        vorhandene).
      </p>
    </nav>
  );
}
