// The command palette's data: what can be run (every menu action, view
// toggles, adding layers, jumping to a card / console / layer, theme and
// language), and how a typed query finds it. The palette itself is
// components/CommandPalette.tsx; App.tsx builds the list from its handlers.

import { getCatalog } from "./data/catalog";
import { makeAlphaMaskLayer, makeCombinedLayer, makeQrLayer, makeShapeLayer, makeTextLayer } from "./factory";
import { setLang, type Lang } from "./i18n";
import { isBackground } from "./factory";
import { THEME_IDS, THEMES, setTheme } from "./theme";
import type { Action } from "./store";
import type { Layer } from "./types";

export interface Command {
  id: string; // stable, so "recent" survives a reload
  title: string;
  group: string; // already translated
  hint?: string; // secondary text on the right: a console, a layer kind, a key
  keywords?: string; // extra words that find it
  run: () => void;
}

type T = (key: string, vars?: Record<string, string | number>) => string;

export interface CommandContext {
  t: T;
  // The menu's own handlers (App.tsx#bar).
  bar: {
    onNewProject: () => void;
    onOpenWorkspaces: () => void;
    onOpenProjects: () => void;
    onOpenCollection: () => void;
    onOpenPreflight: () => void;
    onOpenExport: () => void;
    onOpenBaseImport: () => void;
    onOpenZaparoo: () => void;
    onOpenExportProject: () => void;
    onOpenDataSafety: () => void;
    onOpenBleed: () => void;
    onOpenDemo: () => void;
    onOpenOverview: () => void;
    onOpenPreview: () => void;
    onOpenApiKeys: () => void;
    onOpenCustomFonts: () => void;
    onOpenManageLogos: () => void;
    onOpenManageCovers: () => void;
    onOpenManageMetadata: () => void;
    onOpenPrintedCards: () => void;
    onOpenSpotColors: () => void;
    onOpenWalkthrough: () => void;
    onOpenShortcuts: () => void;
    onOpenAbout: () => void;
    onZoomChange: (zoom: number) => void;
  };
  dispatch: (a: Action) => void;
  toggles: {
    snap: () => void;
    guides: () => void;
    keepView: () => void;
    minimap: () => void;
  };
  isTemplate: boolean;
  layers: Layer[]; // the face being edited
  go: {
    pickGame: (consoleName: string, gameTitle: string, gameKey: string) => void;
    openConsole: (consoleId: string, consoleName: string) => void;
    openGlobal: () => void;
    selectLayer: (id: string) => void;
  };
}

