# Kreditkarten-Sticker Studio

Browser-App zum Designen von Stickern in Kreditkartengröße (ISO ID-1,
85,6 × 54 mm) für Konsolen. Läuft komplett lokal – keine Server, kein Login.

## Features

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
- **Export**:
  - PNG Endformat (85,6 × 54 mm, 300 DPI ≈ 1011 × 638 px)
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
