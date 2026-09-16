# Zap-Studio

Design credit-card-sized stickers (ISO ID-1, 54 × 85.6 mm) — and cassette
labels, floppy labels, DVD wraps, J-cards or any custom size — for game
consoles and movie collections. Runs entirely locally: as a web app in the
browser or as a desktop app for macOS, Windows and Linux. No server, no
login; everything lives in the browser's IndexedDB / localStorage.

<p align="center">
  <img src="docs/images/sample-card-1.png" alt="Sample sticker: Gran Turismo, PlayStation" width="260">
  <img src="docs/images/sample-card-2.png" alt="Sample sticker: Star Fox, Super Nintendo" width="260">
</p>

## Getting started

Download the latest release for your OS from
[Releases](https://github.com/ze-conehead/zap-studio/releases) (macOS
`.dmg`, Windows portable `.exe`, Linux `.AppImage` / `.deb`), or run the
web version:

```bash
npm install
npm run dev      # http://localhost:5173
```

The first start offers a short walkthrough (also under *Extra ▸
Walkthrough*): enter API keys, create a project, add an alpha mask to "All
consoles" so covers have a frame to land in, preview, export, back up.

## How it's organised

**Project** (a workspace) → **consoles** (or movie collections) → **games**
(or movies). Each game gets its own card design; the console and the
global template ("All consoles") add layers to every card beneath them.

- **Project**: created with *File ▸ New project* — pick **Games** or
  **Movies**, a card **format** (or a custom size in mm with corner
  radius), and optionally seed it with example consoles. Each project has
  its own designs, templates, metadata and settings; switch with *File ▸
  Switch project*.
- **Tree** (left): consoles with their games. Right-click a console for
  *Add*, *Rename*, *Find logo* (once a logo slot exists), *Find covers*
  (all games at once), *Fetch metadata for all games*, *Remove*;
  right-click a game for *Find cover*, *Insert cover by URL*, *Rename*,
  *Remove*. Drag & drop reorders consoles and games. ⌘/Ctrl F jumps to the
  search box; the funnel filters games with / without an image.
- **Templates**: "All consoles" (global) and each console name open a
  shared layer set. On a card, template layers are read-only and drawn in
  the template's own stacking order.
- **Layers panel**: also lists the layers a card or console inherits from
  its console / the global template, dashed and read-only, in the same
  order they're drawn. A shape or background flagged *editable per
  console/game* (see below) is the one exception — click it there to give
  it its own fill without touching the template.

### Layers

Add with the **+** button in the Layers panel:

| Layer | What it is |
| --- | --- |
| Text | Free text; supports `{placeholders}` (see Metadata) |
| Image | Uploaded file or URL; corner radius, greyscale / threshold adjust |
| Shape | Capsule, square / rectangle, circle — solid or gradient fill, noise, stroke |
| QR code | Vector QR with any content (placeholders allowed), colours, quiet zone, error-correction level |
| Background | The pinned bottom layer: solid / gradient + grain. A card without one inherits **card → console → global** |
| Alpha mask (templates) | A frame: an image on a card that points at it is clipped to its shape and fitted into it. Moving a mask in a template re-fits every linked image |
| Logo slot ("All consoles") | Where a console's logo is placed; never drawn |
| Metadata ▸ Property | Shows one metadata value chosen from a dropdown (title, year, age rating, …) |
| Metadata ▸ Condition | A switch on a metadata field: the layers assigned to it are its cases, only the matching one prints |
| Metadata ▸ Rating / Release year / Player count / All combined | Badges that read the game's metadata |

Every layer has opacity, a drop shadow / glow, lock and visibility. Any
layer can also be a **clipping mask** for the layers directly below it
("As mask" / "Into mask"), optionally moving them as a group.

**Combining shapes**: a shape (plain or an alpha mask) can union or
subtract other shapes onto its own outline — "Combine shapes" in its
Inspector, add a square/circle/capsule per entry and mark it *Add* or
*Subtract*. Several simple shapes become one alpha mask, or one visual
shape, this way; it composites live, including as an active mask.

**Editable per console / game**: a shape or the background layer on a
template gets a checkbox — *Fill editable per console* on the global
template, *per game* on a console one. A console (or a card) can then
pick its own fill for that layer from the Layers panel, without touching
the template or duplicating the shape; everything else about it (size,
stroke, combine…) stays inherited.

