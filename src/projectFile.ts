import { t } from "./i18n";
import { migrateProject, newProject, uid } from "./factory";
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
    throw new Error(t("Not a valid project file."));
  }
  const src = data.project;
  const base = newProject(src.name || t("Imported design"));
  return migrateProject({
    ...base,
    name: src.name || base.name,
    format: src.format ?? base.format,
    backgroundColor: src.backgroundColor,
    background: src.background,
    backgroundSource: src.backgroundSource,
    layers: Array.isArray(src.layers) ? (src.layers as Layer[]).map(sanitizeLayer) : [],
    back: src.back
      ? {
          layers: Array.isArray(src.back.layers)
            ? (src.back.layers as Layer[]).map(sanitizeLayer)
            : [],
          background: src.back.background,
          backgroundColor: src.back.backgroundColor,
        }
      : undefined,
    id: uid(),
    updatedAt: Date.now(),
  });
}

function sanitizeLayer(l: Layer): Layer {
  return { ...l, id: l.id || uid() };
}
