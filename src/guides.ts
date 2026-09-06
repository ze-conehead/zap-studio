// User guide lines. Global: the same set shows on every card, and the
// on/off state is remembered. Stored in localStorage (small, per-browser).

export interface Guide {
  id: string;
  axis: "x" | "y"; // "x" = vertical line at this x; "y" = horizontal line at this y
  pos: number; // canvas px
}

export interface GuidesState {
  on: boolean;
  locked: boolean; // guides can't be dragged / edited while locked
  snap: boolean; // dragged layers snap their edges / centre to a nearby guide
  items: Guide[];
}

const KEY = "stickerstudio:guides";

export function loadGuides(): GuidesState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "");
    if (raw && Array.isArray(raw.items)) {
      return {
        on: !!raw.on,
        locked: !!raw.locked,
        snap: raw.snap !== false,
        items: raw.items as Guide[],
      };
    }
  } catch {
    /* no stored guides yet */
  }
  return { on: false, locked: false, snap: true, items: [] };
}

export function saveGuides(state: GuidesState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full / unavailable */
  }
}

export const newGuideId = () =>
  crypto.randomUUID?.() ?? `g-${Date.now()}-${Math.random().toString(16).slice(2)}`;
