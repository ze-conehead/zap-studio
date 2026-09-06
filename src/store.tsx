import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { t } from "./i18n";
import { isBackground, makeBackFace, newProject } from "./factory";
import { getFormat } from "./formats";
import { saveProject } from "./persist";
import type { CardSide, Layer, Project } from "./types";

interface State {
  project: Project;
  side: CardSide; // which face is being edited (view state, not in history)
  selectedId: string | null;
  past: Project[];
  future: Project[];
  showSafe: boolean;
  showBleed: boolean;
  dirty: boolean;
}

type Action =
  | { type: "LOAD"; project: Project }
  | { type: "RENAME"; name: string }
  | { type: "SET_SIDE"; side: CardSide; selectId?: string | null }
  | { type: "ADD_BACK" }
  | { type: "REMOVE_BACK" }
  | { type: "ADD_LAYER"; layer: Layer }
  | { type: "PATCH_LAYER"; id: string; patch: Partial<Layer>; history?: boolean }
  | {
      type: "PATCH_LAYERS";
      patches: { id: string; patch: Partial<Layer> }[];
      history?: boolean;
    }
  | { type: "DELETE_LAYER"; id: string }
  | { type: "DUPLICATE_LAYER"; id: string }
  | { type: "SET_LAYER_ORDER"; order: string[] }
  | { type: "SELECT"; id: string | null }
  | { type: "TOGGLE"; key: "showSafe" | "showBleed" }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SAVED" };

const HISTORY_LIMIT = 60;

function commit(state: State, project: Project): State {
  return {
    ...state,
    past: [...state.past, state.project].slice(-HISTORY_LIMIT),
    future: [],
    project,
    dirty: true,
  };
}

function reducer(state: State, action: Action): State {
  const { project, side } = state;
  // The layer stack of whichever face is active.
  const layers = side === "back" ? project.back?.layers ?? [] : project.layers;
  const idx = (id: string) => layers.findIndex((l) => l.id === id);

  // Write a new layer list back to the active face.
  const write = (p: Project, next: Layer[]): Project =>
    side === "back"
      ? {
          ...p,
          back: { ...(p.back ?? makeBackFace()), layers: next },
          updatedAt: Date.now(),
        }
      : { ...p, layers: next, updatedAt: Date.now() };

  switch (action.type) {
    case "LOAD":
      return {
        ...state,
        project: action.project,
        side: "front",
        selectedId: null,
        past: [],
        future: [],
        dirty: false,
      };

    case "RENAME":
      return commit(state, { ...project, name: action.name, updatedAt: Date.now() });

    case "SET_SIDE":
      if (action.side === "back" && !project.back) return state;
      return {
        ...state,
        side: action.side,
        selectedId: action.selectId !== undefined ? action.selectId : null,
      };

    case "ADD_BACK":
      if (!getFormat().hasBack) return state;
      if (project.back) return { ...state, side: "back", selectedId: null };
      return {
        ...commit(state, { ...project, back: makeBackFace(), updatedAt: Date.now() }),
        side: "back",
        selectedId: null,
      };

    case "REMOVE_BACK": {
      if (!project.back) return state;
      const { back: _removed, ...rest } = project;
      return {
        ...commit(state, { ...rest, updatedAt: Date.now() }),
        side: "front",
        selectedId: null,
      };
    }

    case "ADD_LAYER": {
      // The background layer is pinned to index 0; one per face.
      if (isBackground(action.layer)) {
        if (layers.some(isBackground)) return state;
        return {
          ...commit(state, write(project, [action.layer, ...layers])),
          selectedId: action.layer.id,
        };
      }
      // "main" / "mainMask" are single-slot roles — a new layer claiming one
      // clears it on the others.
      const cleared = layers.map((l) => ({
        ...l,
        ...(action.layer.main ? { main: false } : null),
        ...(action.layer.mainMask ? { mainMask: false } : null),
      }));
      return {
        ...commit(state, write(project, [...cleared, action.layer])),
        selectedId: action.layer.id,
      };
    }

    case "PATCH_LAYER": {
      const i = idx(action.id);
      if (i < 0) return state;
      let next = layers.map((l, j) =>
        j === i ? ({ ...l, ...action.patch } as Layer) : l,
      );
      // Turning a layer into a mask auto-clips the layer directly below it.
      if (
        action.patch.mask === true &&
        i > 0 &&
        !next[i - 1].mask &&
        !isBackground(next[i - 1])
      ) {
        next = next.map((l, j) =>
          j === i - 1 ? ({ ...l, clipped: true } as Layer) : l,
        );
      }
      // Single-slot roles: clear the previous holder.
      if (action.patch.main === true) {
        next = next.map((l, j) => (j === i ? l : ({ ...l, main: false } as Layer)));
      }
      if (action.patch.mainMask === true) {
        next = next.map((l, j) =>
          j === i ? l : ({ ...l, mainMask: false } as Layer),
        );
      }
      const p = write(project, next);
      return action.history === false
        ? { ...state, project: p, dirty: true }
        : commit(state, p);
    }

    case "PATCH_LAYERS": {
      const map = new Map(action.patches.map((x) => [x.id, x.patch]));
      const next = layers.map((l) =>
        map.has(l.id) ? ({ ...l, ...map.get(l.id) } as Layer) : l,
      );
      const p = write(project, next);
      return action.history === false
        ? { ...state, project: p, dirty: true }
        : commit(state, p);
    }

    case "DELETE_LAYER": {
      const next = layers.filter((l) => l.id !== action.id);
      return {
        ...commit(state, write(project, next)),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };
    }

    case "DUPLICATE_LAYER": {
      const i = idx(action.id);
      if (i < 0 || isBackground(layers[i])) return state;
      const orig = layers[i];
      const copy = {
        ...orig,
        id: crypto.randomUUID?.() ?? `${Date.now()}`,
        name: t("{name} copy", { name: orig.name }),
        x: orig.x + 24,
        y: orig.y + 24,
      } as Layer;
      const next = [...layers.slice(0, i + 1), copy, ...layers.slice(i + 1)];
      return { ...commit(state, write(project, next)), selectedId: copy.id };
    }

    case "SET_LAYER_ORDER": {
      const byId = new Map(layers.map((l) => [l.id, l]));
      let next = action.order
        .map((id) => byId.get(id))
        .filter((l): l is Layer => !!l);
      if (next.length !== layers.length) return state;
      // The background layer stays pinned to the bottom.
      if (next.some(isBackground) && !isBackground(next[0])) {
        next = [...next.filter(isBackground), ...next.filter((l) => !isBackground(l))];
      }
      const same = next.every((l, i) => l === layers[i]);
      return same ? state : commit(state, write(project, next));
    }

    case "SELECT":
      return { ...state, selectedId: action.id };

    case "TOGGLE":
      return { ...state, [action.key]: !state[action.key] };

    case "UNDO": {
      if (!state.past.length) return state;
      const past = [...state.past];
      const prev = past.pop()!;
      return {
        ...state,
        past,
        future: [state.project, ...state.future].slice(0, HISTORY_LIMIT),
        project: prev,
        side: prev.back ? state.side : "front",
        dirty: true,
      };
    }

    case "REDO": {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return {
        ...state,
        past: [...state.past, state.project].slice(-HISTORY_LIMIT),
        future: rest,
        project: next,
        side: next.back ? state.side : "front",
        dirty: true,
      };
    }

    case "SAVED":
      return { ...state, dirty: false };
  }
}