The Inspector offers *Align to card* (left / centre / right, top / middle /
bottom), *Copy* / *Paste* and *Copy style* / *Paste style* (also from the
canvas's right-click menu — carries a layer, with everything on it,
between consoles or onto a card), recent colours under every colour
field, and — for text — fonts (system, Google Fonts, your own files),
auto-fit and flowing around alpha masks.

### Covers, logos and metadata

- **Cover search** (*Find cover* on a game, *Find covers* on a console or
  "All consoles" for a sweep): **SteamGridDB**, **IGDB** (covers or
  screenshots), **libretro-thumbnails** (no key, retro consoles only),
  **TMDB** for movies, or **Local** — your own files. Keys go in *Settings
  ▸ API keys*; the source in *Settings ▸ Cover source*.
- **Logos**: *Find logo* / *Find logos* drop a console's wordmark into the
  logo slot — from SteamGridDB or from your own files (*Settings ▸ Logo
  source*).
- **Local libraries** (*Settings ▸ Manage covers … / Manage logos …*):
  drop image files, whole folders or a `.zip` (nested folders are fine).
  They're matched by file name — "Super Nintendo.png", "Gran Turismo.jpg".
- **Metadata** (sidebar tab on a game card): an editable
  EmulationStation-style entry per game — rating, description, release
  date, developer / publisher / genre / players (movies: director, studio,
  runtime) plus *More details* (age rating, series, website, alternative
  title, themes, game modes, perspective, engine, storyline; movies:
  tagline, cast, country). *Fetch from IGDB / TMDB* fills it in; the
  console's context menu does it for every game. A `gamelist.xml` can also
  be uploaded per console.
- **Placeholders** in text and QR layers — `{title}`, `{console}`,
  `{index}/{count}`, `{year}`, `{genre}`, `{rating}`, `{age}`,
  `{series}`, `{url}` … — are filled per card at render time, so one text
  in the global template labels every card.

### Output

- **Export** (*File ▸ Export*): PNG at final size, with bleed, or with
  bleed + crop marks; a card-tray printer PDF; every card as PNG in a
  `.zip`.
- **Print / cut sheet**: packs the finished cards onto sheets — for a
  Cricut (print PNG + matching cut SVG) or as a print-ready PDF for
  wir-machen-druck.de (kiss-cut contour, output intent). Options: gap,
  white background, **crop marks**, a **bleed overlay** in the preview,
  and **back sides on a second sheet**, mirrored for a long-edge duplex
  print with an X / Y offset to cancel the printer's misalignment.
- **Bleed** (*Settings ▸ Bleed …*): 0–10 mm per project; changing it moves
  every layer so nothing shifts on the printed card.
- **3D preview**, **overview** of all cards, and a **demo mode** that opens
  a booster pack of random cards (with a holographic chance).

### Safety

- **Autosave** to IndexedDB; **undo / redo** with a **history list** (the
  clock button) that names every step and jumps to any of them.
- **Backup** (*File ▸ Save backup*): one `.zip` with every design and
  template (images as deduplicated files), metadata, guides, catalogue
  edits, format / bleed settings and the local cover / logo libraries.
  *Data safety* can keep a rolling set of backups in a folder of your
  choice, shows the storage quota in use, and holds a 30-day trash.
- The desktop app checks GitHub for a newer release and shows a pill in
  the menu bar.

### Keyboard shortcuts

