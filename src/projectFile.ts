import { newProject, uid } from "./factory";
import type { Layer, Project } from "./types";

const FORMAT = "credit-card-sticker-studio";
const VERSION = 1;

interface FileShape {
  format: string;
  version: number;
  project: Project;
}

export function serializeProject(p: Project): string {
  const payload: FileShape = { format: FORMAT, version: VERSION, project: p };
  return JSON.stringify(payload, null, 2);
}

export function parseProject(json: string): Project {
  const data = JSON.parse(json) as Partial<FileShape>;
  if (data.format !== FORMAT || !data.project) {
    throw new Error("Keine gültige Projektdatei.");
  }
  const src = data.project;
  const base = newProject(src.name || "Importiertes Design");
  return {
    ...base,
    name: src.name || base.name,
    backgroundColor: src.backgroundColor || base.backgroundColor,
    background: src.background ?? base.background,
    layers: Array.isArray(src.layers) ? (src.layers as Layer[]).map(sanitizeLayer) : [],
    id: uid(),
    updatedAt: Date.now(),
  };
}

function sanitizeLayer(l: Layer): Layer {
  return { ...l, id: l.id || uid() };
}
