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
import { copyStyle, pasteStyle } from "./layerStyle";
import { isBackground, isCondition, makeBackFace, newProject } from "./factory";
import { getFormat } from "./formats";
import { saveProject } from "./persist";
import type { CardSide, Layer, Project } from "./types";

interface State {
  project: Project;
  side: CardSide; // which face is being edited (view state, not in history)
  selectedId: string | null;
  past: Project[];
  future: Project[];
  // The project as it was before the current run of transient (history:false)
  // edits — a drag, a slider. The next committed edit pushes THIS to history
  // instead of the already-moved project, so one undo reverts the whole drag.
  pending: Project | null;
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
  | { type: "TOGGLE"; key: "showBleed" }
  | { type: "UNDO" }
  | { type: "REDO" }
  // Jump to a point in the history list: `to` indexes [...past, current, ...future].
  | { type: "JUMP"; to: number }
  | { type: "SAVED" };

const HISTORY_LIMIT = 60;

function commit(state: State, project: Project): State {
  return {
    ...state,
    past: [...state.past, state.pending ?? state.project].slice(-HISTORY_LIMIT),
    future: [],
    project,
    pending: null,
    dirty: true,
  };
}

// A transient (history:false) edit: update the project but remember the
// pre-edit baseline so the eventual commit can undo the whole run at once.
function touch(state: State, project: Project): State {
  return {
    ...state,
    project,
    pending: state.pending ?? state.project,
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
        pending: null,
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
      // "main" is a single-slot legacy role — a new layer claiming it clears
      // it on the others. The main image is always labelled "Main image".
      const added =
        action.layer.type === "image" && action.layer.main
          ? { ...action.layer, name: t("Main image") }
          : action.layer;
      const cleared = layers.map((l) => ({
        ...l,
        ...(added.main ? { main: false } : null),
        ...(added.logoSlot ? { logoSlot: false } : null),
      }));
      // Adding a layer while a condition (or one of its cases) is selected
      // makes the new layer another case, dropped in right below the
      // condition so the group stays together in the layer list.
      const host = cleared.find((l) => l.id === state.selectedId);
      const condId =
        added.condId ??
        (host ? (isCondition(host) ? host.id : host.condId) : undefined);
      if (condId && !isCondition(added) && !isBackground(added)) {
        const at = cleared.findIndex((l) => l.id === condId);
        if (at >= 0) {
          const joined = { ...added, condId } as Layer;
          return {
            ...commit(
              state,
              write(project, [
                ...cleared.slice(0, at),
                joined,
                ...cleared.slice(at),
              ]),
            ),
            selectedId: joined.id,
          };
        }
      }
      return {
        ...commit(state, write(project, [...cleared, added])),
        selectedId: added.id,
      };
    }

    case "PATCH_LAYER": {
      const i = idx(action.id);
      if (i < 0) return state;
      let next = layers.map((l, j) =>
        j === i ? ({ ...l, ...action.patch } as Layer) : l,
      );
      // An image promoted to the main image is always labelled "Main image".
      if (action.patch.main === true && next[i].type === "image") {
        next = next.map((l, j) =>
          j === i ? ({ ...l, name: t("Main image") } as Layer) : l,
        );
      }
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
      if (action.patch.logoSlot === true) {
        next = next.map((l, j) =>
          j === i ? l : ({ ...l, logoSlot: false } as Layer),
        );
      }
      const p = write(project, next);
      return action.history === false ? touch(state, p) : commit(state, p);
    }

    case "PATCH_LAYERS": {
      const map = new Map(action.patches.map((x) => [x.id, x.patch]));
      const next = layers.map((l) =>
        map.has(l.id) ? ({ ...l, ...map.get(l.id) } as Layer) : l,
      );
      const p = write(project, next);
      return action.history === false ? touch(state, p) : commit(state, p);
    }

    case "DELETE_LAYER": {
      // Deleting a condition releases its cases rather than orphaning them —
      // an orphan would point at nothing and never be drawn again.
      const gone = layers.find((l) => l.id === action.id);
      const next = layers
        .filter((l) => l.id !== action.id)
        .map((l) =>
          gone && isCondition(gone) && l.condId === gone.id
            ? ({ ...l, condId: undefined } as Layer)
            : l,
        );
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

    case "JUMP": {
      const base = state.pending ?? state.project;
      const timeline = [...state.past, base, ...state.future];
      const to = Math.max(0, Math.min(timeline.length - 1, action.to));
      if (to === state.past.length && !state.pending) return state;
      const target = timeline[to];
      return {
        ...state,
        past: timeline.slice(0, to),
        future: timeline.slice(to + 1),
        project: target,
        pending: null,
        side: target.back ? state.side : "front",
        dirty: true,
      };
    }

    case "UNDO": {
      // A transient run still open (mid-drag, no commit yet): just drop it
      // back to its baseline — nothing to redo.
      if (state.pending) {
        return {
          ...state,
          project: state.pending,
          side: state.pending.back ? state.side : "front",
          pending: null,
          dirty: true,
        };
      }
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
        pending: null,
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
    pending: null,
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

  // Keyboard shortcuts for the selected layer. View-level keys (bleed,
  // guides, new card) live in the Shell, which owns those.
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    const NUDGE = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as const;

    // The layer of whichever face is active, if it isn't locked.
    const selected = () => {
      const st = latest.current;
      if (!st.selectedId) return null;
      const ls = st.side === "back" ? st.project.back?.layers ?? [] : st.project.layers;
      const l = ls.find((x) => x.id === st.selectedId);
      return l && !l.locked ? l : null;
    };

    const reorder = (dir: 1 | -1) => {
      const st = latest.current;
      const ls = st.side === "back" ? st.project.back?.layers ?? [] : st.project.layers;
      const i = ls.findIndex((l) => l.id === st.selectedId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ls.length) return;
      // The background layer stays pinned to the bottom.
      if (isBackground(ls[i]) || isBackground(ls[j])) return;
      const order = ls.map((l) => l.id);
      [order[i], order[j]] = [order[j], order[i]];
      dispatch({ type: "SET_LAYER_ORDER", order });
    };

    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      const mod = e.metaKey || e.ctrlKey;
      const id = latest.current.selectedId;
      const key = e.key.toLowerCase();

      if (mod && key === "z" && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "UNDO" });
      } else if (mod && (key === "y" || (e.shiftKey && key === "z"))) {
        e.preventDefault();
        dispatch({ type: "REDO" });
      } else if (mod && key === "d" && id) {
        e.preventDefault();
        dispatch({ type: "DUPLICATE_LAYER", id });
      } else if (mod && e.shiftKey && (key === "h" || key === "l") && id) {
        // Hide / lock the selected layer — a locked one can still be hidden.
        const st = latest.current;
        const ls = st.side === "back" ? st.project.back?.layers ?? [] : st.project.layers;
        const l = ls.find((x) => x.id === id);
        if (!l || isBackground(l)) return;
        e.preventDefault();
        dispatch({
          type: "PATCH_LAYER",
          id,
          patch: key === "h" ? { visible: !l.visible } : { locked: !l.locked },
        });
      } else if (mod && e.altKey && key === "c" && id) {
        const st = latest.current;
        const ls = st.side === "back" ? st.project.back?.layers ?? [] : st.project.layers;
        const l = ls.find((x) => x.id === id);
        if (!l) return;
        e.preventDefault();
        copyStyle(l);
      } else if (mod && e.altKey && key === "v") {
        const layer = selected();
        if (!layer) return;
        const patch = pasteStyle(layer);
        if (!Object.keys(patch).length) return;
        e.preventDefault();
        dispatch({ type: "PATCH_LAYER", id: layer.id, patch });
      } else if (mod && (e.key === "]" || e.key === "[")) {
        e.preventDefault();
        reorder(e.key === "]" ? 1 : -1);
      } else if (e.key in NUDGE) {
        const layer = selected();
        if (!layer) return;
        e.preventDefault();
        const [dx, dy] = NUDGE[e.key as keyof typeof NUDGE];
        const step = e.shiftKey ? 10 : 1;
        // history:false while the key is held — the keyup below closes the
        // run, so holding an arrow is one undo step, not fifty.
        dispatch({
          type: "PATCH_LAYER",
          id: layer.id,
          patch: { x: layer.x + dx * step, y: layer.y + dy * step },
          history: false,
        });
      } else if ((e.key === "Delete" || e.key === "Backspace") && id) {
        e.preventDefault();
        dispatch({ type: "DELETE_LAYER", id });
      } else if (e.key === "Escape") {
        dispatch({ type: "SELECT", id: null });
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!(e.key in NUDGE)) return;
      const layer = selected();
      if (layer) {
        dispatch({
          type: "PATCH_LAYER",
          id: layer.id,
          patch: { x: layer.x, y: layer.y },
        });
      }
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

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