Press **?** for the full list. Highlights: ⌘N new card, ⌘Z / ⌘⇧Z undo /
redo, ⌘D duplicate, ⌘] / ⌘[ reorder, arrows nudge (⇧ 10 px), ⌘⇧H hide,
⌘⇧L lock, ⌘⌥C / ⌘⌥V copy / paste style, ⌘F search, B bleed, G guides,
P preview.

### Settings

Theme (ten dark, three light, or follow the system), interface font,
format, bleed, language (English / German), cover and logo sources, API
keys, custom fonts, the local libraries.

## Development

```bash
npm install
npm run dev            # web app on http://localhost:5173
npm run dev:electron   # Vite dev server + Electron window
npm run build          # typecheck + production build into dist/
npm test               # unit tests (vitest)
npm run lint           # oxlint
npm run dist           # package the desktop app into release/
```

Stack: Vite + React 19 + TypeScript, Tailwind CSS v4, shadcn/ui,
`react-konva` / `konva` for the canvas, `idb-keyval` for IndexedDB,
`fflate` for zips, `qrcode-generator` for QR codes. Path alias `@/` →
`src/`. UI primitives live in `src/components/ui/` (`components.json`
enables `npx shadcn@latest add <component>`).

**Tests** (`src/**/*.test.ts`, jsdom + fake-indexeddb) cover the pure
modules: face layer ordering and the background chain
(`faceLayers.ts`), placeholders, IGDB / TMDB metadata mapping, the local
libraries, the bleed migration, the alpha-mask sweep, gamelist parsing,
conditions, catalogue ordering. Konva rendering and dialogs are verified
by hand.

**CI** (`.github/workflows/ci.yml`) runs build, lint and tests on every
push; `build-desktop.yml` builds the three desktop packages on a `v*` tag
and drafts a GitHub release.

### Desktop app (Electron)

The same app packaged with electron-builder (`"build"` in
`package.json`): macOS `.dmg` (ad-hoc signed — the first launch needs
*right-click ▸ Open* or `xattr -dr com.apple.quarantine`), Windows
portable `.exe`, Linux `.AppImage` / `.deb`. Cover services block browser
CORS, so the browser version proxies them through Vite
(`vite.config.ts`) and the desktop app through the Electron main process:

| Purpose | Browser (Vite dev server) | Desktop (Electron) |
| --- | --- | --- |
| SteamGridDB / IGDB / Twitch / TMDB API | `server.proxy` | IPC `desktop:apiFetch` (`electron/main.ts`) |
| Load a cover image (CORS) | `/img?url=…` middleware | custom scheme `app-img://` |
| Zaparoo Core | `/zaparoo?ip=…` middleware | IPC `desktop:zaparooRpc` |

`src/desktop.ts` detects `window.desktop` (from `electron/preload.ts`) and
`src/covers.ts` / `src/zaparoo.ts` switch accordingly.

### Where things are

| Area | Files |
| --- | --- |
| Data model, storage | `src/types.ts`, `src/persist.ts` (IndexedDB), `src/workspace.ts` (projects), `src/backup.ts` |
| Formats, geometry | `src/formats.ts`, `src/card.ts`, `src/bleed.ts` |
| Editor | `src/store.tsx` (reducer, history, shortcuts), `src/components/EditorCanvas.tsx` + `components/canvas/` (layer drawing, interaction, snapping, outlines), `src/faceLayers.ts` (what a face draws, in what order) |
| Inspector | `src/components/Inspector.tsx` + `components/inspector/` (fields, per-kind props, masks & conditions, panels) |
| Layers | `src/factory.ts`, `src/masking.ts`, `src/templates.ts`, `src/maskSweep.ts`, `src/layerStyle.ts`, `src/layerClipboard.ts` (whole-layer copy/paste), `src/combineShape.ts` (union / subtract), `src/fillOverrides.ts` (editable-per-descendant fill), `src/textFlow.ts`, `src/textFit.ts` |
| Catalogue & metadata | `src/data/catalog.ts`, `src/gamelist.ts`, `src/metaFetch.ts`, `src/placeholders.ts`, `src/conditions.ts` |
| Covers, logos | `src/covers.ts`, `src/localLogos.ts` (both local libraries), `src/consoleLogos.ts`, `src/quickImport.ts`, `components/CoverSearchDialog.tsx` |
| Output | `src/export.ts`, `src/sheet.ts`, `src/pdf.ts`, `components/CardStage.tsx`, `components/CutSheetDialog.tsx`, `components/ExportAllDialog.tsx` |
| Misc | `src/i18n.ts` + `src/locale/de.ts`, `src/theme.ts`, `src/updateCheck.ts`, `src/storageUsage.ts`, `src/historyLabel.ts`, `src/recentColors.ts` |
| Desktop | `electron/main.ts`, `electron/preload.ts`, `src/desktop.ts`, `scripts/electron-afterpack.cjs` |

## Legal

Console and game logos as well as cover art are trademarked and / or
copyrighted — only use your own or licensed artwork, and keep the result
private.

## License

[MIT](LICENSE)
