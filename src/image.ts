export interface LoadedImage {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
}

const MAX_DIM = 2400; // downscale huge uploads to keep the project small & fast

export async function fileToLayerSource(file: File): Promise<LoadedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Bitte eine Bilddatei wählen.");
  }
  const dataUrl = await readAsDataURL(file);

  // SVGs keep their vector source as-is.
  if (file.type === "image/svg+xml") {
    const dims = await measure(dataUrl);
    return { src: dataUrl, ...dims };
  }

  const img = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale === 1) {
    return { src: dataUrl, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight };
  }
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  const type = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
  return { src: canvas.toDataURL(type, 0.92), naturalWidth: w, naturalHeight: h };
}

export async function dataUriDimensions(src: string): Promise<LoadedImage> {
  const d = await measure(src);
  return { src, ...d };
}

const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  avif: "image/avif",
};

// Fetch a remote image and embed it (same path as an upload), so it survives
// in the saved project and stays export-safe. Needs the host to allow
// cross-origin reads.
export async function urlToLayerSource(url: string): Promise<LoadedImage> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Ungültige URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Nur http(s)-URLs werden unterstützt.");
  }

  let res: Response;
  try {
    res = await fetch(url, { mode: "cors", credentials: "omit" });
  } catch {
    throw new Error(
      "Bild konnte nicht geladen werden – die Seite erlaubt keinen Zugriff von anderen Websites. Lade das Bild herunter und füge es als Datei ein.",
    );
  }
  if (!res.ok) throw new Error(`Bild-URL nicht erreichbar (HTTP ${res.status}).`);

  const blob = await res.blob();
  const ext = parsed.pathname.split(".").pop()?.toLowerCase() ?? "";
  const type =
    blob.type && blob.type.startsWith("image/") ? blob.type : EXT_MIME[ext] ?? "";
  if (!type) throw new Error("Die URL verweist nicht auf ein Bild.");

  const name =
    (parsed.pathname.split("/").pop() || "bild").replace(/\.[^.]+$/, "") || "Bild";
  return fileToLayerSource(new File([blob], name, { type }));
}

export function nameFromUrl(url: string): string {
  try {
    const p = new URL(url).pathname.split("/").pop() || "";
    return p.replace(/\.[^.]+$/, "") || "Bild";
  } catch {
    return "Bild";
  }
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(file);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Bild konnte nicht geladen werden."));
    img.src = src;
  });
}

async function measure(src: string) {
  const img = await loadImage(src);
  return {
    naturalWidth: img.naturalWidth || 300,
    naturalHeight: img.naturalHeight || 150,
  };
}
