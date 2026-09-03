# Kreditkarten-Sticker Studio

Browser-App zum Designen von Stickern in Kreditkartengröße (ISO ID-1,
hochkant 54 × 85,6 mm) für Konsolen. Läuft komplett lokal – keine Server,
kein Login.

UI mit **shadcn/ui** (Radix + Tailwind CSS v4, „new-york"-Stil, Dark-Theme).
UI-Primitives liegen in `src/components/ui/`, `components.json` erlaubt
`npx shadcn@latest add <komponente>`.

## Features

- **Konsolen-/Spiele-Baum** (links): 5 Beispielkonsolen mit je den Top 10
  Spielen ([src/data/catalog.ts](src/data/catalog.ts)). Ein Spiel auswählen
  legt ein Sticker-Design dafür an (mit Titel-Textebene) bzw. öffnet das
  bereits vorhandene – die Zuordnung Spiel→Design steht in `localStorage`.
- **Konsolen-Vorlage**: den Konsolennamen im Baum anklicken öffnet eine
  gemeinsame Ebenen-Vorlage. Deren Bilder/Logos/Texte werden automatisch
  auf **allen** Spiel-Karten dieser Konsole angezeigt (schreibgeschützt,
  über dem Karteninhalt) und landen im PNG-Export. Gespeichert als
  Projekt `tpl-<konsole>`, wird nicht in der Projektliste geführt.
- **Kartenhintergrund**: einfarbig **oder** Farbverlauf (zwei Farben +
  Richtung), dazu ein optionaler Körnungs-/Noise-Overlay (0–100 %,
  Overlay-Blend). Wird in den PNG-Export übernommen.
- **Ebenen**: Hintergrundbild, Konsolenlogos, beliebig viele Textebenen.
  Auswählen, verschieben, skalieren, drehen, sperren, ausblenden,
  Reihenfolge ändern, duplizieren.
- **Bilder**: „+ Bild" → Datei hochladen oder von einer URL einfügen
  (PNG/JPG/SVG/WebP …). URL-Bilder werden heruntergeladen und ins Projekt
  eingebettet – der Host muss Cross-Origin-Zugriff erlauben, sonst kommt ein
  Hinweis. Große Bilder werden auf max. 2400 px heruntergerechnet.
- **Logo-Presets**: 6 neutrale, generische Platzhaltermarken (`src/assets/logos.ts`).
  Eigene Artwork-Dateien einfach als Bild hochladen.
- **Schriften**: System-Fonts + Google Fonts (Oswald, Bebas Neue,
  Montserrat, Press Start 2P, Rubik Mono One). Farbe, Kontur, Ausrichtung,
  Zeilenhöhe, Laufweite.
- **Hilfslinien**: Beschnittkante (3 mm), Endformat, Sicherheitszone (3 mm).
  Standardmäßig **aus** – die Vorschau zeigt die reine Karte, auf das
  Endformat mit abgerundeten Ecken zugeschnitten.
- **Export**:
  - PNG Endformat (54 × 85,6 mm, 300 DPI ≈ 638 × 1011 px)
  - PNG mit 3 mm Beschnitt
  - PNG mit Beschnitt + Schnittmarken
  - Projekt als `.json` (Bilder eingebettet) speichern / laden
- **Autosave** in IndexedDB, mehrere Designs über den „Projekte"-Dialog.
- **Shortcuts**: ⌘Z / ⌘⇧Z (Undo/Redo), Entf (Ebene löschen), Esc (Auswahl aufheben).

## Entwicklung

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # Produktions-Build nach dist/
```

Stack: Vite + React 19 + TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`),
shadcn/ui, `react-konva`/`konva` für die Zeichenfläche, `idb-keyval` für die
IndexedDB-Speicherung. Pfad-Alias `@/` → `src/`.

## Aufbau

| Datei | Zweck |
| --- | --- |
| `src/card.ts` | Kartenmaße, DPI, abgeleitete Pixelwerte |
| `src/background.ts` | Hintergrund normalisieren, Verlaufspunkte, Noise-Kachel |
| `src/data/catalog.ts` | Beispiel-Konsolen und ihre Top-10-Spiele |
| `src/components/GameTree.tsx` | Baumansicht links |
| `src/gameIndex.ts` | Zuordnung Spiel → Projekt-ID (localStorage) |
| `src/types.ts` | Datenmodell (Layer, Project) |
| `src/store.tsx` | Reducer, Undo/Redo, Autosave, Shortcuts |
| `src/components/EditorCanvas.tsx` | Konva-Bühne, Transformer, Hilfslinien |
| `src/components/Toolbar.tsx` | Ebene hinzufügen, Export, Projekte |
| `src/components/Inspector.tsx` | Eigenschaften der ausgewählten Ebene |
| `src/export.ts` | PNG-Rendering mit Beschnitt & Schnittmarken |
| `src/persist.ts` | IndexedDB-Speicherung (`idb-keyval`) |

## Rechtliches

Die mitgelieferten Logos sind generische Platzhalter. Echte Konsolen- und
Spielelogos sind markenrechtlich geschützt – lade dafür eigene, lizenzierte
Grafiken hoch.
