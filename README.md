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
  - **Rechtsklick auf eine Konsole** → „Hinzufügen" oder „Umbenennen"
    (bei selbst hinzugefügten Konsolen zusätzlich „Entfernen").
    **Rechtsklick auf ein Spiel** → „Umbenennen" oder „Entfernen" (ein
    bereits angelegtes Design bleibt unter „Projekte"). Umbenennen ändert
    nur das Label – die interne ID (und damit `gameKey`, Vorlage und
    `gamelist.xml`) bleibt gleich, ein verknüpftes Design und der
    Metadaten-Eintrag (per Titel gematcht, wird mit umbenannt) bleiben
    erhalten. Die Änderungen liegen als Diff (hinzugefügte / entfernte /
    umbenannte Konsolen & Spiele) in `localStorage`
    (`stickerstudio:catalogOverlay`) und sind Teil des ZIP-Backups.
  - **Basis-Set** (Toolbar): übernimmt Konsolen/Spiele aus der
    mitgelieferten [`base_game_list.csv`](src/data/base_game_list.csv)
    (Top-N je Konsole, 27 Systeme). Dialog mit auswählbarem Baum, „Weiter"
    legt die markierten Einträge im Baum an **inklusive Metadaten** (Jahr,
    Publisher, Spieler, Genre, Wertung → jeweilige `gamelist.xml`). Nicht
    vorhandene Konsolen werden als eigene Konsolen angelegt; NES/SNES/… und
    Namensgleiche landen in der passenden bestehenden Konsole.
  - **Filter** (Trichter-Symbol neben „Alle Konsolen"): alle Spiele, nur
    Spiele **mit** Bild oder nur **ohne** Bild (= Design hat eine Bild-Ebene).
    Bei aktivem Filter zeigt die Klammer `sichtbar/gesamt`; die Auswahl
    bleibt in `localStorage` gespeichert. Das gerade offene Design zählt
    live mit.
- **Vorlagen-Hierarchie** (im Baum, von oben nach unten):
  - **Globale Vorlage** („Alle Konsolen") – Ebenen auf **jeder** Karte, egal
    welche Konsole. Projekt `tpl-global`. Ihr eigener Hintergrund ist immer
    an, und **Hilfslinien werden nur hier angelegt/bearbeitet** (siehe unten).
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
    gesetzte Quellen sind deaktiviert. **Standard ist „Von der globalen
    Vorlage"** – neue Karten übernehmen deren Hintergrund, bis man ihn
    umstellt.
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
- **Hauptbild + Haupt-Alpha-Maske**: Jede Spiel-Karte hat ein *Hauptbild*
  (Bild-Ebene, Checkbox „Hauptbild" im Inspector; „Cover suchen" und „Quick
  Import" setzen es automatisch, sonst gilt das einzige Bild der Karte).
  Bei **„Alle Konsolen"** legt man **eine** *Haupt-Alpha-Maske* an
  („+ Form → Haupt-Alpha-Maske" oder Checkbox an einer Form/einem Bild).
  Deren Alpha-Kanal beschneidet auf **jeder** Karte automatisch das
  Hauptbild – der Rahmen wird also nur einmal gestaltet. Die Maskenform
  selbst wird auf den Karten nicht gezeichnet. **Ein frisch eingefügtes
  Hauptbild wird automatisch so skaliert, dass es die Maske voll ausfüllt**
  (Höhe *und* Breite, Seitenverhältnis bleibt, Überstand wird beschnitten)
  und auf die Maskenmitte gesetzt.
- **Ebenen**: Bilder, Formen, beliebig viele Textebenen. Auswählen,
  verschieben, skalieren, drehen, sperren, ausblenden, duplizieren.
  Reihenfolge per **Drag & Drop** in der Ebenenliste (Greifpunkt links,
  Drop-Linie zeigt die Zielposition).
- **Bilder**: „+ Bild" → Datei hochladen oder von einer URL einfügen
  (PNG/JPG/SVG/WebP …). URL-Bilder werden heruntergeladen und ins Projekt
  eingebettet – der Host muss Cross-Origin-Zugriff erlauben, sonst kommt ein
  Hinweis. Große Bilder werden auf max. 2400 px heruntergerechnet.
- **Cover suchen**: bei einer offenen Spiel-Karte sucht der Button „Cover
  suchen" (Toolbar) anhand von Konsole + Spieltitel nach Box-Art. Ein
  Dialog zeigt die Treffer als Vorschau; anklicken lädt das Bild herunter,
  bettet es ein und legt es als Hauptbild-Ebene an (derselbe Pfad wie „Von
  URL einfügen"). Die Quelle wird oben im Dialog umgeschaltet, Zugangsdaten
  liegen in `localStorage`.
  - Auf **„Alle Konsolen"** geht derselbe Button **alle Karten ohne Bild
    nacheinander durch**: pro Karte der Such-Dialog mit Zähler „Cover
    3 / 25", ein Klick fügt das Cover ins jeweilige Design ein (legt es bei
    Bedarf an) und springt zur nächsten Karte; „Überspringen" lässt eine
    Karte aus.
  - **SteamGridDB**: API-Key (kostenlos unter
    [steamgriddb.com](https://www.steamgriddb.com/profile/preferences/api)).
    Alle Konsolen, hochauflösendes Box-Art, viele Varianten.
  - **IGDB**: Twitch-Client-ID + -Secret (kostenlos unter
    [dev.twitch.tv](https://dev.twitch.tv/console/apps)). Offizielles Cover
    + Artworks pro Spiel.
  - **Ohne Zugangsdaten**: Fallback auf
    [libretro-thumbnails](https://github.com/libretro-thumbnails) (statische
    Scans auf GitHub, kein Key) – nur Retro-/Emulations-Konsolen (NES/SNES/
    N64, Mega Drive/Genesis, PlayStation 1–4, GameCube/Wii …).

  SteamGridDBs API/CDN und IGDBs API blockieren Browser-CORS (IGDB braucht
  zudem einen Twitch-OAuth-Token). Ohne Backend laufen diese Aufrufe über
  den Proxy `proxy.cors.sh` (für localhost kostenlos); SteamGridDB-Bilder
  über `wsrv.nl`, IGDB-Bilder direkt (deren CDN sendet CORS-Header).
  Siehe [src/covers.ts](src/covers.ts).
- **Quick Import** (Toolbar): Sammel-Import für Bilder. Öffnet eine Tabelle
  mit allen Spielen, deren Design noch keine Bild-Ebene hat (Spalten
  Konsole / Spiel / URL). Je eine Bild-URL eintragen, „Fertig" – jede URL
  wird geladen, eingebettet und als Bild-Ebene ins jeweilige Design gelegt
  (fehlt das Design noch, wird es angelegt). Fehlgeschlagene URLs (CORS,
  404, kein Bild) bleiben mit Fehlermeldung stehen und lassen sich erneut
  versuchen. Siehe [src/quickImport.ts](src/quickImport.ts).
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
- **Demo-Modus** (Toolbar-Button „Demo"): Booster-Pack-Simulation. Erst
  wählst du eine Konsole oder „Alle Konsolen", dann liegt ein geschlossenes
  Pack mit 12 zufälligen Karten da. Ein Klick reißt es auf – die Karten
  fliegen per 3D-Animation heraus und legen sich als Raster ab. Mit **10 %
  Wahrscheinlichkeit** ist eine davon **holografisch** (goldener Rahmen +
  Foil-Schimmer). Jede Karte lässt sich anklicken und in derselben
  3D-Ansicht wie die Vorschau frei drehen; ← → oder die Pfeil-Buttons
  blättern durch das Pack. Die Karten werden dafür mit derselben
  Konva-Pipeline wie im Editor gerendert (inkl. Vorlagen, Masken und
  Haupt-Alpha-Maske), Spiele ohne Design bekommen eine Titel-Platzhalterkarte.
  Siehe [src/demo.ts](src/demo.ts) und
  [src/components/DemoMode.tsx](src/components/DemoMode.tsx).
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
  (Konsolenname im Baum anklicken). Nur bei einer offenen **Spiel-Karte**
  hat die Sidebar rechts einen **Tab „Metadaten"** (Vorlagen haben keinen):
  er zeigt den per Titel aus der geladenen `gamelist.xml` gefundenen
  Eintrag als
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

- **Sprache**: Umschalter oben rechts (Weltkugel-Icon) zwischen **English**
  (Standard) und **Deutsch**. Die Wahl liegt in `localStorage`
  (`stickerstudio:lang`); alle Texte kommen aus [src/i18n.ts](src/i18n.ts)
  mit der Übersetzungstabelle [src/locale/de.ts](src/locale/de.ts) (die
  englischen Strings im Code sind die Schlüssel).

- **Vorder- & Rückseite**: „＋ Rückseite" legt eine zweite Fläche für die
  Karte an; danach schaltet ein **Vorderseite | Rückseite**-Umschalter um.
  Jede Seite hat eigene Ebenen und Hintergrund; die Rückseite erscheint auch
  in der 3D-Vorschau und im Export (`_front` / `_back`).

- **Format**: globaler Umschalter oben rechts (Formen-Icon) zwischen
  **Kreditkarte**, **Kassetten-Label**, **Disketten-Label**,
  **DVD-Hüllen-Einleger** und **Kassettenhülle (J-Card)**. Definiert in
  [src/formats.ts](src/formats.ts) (Maße dort anpassbar); die Wahl liegt in
  `localStorage` (`stickerstudio:format`), ein Wechsel lädt die Seite neu.
  Jedes Format hat eigene Designs, eigene Vorlagen („Alle Konsolen" /
  Konsolen-Vorlagen, id-Suffix `--<format>`) und einen eigenen Spiel-Index.

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
| `src/formats.ts` | Sticker-Formate (Maße, Bleed, Radius) + aktive Auswahl |
| `src/card.ts` | Maße des aktiven Formats, DPI, abgeleitete Pixelwerte |
| `src/background.ts` | Hintergrund normalisieren, Verlaufspunkte, Noise-Kachel |
| `src/masking.ts` | Ebenenstapel in Plain-/Masken-Segmente aufteilen |
| `src/data/catalog.ts` | Seed-Konsolen + lokaler Overlay (Konsolen/Spiele hinzufügen/umbenennen/entfernen) |
| `src/components/GameTree.tsx` | Baumansicht links (inkl. Rechtsklick-Menü) |
| `src/components/ContextMenu.tsx` | Minimales Rechtsklick-Menü (ohne Extra-Dependency) |
| `src/gameIndex.ts` | Zuordnung Spiel → Projekt-ID (localStorage) |
| `src/types.ts` | Datenmodell (Layer, Project) |
| `src/i18n.ts` | Sprachumschaltung (EN/DE), `t()`-Funktion + `useT()`-Hook |
| `src/locale/de.ts` | Deutsche Übersetzungstabelle (Schlüssel = englischer Text) |
| `src/store.tsx` | Reducer, Undo/Redo, Autosave, Shortcuts |
| `src/components/EditorCanvas.tsx` | Konva-Bühne, Transformer, Hilfslinien |
| `src/components/Toolbar.tsx` | Ebene hinzufügen, Export, Projekte |
| `src/components/Inspector.tsx` | Eigenschaften der ausgewählten Ebene |
| `src/export.ts` | PNG-Rendering mit Beschnitt & Schnittmarken |
| `src/persist.ts` | IndexedDB-Speicherung (`idb-keyval`) |
| `src/backup.ts` | Komplett-Backup als ZIP (`fflate`), Bilder als Dateien |
| `src/gamelist.ts` | gamelist.xml parsen/speichern, Metadaten per Titel matchen, Live-Update-Subscription |
| `src/components/MetadataPanel.tsx` | Sidebar-Tab „Metadaten" (editierbares Formular) |
| `src/covers.ts` | Cover-Suche: SteamGridDB / IGDB (Keys, via CORS-Proxy) oder libretro-thumbnails |
| `src/data/baseGameList.ts` | `base_game_list.csv` parsen (Konsolen/Spiele + Metadaten) |
| `src/components/BaseImportDialog.tsx` | „Basis-Set": Auswahlbaum + Übernahme inkl. Metadaten |
| `src/quickImport.ts` | Sammel-Import: Spiele ohne Bild finden, URLs als Ebene laden |
| `src/components/CoverSearchDialog.tsx` | Auswahl-Dialog für gefundene Cover (mit Sweep-Modus) |
| `src/components/CoverSweepDialog.tsx` | „Alle Konsolen": alle bildlosen Karten nacheinander |
| `src/demo.ts` | Demo-Modus: Booster-Pack ziehen (Zufallskarten, Holo-Chance) |
| `src/components/DemoMode.tsx` | Pack-Öffnen-Animation, Kartenraster, 3D-Einzelansicht |
| `src/components/CardStage.tsx` | Karte read-only rendern & als PNG abgreifen |
| `public/gamelists/*.xml` | Beispiel-gamelist.xml je Konsole |

## Rechtliches

Konsolen- und Spielelogos sowie Cover-Art sind marken- bzw.
urheberrechtlich geschützt – lade nur eigene oder lizenzierte Grafiken hoch
und nutze das Ergebnis privat.
