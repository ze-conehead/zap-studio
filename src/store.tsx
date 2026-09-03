import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { resolveBackground } from "./background";
import { newProject } from "./factory";
import { saveProject } from "./persist";
import type { BackgroundSource, CardBackground, Layer, Project } from "./types";

interface State {
  project: Project;
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
  | { type: "SET_BACKGROUND"; patch: Partial<CardBackground>; history?: boolean }
  | { type: "SET_BG_SOURCE"; source: BackgroundSource }
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

function touch(p: Project, layers: Layer[]): Project {
  return { ...p, layers, updatedAt: Date.now() };
}

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
  const { project } = state;
  const layers = project.layers;
  const idx = (id: string) => layers.findIndex((l) => l.id === id);

  switch (action.type) {
    case "LOAD":
      return {
        ...state,
        project: action.project,
        selectedId: null,
        past: [],
        future: [],
        dirty: false,
      };

    case "RENAME":
      return commit(state, { ...project, name: action.name, updatedAt: Date.now() });

    case "SET_BACKGROUND": {
      const bg = { ...resolveBackground(project), ...action.patch };
      const next = { ...project, background: bg, backgroundColor: bg.color, updatedAt: Date.now() };
      return action.history === false
        ? { ...state, project: next, dirty: true }
        : commit(state, next);
    }

    case "SET_BG_SOURCE":
      return commit(state, {
        ...project,
        backgroundSource: action.source,
        updatedAt: Date.now(),
      });

    case "ADD_LAYER":
      return {
        ...commit(state, touch(project, [...layers, action.layer])),
        selectedId: action.layer.id,
      };

    case "PATCH_LAYER": {
      const i = idx(action.id);
      if (i < 0) return state;
      let next = layers.map((l, j) =>
        j === i ? ({ ...l, ...action.patch } as Layer) : l,
      );
      // Turning a layer into a mask auto-clips the layer directly below it.
      if (action.patch.mask === true && i > 0 && !next[i - 1].mask) {
        next = next.map((l, j) =>
          j === i - 1 ? ({ ...l, clipped: true } as Layer) : l,
        );
      }
      const p = touch(project, next);
      return action.history === false
        ? { ...state, project: p, dirty: true }
        : commit(state, p);
    }

    case "PATCH_LAYERS": {
      const map = new Map(action.patches.map((x) => [x.id, x.patch]));
      const next = layers.map((l) =>
        map.has(l.id) ? ({ ...l, ...map.get(l.id) } as Layer) : l,
      );
      const p = touch(project, next);
      return action.history === false
        ? { ...state, project: p, dirty: true }
        : commit(state, p);
    }

    case "DELETE_LAYER": {
      const next = layers.filter((l) => l.id !== action.id);
      return {
        ...commit(state, touch(project, next)),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };
    }

    case "DUPLICATE_LAYER": {
      const i = idx(action.id);
      if (i < 0) return state;
      const orig = layers[i];
      const copy = {
        ...orig,
        id: crypto.randomUUID?.() ?? `${Date.now()}`,
        name: `${orig.name} Kopie`,
        x: orig.x + 24,
        y: orig.y + 24,
      } as Layer;
      const next = [...layers.slice(0, i + 1), copy, ...layers.slice(i + 1)];
      return { ...commit(state, touch(project, next)), selectedId: copy.id };
    }

    case "SET_LAYER_ORDER": {
      const byId = new Map(layers.map((l) => [l.id, l]));
      const next = action.order
        .map((id) => byId.get(id))
        .filter((l): l is Layer => !!l);
      if (next.length !== layers.length) return state;
      const same = next.every((l, i) => l === layers[i]);
      return same ? state : commit(state, touch(project, next));
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

  const selected = useMemo(
    () => state.project.layers.find((l) => l.id === state.selectedId) ?? null,
    [state.project.layers, state.selectedId],
  );

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
