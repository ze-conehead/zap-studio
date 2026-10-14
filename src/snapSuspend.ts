// Holding Ctrl (⌘ on a Mac) while moving or resizing switches snapping off for
// as long as the key is down. Tracked here, from the keyboard and from the
// modifier state every pointer event carries (so a key release the window
// never saw — alt-tabbing away, say — can't leave snapping stuck off).

import { useSyncExternalStore } from "react";

let suspended = false;
const listeners = new Set<() => void>();

function set(v: boolean) {
  if (v === suspended) return;
  suspended = v;
  for (const fn of listeners) fn();
}

export const isSnapSuspended = (): boolean => suspended;

/** True while the snap-off key is held — for showing it on the Snap checkbox. */
export const useSnapSuspended = (): boolean =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    isSnapSuspended,
    isSnapSuspended,
  );

if (typeof window !== "undefined") {
  const held = (e: KeyboardEvent | MouseEvent | PointerEvent) => e.ctrlKey || e.metaKey;
  window.addEventListener("keydown", (e) => set(held(e) || e.key === "Control" || e.key === "Meta"), true);
  window.addEventListener("keyup", (e) => set(held(e) && e.key !== "Control" && e.key !== "Meta"), true);
  window.addEventListener("pointermove", (e) => set(held(e)), true);
  window.addEventListener("mousemove", (e) => set(held(e)), true);
  window.addEventListener("blur", () => set(false));
}
