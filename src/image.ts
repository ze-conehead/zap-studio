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
