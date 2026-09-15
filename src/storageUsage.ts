// How full the browser's storage is — navigator.storage.estimate() covers
// IndexedDB (projects, libraries) and the rest of the origin. Chromium
// grants a share of the disk, so the quota is large but finite; the
// dialog warns before it runs out, since a full quota fails saves silently.

export interface StorageUsage {
  usage: number; // bytes
  quota: number; // bytes, 0 when unknown
  ratio: number; // 0..1, 0 when unknown
}

export const STORAGE_WARN_RATIO = 0.8;

export async function storageUsage(): Promise<StorageUsage | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota, ratio: quota ? usage / quota : 0 };
  } catch {
    return null;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}