interface Ctx {
  state: State;
  dispatch: React.Dispatch<Action>;
  selected: Layer | null;
}

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({
  initial,
  children,
}: {
  initial: Project;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, {
    project: initial,
    side: "front",
    selectedId: null,
    past: [],
    future: [],
    showSafe: false,
    showBleed: false,
    dirty: false,
  });

  // Debounced autosave to IndexedDB.
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!state.dirty) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void saveProject(state.project).then(() => dispatch({ type: "SAVED" }));
    }, 600);
    return () => window.clearTimeout(timer.current);
  }, [state.project, state.dirty]);

  // Flush unsaved changes when the editor unmounts (project switch) or the
  // tab goes away, so fast navigation never drops edits.
  const live = useRef({ project: state.project, dirty: state.dirty });
  live.current = { project: state.project, dirty: state.dirty };
  useEffect(() => {
    const flush = () => {
      if (live.current.dirty) void saveProject(live.current.project);
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, []);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "UNDO" });
      } else if (mod && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        dispatch({ type: "REDO" });
      } else if ((e.key === "Delete" || e.key === "Backspace") && state.selectedId) {
        e.preventDefault();
        dispatch({ type: "DELETE_LAYER", id: state.selectedId });
      } else if (e.key === "Escape") {
        dispatch({ type: "SELECT", id: null });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.selectedId]);

  const selected = useMemo(() => {
    const ls =
      state.side === "back"
        ? state.project.back?.layers ?? []
        : state.project.layers;
    return ls.find((l) => l.id === state.selectedId) ?? null;
  }, [state.project, state.side, state.selectedId]);

  const value = useMemo(() => ({ state, dispatch, selected }), [state, selected]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Ctx {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore outside provider");
  return ctx;
}

export { newProject };
export type { Action, State };
