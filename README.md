# Kreditkarten-Sticker Studio

Browser-App zum Designen von Stickern in Kreditkartengröße (ISO ID-1,
hochkant 54 × 85,6 mm) für Konsolen. Läuft komplett lokal – keine Server,
kein Login.

UI mit **shadcn/ui** (Radix + Tailwind CSS v4, „new-york"-Stil, Dark-Theme).
UI-Primitives liegen in `src/components/ui/`, `components.json` erlaubt
`npx shadcn@latest add <komponente>`.

## Features

- **Konsolen-/Spiele-Baum** (links): 5 Klassik-Konsolen (PlayStation,
  Nintendo 64, Super Nintendo, NES, Neo Geo) mit je den Top 5 Spielen
  ([src/data/catalog.ts](src/data/catalog.ts)). Ein Spiel auswählen
  legt ein Sticker-Design dafür an (mit Titel-Textebene) bzw. öffnet das
  bereits vorhandene – die Zuordnung Spiel→Design steht in `localStorage`.
  Hinter „Alle Konsolen" und jeder Konsole steht in Klammern die
  Spielanzahl darunter.
  - **Rechtsklick auf eine Konsole** → „Neues Spiel hinzufügen …" oder
    „Konsole umbenennen …". **Rechtsklick auf ein Spiel** → „Spiel
    umbenennen …" oder „Spiel entfernen" (ein bereits angelegtes Design
    bleibt unter „Projekte"). Umbenennen ändert nur das Label – die interne
    ID (und damit `gameKey`, Vorlage und `gamelist.xml`) bleibt gleich, ein
    verknüpftes Design und der Metadaten-Eintrag (per Titel gematcht, wird
    mit umbenannt) bleiben erhalten. Die Änderungen liegen als Diff
    (hinzugefügte Spiele / ausgeblendete Seed-Einträge / umbenannte
    Konsolen & Spiele) in `localStorage` (`stickerstudio:catalogOverlay`)
    und sind Teil des ZIP-Backups; ein entferntes Seed-Spiel mit gleichem
    Titel wieder hinzufügen blendet es einfach wieder ein.
  - **Filter** (Trichter-Symbol neben „Alle Konsolen"): alle Spiele, nur
    Spiele **mit** Bild oder nur **ohne** Bild (= Design hat eine Bild-Ebene).
    Bei aktivem Filter zeigt die Klammer `sichtbar/gesamt`; die Auswahl
    bleibt in `localStorage` gespeichert. Das gerade offene Design zählt
    live mit.
- **Vorlagen-Hierarchie** (im Baum, von oben nach unten):
  - **Globale Vorlage** („Alle Konsolen") – Ebenen auf **jeder** Karte, egal
    welche Konsole. Projekt `tpl-global`. Hat keinen „Metadaten"-Tab, ihr
    eigener Hintergrund ist immer an, und **Hilfslinien werden nur hier
    angelegt/bearbeitet** (siehe unten).
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
  - Jede **Konsolen-Vorlage** kann einen eigenen Hintergrund festlegen
    (Checkbox „Eigenen Hintergrund für diese Vorlage"); die **globale
    Vorlage** hat immer einen (kein Opt-in).
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
  duplizieren. Reihenfolge per **Drag & Drop** in der Ebenenliste
  (Greifpunkt links, Drop-Linie zeigt die Zielposition).
- **Bilder**: „+ Bild" → Datei hochladen oder von einer URL einfügen
  (PNG/JPG/SVG/WebP …). URL-Bilder werden heruntergeladen und ins Projekt
  eingebettet – der Host muss Cross-Origin-Zugriff erlauben, sonst kommt ein
  Hinweis. Große Bilder werden auf max. 2400 px heruntergerechnet.
- **Cover suchen**: bei einer offenen Spiel-Karte sucht der Button „Cover
  suchen" (Toolbar) anhand von Konsole + Spieltitel automatisch nach
  Box-Art – kostenlos, ohne Anmeldung, über die community-gepflegte
  [libretro-thumbnails](https://github.com/libretro-thumbnails)-Sammlung auf
  GitHub. Ein Dialog zeigt alle passenden Treffer (verschiedene
  Regionen/Editionen) als Vorschau; anklicken lädt das hochauflösende
  Original herunter und fügt es als neue Bild-Ebene ein (derselbe Pfad wie
  „Von URL einfügen"). Abgedeckt sind Retro-/Emulations-Konsolen (u. a.
  NES/SNES/N64, Mega Drive/Genesis, PlayStation 1–4, GameCube/Wii/Wii U,
  Xbox/360 …) – für aktuelle Konsolen ohne Emulation (z. B. Switch, PS5,
  Xbox Series) gibt es dort keine Datenbank; der Dialog weist dann auf das
  manuelle Einfügen per URL hin. Siehe [src/covers.ts](src/covers.ts).
- **Quick Import** (Toolbar): Sammel-Import für Bilder. Öffnet eine Tabelle
  mit allen Spielen, deren Design noch keine Bild-Ebene hat (Spalten
  Konsole / Spiel / URL). Je eine Bild-URL eintragen, „Fertig" – jede URL
  wird geladen, eingebettet und als Bild-Ebene ins jeweilige Design gelegt
  (fehlt das Design noch, wird es angelegt). Fehlgeschlagene URLs (CORS,
  404, kein Bild) bleiben mit Fehlermeldung stehen und lassen sich erneut
  versuchen. Siehe [src/quickImport.ts](src/quickImport.ts).
- **Logo-Presets**: 6 neutrale, generische Platzhaltermarken (`src/assets/logos.ts`).
  Eigene Artwork-Dateien einfach als Bild hochladen.
- **Schriften**: System-Fonts + Google Fonts (Oswald, Bebas Neue,
  Montserrat, Press Start 2P, Rubik Mono One). Farbe, Kontur, Ausrichtung,
  Zeilenhöhe, Laufweite.
- **Hilfslinien**: Beschnittkante (3 mm), Endformat, Sicherheitszone (3 mm).
  Standardmäßig **aus** – die Vorschau zeigt die reine Karte, auf das
  Endformat mit abgerundeten Ecken zugeschnitten.
- **Eigene Hilfslinien**: vertikale/horizontale Linien, die auf **allen**
  Karten erscheinen. Angelegt und bearbeitet werden sie **nur bei „Alle
  Konsolen"** (Toolbar-Lineal-Menü + „Hilfslinien"-Panel im Inspector,
  „Hilfslinien"-Checkbox an/aus). Auf der Karte ziehen zum Positionieren,
  über den Rand ziehen oder Papierkorb im Inspector zum Löschen, mm-genaue
  Eingabe im Inspector. Auf Spiel-Karten und Konsolen-Vorlagen werden sie
  nur angezeigt (nicht verschiebbar). Global in `localStorage` gespeichert,
  nicht im PNG-Export.
- **3D-Vorschau**: Button in der Toolbar öffnet die Karte als 3D-Objekt
  (CSS-Perspektive), mit der Maus frei drehbar. Checkbox „Holographische
  Karte" legt einen Regenbogen-Foil-/Glitzer-/Glanz-Effekt darüber, der
  sich mit der Drehung verändert. Nutzt den Endformat-Export (ohne
  Hilfslinien).
- **Export**:
  - PNG Endformat (54 × 85,6 mm, 300 DPI ≈ 638 × 1011 px)
  - PNG mit 3 mm Beschnitt
  - PNG mit Beschnitt + Schnittmarken
  - Einzelnes Projekt als `.json` (Bilder eingebettet) speichern / laden
  - **Komplett-Backup als `.zip`**: alle Projekte, Vorlagen (global +
    Konsole), Hilfslinien, der Spiel-Index und die Baum-Änderungen
    (hinzugefügte/entfernte Spiele); Bilder als echte, deduplizierte
    Dateien unter `assets/`. Laden übernimmt alles (gleiche IDs werden
    überschrieben) und lädt die Seite neu.
- **Autosave** in IndexedDB, mehrere Designs über den „Projekte"-Dialog.
- **Shortcuts**: ⌘Z / ⌘⇧Z (Undo/Redo), Entf (Ebene löschen), Esc (Auswahl aufheben).
- **gamelist.xml / Metadaten**: pro Konsole eine eigene `gamelist.xml`
  hochladbar (EmulationStation-Format: `<name>`, `<desc>`, `<image>`,
  `<releasedate>`, `<developer>`, `<publisher>`, `<genre>`, `<players>`,
  `<rating>`) – im Konsolen-Vorlage-Panel unter „Eigenschaften"
  (Konsolenname im Baum anklicken). Die Sidebar rechts hat dafür einen
  eigenen **Tab „Metadaten"**: bei einer offenen Spiel-Karte zeigt er den
  per Titel aus der geladenen `gamelist.xml` gefundenen Eintrag als
  **editierbares Formular** – Sterne-Wertung anklicken (linke/rechte
  Hälfte eines Sterns für halbe Schritte, 0,5er-Genauigkeit), Bild-URL/-Pfad,
  Beschreibung, Release-Datum, Entwickler, Publisher, Genre und Spieler-
  zahl direkt bearbeiten, jede Änderung wird sofort in die `gamelist.xml`
  des Spiels zurückgeschrieben. Gibt es noch keinen Eintrag, startet das
  Formular leer und legt beim ersten Ausfüllen automatisch einen neuen
  Eintrag an; ein Papierkorb-Button löscht ihn wieder. Beispiel-Dateien
  für alle 5 Konsolen liegen unter `public/gamelists/` und lassen sich im
  Panel direkt per „Beispiel laden" einspielen. Rein lokal in
  `localStorage`, nicht Teil des PNG-Exports.
  - **Metadaten-Ebenen** (im „+ Form"-Menü, Abschnitt „Aus gamelist.xml"):
    besondere, konfigurierbare Ebenen, die auf Konsolen-/globaler
    Vorlagenebene platziert werden und live aus der `gamelist.xml` des
    jeweils geöffneten Spiels lesen – pro Karte automatisch die richtigen
    Werte, ohne pro Spiel neu gepflegt werden zu müssen. Einzeln
    hinzufügbar für **Bewertung** (★, aus 5), **Erscheinungsjahr** oder
    **Spieleranzahl** (jede frei positionier- und skalierbar), oder als
    „Alle kombiniert" in einer Ebene. Das **Spieler-Icon ist
    konfigurierbar** (automatisch Einzel-/Mehrspieler anhand der
    Spielerzahl, oder fest Einzelspieler / Mehrspieler / Controller), dazu
    Text-/Sternfarbe und ein optionaler Hintergrund-Chip. Beim Bearbeiten
    einer Konsolen-Vorlage zeigen die Ebenen zur Vorschau die Daten des
    ersten geladenen gamelist-Eintrags; ohne passende Daten erscheinen
    „–"-Platzhalter statt erfundener Werte. Rendert komplett aus
    Konva-Primitiven (kein Bild-Icon), landet also unverändert im
    PNG-Export.

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
| `src/data/catalog.ts` | Seed-Konsolen + Top-10, plus lokaler Overlay (Spiele hinzufügen/entfernen) |
| `src/components/GameTree.tsx` | Baumansicht links (inkl. Rechtsklick-Menü) |
| `src/components/ContextMenu.tsx` | Minimales Rechtsklick-Menü (ohne Extra-Dependency) |
| `src/gameIndex.ts` | Zuordnung Spiel → Projekt-ID (localStorage) |
| `src/types.ts` | Datenmodell (Layer, Project) |
| `src/store.tsx` | Reducer, Undo/Redo, Autosave, Shortcuts |
| `src/components/EditorCanvas.tsx` | Konva-Bühne, Transformer, Hilfslinien |
| `src/components/Toolbar.tsx` | Ebene hinzufügen, Export, Projekte |
| `src/components/Inspector.tsx` | Eigenschaften der ausgewählten Ebene |
| `src/export.ts` | PNG-Rendering mit Beschnitt & Schnittmarken |
| `src/persist.ts` | IndexedDB-Speicherung (`idb-keyval`) |
| `src/backup.ts` | Komplett-Backup als ZIP (`fflate`), Bilder als Dateien |
| `src/gamelist.ts` | gamelist.xml parsen/speichern, Metadaten per Titel matchen, Live-Update-Subscription |
| `src/components/MetadataPanel.tsx` | Sidebar-Tab „Metadaten" (editierbares Formular) |
| `src/covers.ts` | Cover-Suche über libretro-thumbnails (GitHub, kein API-Key) |
| `src/quickImport.ts` | Sammel-Import: Spiele ohne Bild finden, URLs als Ebene laden |
| `src/components/CoverSearchDialog.tsx` | Auswahl-Dialog für gefundene Cover |
| `public/gamelists/*.xml` | Beispiel-gamelist.xml je Konsole |

## Rechtliches

Die mitgelieferten Logos sind generische Platzhalter. Echte Konsolen- und
Spielelogos sind markenrechtlich geschützt – lade dafür eigene, lizenzierte
Grafiken hoch.
