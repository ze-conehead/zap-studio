import { useState } from "react";
import { CATALOG, gameKeyOf } from "../data/catalog";

interface Props {
  activeGameKey?: string;
  activeConsoleId?: string;
  onPickGame: (consoleName: string, gameTitle: string, gameKey: string) => void;
  onOpenConsole: (consoleId: string, consoleName: string) => void;
}

export function GameTree({ activeGameKey, activeConsoleId, onPickGame, onOpenConsole }: Props) {
  const activeConsole = activeConsoleId ?? activeGameKey?.split("/")[0];
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
              <div className={activeConsoleId === c.id ? "tree-row console active" : "tree-row console"}>
                <button
                  className="twisty-btn"
                  title={expanded ? "Zuklappen" : "Aufklappen"}
                  onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}
                >
                  {expanded ? "▾" : "▸"}
                </button>
                <button
                  className="tree-label-btn"
                  title={`${c.name} – gemeinsame Vorlage bearbeiten`}
                  onClick={() => onOpenConsole(c.id, c.name)}
                >
                  <span className="tree-emoji">🎮</span>
                  <span className="tree-label">{c.name}</span>
                  <span className="tree-count">{c.games.length}</span>
                </button>
              </div>
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
        <strong>Konsolenname</strong> anklicken: gemeinsame Vorlage (Bilder/Texte
        auf allen Spiel-Karten). <strong>Spiel</strong> anklicken: dessen
        Sticker-Design.
      </p>
    </nav>
  );
}