/** Everything that can be run right now. */
export function buildCommands(ctx: CommandContext): Command[] {
  const { t, bar, dispatch, toggles, go } = ctx;
  const out: Command[] = [];
  const add = (group: string, id: string, title: string, run: () => void, extra: Partial<Command> = {}) =>
    out.push({ id, title, group, run, ...extra });

  const A = t("Actions");
  const act = (id: string, title: string, run: () => void, keywords?: string) => add(A, `action:${id}`, title, run, { keywords });
  act("new-card", t("New card"), bar.onNewProject, "create neu karte");
  act("new-project", t("New project …"), bar.onOpenWorkspaces, "workspace create");
  act("switch-project", t("Switch project …"), bar.onOpenWorkspaces, "workspace wechseln");
  act("open-design", t("Open design …"), bar.onOpenProjects, "projects öffnen");
  act("collection", t("Collection status …"), bar.onOpenCollection, "missing fehlt");
  act("preflight", t("Preflight check …"), bar.onOpenPreflight, "check prüfen print");
  act("export", t("Export to print …"), bar.onOpenExport, "png pdf druck sheet");
  act("import-base", t("Base set …"), bar.onOpenBaseImport, "import game list spieleliste");
  act("import-zaparoo", t("Zaparoo (MiSTer) …"), bar.onOpenZaparoo, "import mister");
  act("export-project", t("Export project as .zip"), bar.onOpenExportProject, "backup sichern");
  act("data-safety", t("Data safety …"), bar.onOpenDataSafety, "backup sicherung");
  act("bleed", t("Bleed …"), bar.onOpenBleed, "beschnitt");
  act("demo", t("Demo mode (card packs)"), bar.onOpenDemo);
  act("all-cards", t("All cards"), bar.onOpenOverview, "overview übersicht");
  act("preview", t("3D preview"), bar.onOpenPreview, "vorschau mockup");
  act("api-keys", t("API keys …"), bar.onOpenApiKeys, "schlüssel");
  act("fonts", t("Manage fonts …"), bar.onOpenCustomFonts, "schriftarten");
  act("logos", t("Manage logos …"), bar.onOpenManageLogos);
  act("covers", t("Manage covers …"), bar.onOpenManageCovers);
  act("metadata", t("Manage metadata …"), bar.onOpenManageMetadata, "metadaten tabelle spalten");
  act("printed", t("Printed cards …"), bar.onOpenPrintedCards, "gedruckt druck markieren printed");
  act("spot", t("Cut & fold lines …"), bar.onOpenSpotColors, "schnitt falz");
  act("walkthrough", t("Walkthrough …"), bar.onOpenWalkthrough, "tour hilfe");
  act("shortcuts", t("Keyboard shortcuts …"), bar.onOpenShortcuts, "tastatur");
  act("about", t("About Zap-Studio"), bar.onOpenAbout, "version");
  act("undo", t("Undo"), () => dispatch({ type: "UNDO" }), "rückgängig");
  act("redo", t("Redo"), () => dispatch({ type: "REDO" }), "wiederholen");
  act("deselect", t("Deselect all layers (Esc)"), () => dispatch({ type: "SELECT", id: null }), "abwählen");

  const V = t("View");
  add(V, "view:bleed", t("Show / hide bleed"), () => dispatch({ type: "TOGGLE", key: "showBleed" }), { keywords: "beschnitt" });
  add(V, "view:guides", t("Show / hide guides"), toggles.guides, { keywords: "hilfslinien" });
  add(V, "view:snap", t("Turn snapping on / off"), toggles.snap, { keywords: "einrasten" });
  add(V, "view:keep", t("Turn “Keep view” on / off"), toggles.keepView, { keywords: "ansicht behalten zoom" });
  add(V, "view:minimap", t("Turn the minimap on / off"), toggles.minimap, { keywords: "übersicht" });
  add(V, "view:fit", t("Reset zoom to fit"), () => bar.onZoomChange(1), { keywords: "einpassen" });

  const L = t("Add layer");
  const addLayer = (id: string, title: string, layer: () => Layer) =>
    add(L, `add:${id}`, title, () => dispatch({ type: "ADD_LAYER", layer: layer() }));
  addLayer("text", t("Text"), () => makeTextLayer());
  addLayer("square", t("Square"), () => makeShapeLayer("rect"));
  addLayer("circle", t("Circle"), () => makeShapeLayer("circle"));
  addLayer("capsule", t("Capsule"), () => makeShapeLayer("capsule"));
  addLayer("combined", t("Combined shape"), () => makeCombinedLayer());
  addLayer("qr", t("QR code"), () => makeQrLayer());
  if (ctx.isTemplate) {
    const n = ctx.layers.filter((l) => l.alphaMask).length + 1;
    addLayer("cover-container", t("Cover container"), () => makeAlphaMaskLayer(n, "cover"));
    addLayer("shot-container", t("Screenshot container"), () => makeAlphaMaskLayer(n, "screenshot"));
  }

  const S = t("Settings");
  for (const id of THEME_IDS) {
    add(S, `theme:${id}`, `${t("Theme")}: ${t(THEMES[id].name)}`, () => setTheme(id), { keywords: "design farbe" });
  }
  for (const [lang, name] of [["en", "English"], ["de", "Deutsch"]] as [Lang, string][]) {
    add(S, `lang:${lang}`, `${t("Language")}: ${name}`, () => setLang(lang), { keywords: "sprache" });
  }

  // Where to go: the cards, the consoles' templates, the global one, the layers.
  const G = t("Go to");
  add(G, "go:global", t("Global Layout"), go.openGlobal, { hint: t("Template") });
  for (const c of getCatalog()) {
    add(G, `go:console:${c.id}`, c.name, () => go.openConsole(c.id, c.name), { hint: t("Console template") });
    for (const g of c.games) {
      add(G, `go:game:${c.id}/${g.id}`, g.title, () => go.pickGame(c.name, g.title, `${c.id}/${g.id}`), { hint: c.name });
    }
  }
  const LY = t("Layers");
  for (const l of ctx.layers) {
    if (isBackground(l)) continue;
    const kind =
      l.type === "shape" ? (l.shape === "combined" ? t("Combined shape") : t("Shape")) : l.type === "image" ? t("Image") : l.type === "text" ? t("Text") : l.type === "qr" ? t("QR code") : t("Layer");
    add(LY, `layer:${l.id}`, l.name || kind, () => go.selectLayer(l.id), { hint: kind });
  }
  return out;
}

