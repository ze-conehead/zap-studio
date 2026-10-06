// Cuts a captured case wrap (trim only) into its panels, for the 3D case
// mockup: one picture per panel name ("Front", "Spine", "Back" …; the first
// panel of each name wins).

import { PANELS, TRIM_RECT } from "./card";

const load = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("render failed"));
    i.src = src;
  });

export async function cropPanels(trimDataUrl: string): Promise<Record<string, string>> {
  const img = await load(trimDataUrl);
  const k = img.naturalWidth / TRIM_RECT.w;
  const out: Record<string, string> = {};
  for (const p of PANELS) {
    if (out[p.name]) continue;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(p.w * k));
    c.height = img.naturalHeight;
    c.getContext("2d")?.drawImage(img, (p.x - TRIM_RECT.x) * k, 0, p.w * k, img.naturalHeight, 0, 0, c.width, c.height);
    out[p.name] = c.toDataURL("image/png");
  }
  return out;
}
