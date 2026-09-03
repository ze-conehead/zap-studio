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
- **Vorlagen-Hierarchie** (im Baum, von oben nach unten):
  - **Globale Vorlage** („Alle Konsolen") – Ebenen auf **jeder** Karte, egal
    welche Konsole. Projekt `tpl-global`.
  - **Konsolen-Vorlage** (Konsolenname anklicken) – Ebenen auf allen
    Spiel-Karten dieser Konsole. Projekt `tpl-<konsole>`.
  - **Spiel-Design** – die Karte selbst.

  Render-Reihenfolge auf einer Karte (unten → oben): Kartenhintergrund →
  Spiel-Ebenen → Konsolen-Vorlage → globale Vorlage. Vorlagen-Ebenen sind
  auf der Spiel-Karte schreibgeschützt und landen im PNG-Export. Beim
  Bearbeiten einer Konsolen-Vorlage wird die globale Vorlage als Kontext
  eingeblendet. Vorlagen erscheinen nicht in der Projektliste.
- **Kartenhintergrund**: einfarbig **oder** Farbverlauf (zwei Farben +
  Richtung), dazu ein optionaler Körnungs-/Noise-Overlay (0–100 %,
  Overlay-Blend). Wird in den PNG-Export übernommen.
  - Auch die **globale Vorlage** und jede **Konsolen-Vorlage** können einen
    eigenen Hintergrund festlegen (Checkbox „Eigenen Hintergrund für diese
    Vorlage").
  - Jede Karte wählt unter **Hintergrund-Quelle**: eigener Hintergrund,
    „Von der Konsolen-Vorlage" oder „Von der globalen Vorlage". Nicht
    gesetzte Quellen sind deaktiviert.
- **Formen**: „+ Form" → Kapsel, Quadrat/Rechteck, Kreis. Jede Form hat
  dieselbe Füllung wie die Karte (einfarbig **oder** Farbverlauf) plus
  optionalen Noise-Overlay, dazu Kontur/Konturstärke und beim Rechteck
  einen Ecken-Radius.
- **Alpha-Maske**: jede Ebene (Form, Bild oder Text) kann im Inspector als
  **Maske** markiert werden – ihr Alpha-Kanal beschneidet die Ebene(n)
  direkt darunter (`»In Maske«`). So legt man z. B. einen Kreis obenauf und
  lädt darunter ein Bild „in den Kreis". Die verdeckte Ebene bleibt
  frei verschiebbar; die Maske selbst wählt man über die Ebenenliste aus.
  - **Mehrere Ebenen pro Maske**: im Masken-Inspector „Ebene aufnehmen" /
    „Oberste lösen" bzw. „In Maske" bei den einzelnen Ebenen.
  - **Ebenen mitbewegen** (Checkbox an der Maske, optional): Verschieben,
    Skalieren und Drehen der Maske wirkt dann auf alle Ebenen in der Maske.
  - „Maske auflösen" gibt Maske + alle Kinder wieder frei.

  Umgesetzt über `globalCompositeOperation: "destination-in"` je Masken-
  gruppe in einem eigenen Konva-Layer – landet 1:1 im PNG-Export.
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
| `src/masking.ts` | Ebenenstapel in Plain-/Masken-Segmente aufteilen |
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
