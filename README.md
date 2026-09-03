# Kreditkarten-Sticker Studio

Browser-App zum Designen von Stickern in Kreditkartengröße (ISO ID-1,
hochkant 54 × 85,6 mm) für Konsolen. Läuft komplett lokal – keine Server,
kein Login.

## Features

- **Konsolen-/Spiele-Baum** (links): 5 Beispielkonsolen mit je den Top 10
  Spielen ([src/data/catalog.ts](src/data/catalog.ts)). Ein Spiel auswählen
  legt ein Sticker-Design dafür an (mit Titel-Textebene) bzw. öffnet das
  bereits vorhandene – die Zuordnung Spiel→Design steht in `localStorage`.
- **Ebenen**: Hintergrundbild, Konsolenlogos, beliebig viele Textebenen.
  Auswählen, verschieben, skalieren, drehen, sperren, ausblenden,
  Reihenfolge ändern, duplizieren.
- **Bild-Upload**: PNG/JPG/SVG per Datei-Dialog. Große Bilder werden auf
  max. 2400 px heruntergerechnet, damit das Projekt klein bleibt.
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

## Aufbau

| Datei | Zweck |
| --- | --- |
| `src/card.ts` | Kartenmaße, DPI, abgeleitete Pixelwerte |
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