// ── Search ────────────────────────────────────────────────────────────────

const COMBINING = new RegExp("[\\u0300-\\u036f]", "g");

/** Lower-case, no accents, ß → ss — what is compared. */
export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(COMBINING, "")
    .replace(/ß/g, "ss")
    .toLowerCase();

/**
 * How well a command matches a query: lower is better, null = no match.
 * Every word of the query has to be found; one found at the start of the
 * title (or of one of its words) beats one found inside it, which beats one
 * found only in the group / hint / keywords.
 */
export function matchScore(c: Command, query: string): number | null {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  const title = fold(c.title);
  const other = fold(`${c.group} ${c.hint ?? ""} ${c.keywords ?? ""}`);
  let score = 0;
  for (const w of words) {
    if (title.startsWith(w)) score += 0;
    else if (title.includes(` ${w}`)) score += 1;
    else if (title.includes(w)) score += 2;
    else if (other.includes(w)) score += 4;
    else return null;
  }
  return score;
}

const LIMIT = 60;

/**
 * What the palette lists for `query`. Empty: the recently run ones, then the
 * everyday actions (not the thousands of cards). Typed: everything that
 * matches, best first (ties keep their order), at most 60.
 */
export function searchCommands(all: Command[], query: string, recent: string[] = []): Command[] {
  if (!query.trim()) {
    const byId = new Map(all.map((c) => [c.id, c]));
    const rec = recent.map((id) => byId.get(id)).filter((c): c is Command => !!c);
    const seen = new Set(rec.map((c) => c.id));
    const everyday = all.filter((c) => !seen.has(c.id) && !c.id.startsWith("go:") && !c.id.startsWith("theme:") && !c.id.startsWith("lang:"));
    return [...rec, ...everyday];
  }
  const scored: { c: Command; s: number; i: number }[] = [];
  all.forEach((c, i) => {
    const s = matchScore(c, query);
    if (s !== null) scored.push({ c, s, i });
  });
  scored.sort((a, b) => a.s - b.s || a.i - b.i);
  return scored.slice(0, LIMIT).map((x) => x.c);
}

// ── Recently run ───────────────────────────────────────────────────────────

const RECENT_KEY = "stickerstudio:recentCommands";
const RECENT_MAX = 6;

export function loadRecentCommands(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function rememberCommand(id: string): void {
  // Cards, layers and the like aren't "recent commands": only actions and toggles.
  if (id.startsWith("go:game") || id.startsWith("layer:")) return;
  const next = [id, ...loadRecentCommands().filter((x) => x !== id)].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* unavailable */
  }
}
