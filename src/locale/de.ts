// German translations. Keys are the English source strings used in the
// code; {tokens} are filled in by t(). Anything missing here falls back to
// the English key.

export const de: Record<string, string> = {
  // ── App shell ────────────────────────────────────────────────────────────
  "loading …": "lädt …",

  // ── Toolbar ──────────────────────────────────────────────────────────────
  Global: "Global",
  Template: "Vorlage",
  unsaved: "nicht gespeichert",
  saved: "gespeichert",
  Text: "Text",
  Image: "Bild",
  "Upload file …": "Datei hochladen …",
  "Add from URL": "Von URL einfügen",
  "https://…/image.png": "https://…/bild.png",
  "Find cover": "Cover suchen",
  "Find covers": "Cover suchen",
  "Insert cover by URL": "Cover per URL einfügen",
  "Image URL for the cover:": "Bild-URL für das Cover:",
  Shape: "Form",
  Square: "Quadrat",
  Circle: "Kreis",
  Capsule: "Kapsel",
  "From gamelist.xml": "Aus gamelist.xml",
  Rating: "Bewertung",
  "Release year": "Erscheinungsjahr",
  "Player count": "Spieleranzahl",
  "All combined": "Alle kombiniert",
  "Main alpha mask": "Haupt-Alpha-Maske",
  "Undo (⌘Z)": "Rückgängig (⌘Z)",
  "Redo (⌘⇧Z)": "Wiederholen (⌘⇧Z)",
  Bleed: "Beschnitt",
  Guides: "Hilfslinien",
  Snap: "Einrasten",
  "Add guide": "Hilfslinie hinzufügen",
  "Vertical guide": "Vertikale Hilfslinie",
  "Horizontal guide": "Horizontale Hilfslinie",
  "3D preview": "3D-Vorschau",
  "Project file": "Projektdatei",
  "Save as JSON": "Als JSON speichern",
  "Open JSON project …": "JSON-Projekt öffnen …",
  "Full backup": "Komplett-Backup",
  "Save backup (.zip)": "Backup (.zip) speichern",
  "Load backup (.zip) …": "Backup (.zip) laden …",
  "Import consoles & games from the base list (base_game_list.csv)":
    "Konsolen & Spiele aus der Basis-Liste (base_game_list.csv) übernehmen",
  "Base set": "Basis-Set",
  "Enter image URLs for every game without an image in a table":
    "Bild-URLs für alle Spiele ohne Bild in einer Tabelle eintragen",
  Projects: "Projekte",
  New: "Neu",
  "Add back side": "Rückseite hinzufügen",
  Front: "Vorderseite",
  Back: "Rückseite",
  "Back background": "Hintergrund Rückseite",
  "Remove back side": "Rückseite entfernen",
  "Remove the back side? Its layers are deleted.":
    "Rückseite entfernen? Ihre Ebenen werden gelöscht.",
  "Packing backup …": "Backup wird gepackt …",
  "Loading backup …": "Backup wird geladen …",
  "Loading image …": "Bild wird geladen …",
  "Loading cover …": "Cover wird geladen …",
  "Generating PNG …": "PNG wird erzeugt …",
  "Load backup? Projects and templates from the file are imported (existing ones with the same ID are overwritten). The page then reloads.":
    "Backup laden? Projekte und Vorlagen aus der Datei werden übernommen (vorhandene mit gleicher ID überschrieben). Die Seite wird danach neu geladen.",
  "{projects} project(s) and {templates} template(s) imported.":
    "{projects} Projekt(e) und {templates} Vorlage(n) übernommen.",
  Language: "Sprache",
  English: "Englisch",
  German: "Deutsch",

  // ── Export labels ────────────────────────────────────────────────────────
  "PNG – final size ({w} × {h} mm)": "PNG – Endformat ({w} × {h} mm)",
  "PNG – with {n} mm bleed": "PNG – mit {n} mm Beschnitt",
  "PNG – bleed + crop marks": "PNG – Beschnitt + Schnittmarken",

  // ── Formats ──────────────────────────────────────────────────────────────
  Format: "Format",
  "Credit card": "Kreditkarte",
  "Cassette label": "Kassetten-Label",
  "Floppy disk label": "Disketten-Label",
  "DVD case wrap": "DVD-Hüllen-Wrap",
  "Cassette case (J-card)": "Kassettenhülle (J-Card)",
  Spine: "Rücken",
  Flap: "Lasche",
  "Fold lines dashed": "Faltlinien gestrichelt",

  // ── Factory defaults (layer / project names) ─────────────────────────────
  "New sticker design": "Neues Sticker-Design",
  "Global template": "Globale Vorlage",
  "{name} – template": "{name} – Vorlage",
  "Your text": "Dein Text",
  "Rating & info": "Bewertung & Infos",
  "{name} copy": "{name} Kopie",
  "Imported design": "Importiertes Design",

  // ── image.ts ─────────────────────────────────────────────────────────────
  "Please choose an image file.": "Bitte eine Bilddatei wählen.",
  "Invalid URL.": "Ungültige URL.",
  "Only http(s) URLs are supported.": "Nur http(s)-URLs werden unterstützt.",
  "The image could not be loaded – the site does not allow cross-origin access. Download the image and add it as a file.":
    "Bild konnte nicht geladen werden – die Seite erlaubt keinen Zugriff von anderen Websites. Lade das Bild herunter und füge es als Datei ein.",
  "Image URL not reachable (HTTP {status}).": "Bild-URL nicht erreichbar (HTTP {status}).",
  "The URL does not point to an image.": "Die URL verweist nicht auf ein Bild.",
  "The image could not be loaded.": "Bild konnte nicht geladen werden.",

  // ── covers.ts ────────────────────────────────────────────────────────────
  "SteamGridDB is not reachable.": "SteamGridDB ist nicht erreichbar.",
  "SteamGridDB API key missing or invalid. Create a new key at steamgriddb.com.":
    "SteamGridDB-API-Key fehlt oder ist ungültig. Neuen Key unter steamgriddb.com anlegen.",
  "SteamGridDB error (HTTP {status}).": "SteamGridDB-Fehler (HTTP {status}).",
  "IGDB/Twitch is not reachable.": "IGDB/Twitch ist nicht erreichbar.",
  "IGDB credentials invalid. Create a Client ID and Client Secret at dev.twitch.tv.":
    "IGDB-Zugangsdaten ungültig. Client-ID und Client-Secret unter dev.twitch.tv anlegen.",
  "IGDB is not reachable.": "IGDB ist nicht erreichbar.",
  "IGDB token expired – please search again.": "IGDB-Token abgelaufen – bitte erneut suchen.",
  "IGDB error (HTTP {status}).": "IGDB-Fehler (HTTP {status}).",
  "GitHub not reachable.": "GitHub nicht erreichbar.",
  "GitHub request failed (HTTP {status}).": "GitHub-Anfrage fehlgeschlagen (HTTP {status}).",

  // ── gamelist.ts / projectFile.ts / backup.ts ─────────────────────────────
  "The file is not a valid gamelist.xml (XML error).":
    "Die Datei ist keine gültige gamelist.xml (XML-Fehler).",
  "No <game> entries found in the file.": "Keine <game>-Einträge in der Datei gefunden.",
  "Not a valid project file.": "Keine gültige Projektdatei.",
  "Not a valid backup file (manifest.json missing).":
    "Keine gültige Backup-Datei (manifest.json fehlt).",
  "Unknown backup format.": "Unbekanntes Backup-Format.",

  // ── GameTree ─────────────────────────────────────────────────────────────
  "All games": "Alle Spiele",
  "With image only": "Nur mit Bild",
  "Without image only": "Nur ohne Bild",
  "Consoles & games": "Konsolen & Spiele",
  "All consoles": "Alle Konsolen",
  "Global template – appears on every card": "Globale Vorlage – erscheint auf allen Karten",
  "Filter games: {label}": "Spiele filtern: {label}",
  "Show games": "Spiele anzeigen",
  Add: "Hinzufügen",
  "Add game": "Spiel hinzufügen",
  Rename: "Umbenennen",
  Remove: "Entfernen",
  Collapse: "Zuklappen",
  Expand: "Aufklappen",
  "New game for {name}:": "Neues Spiel für {name}:",
  "Rename game:": "Spiel umbenennen:",
  "Rename console:": "Konsole umbenennen:",
  "Remove “{title}” from the list? An existing sticker design stays under “Projects”.":
    "„{title}“ aus der Liste entfernen? Ein bereits angelegtes Sticker-Design bleibt unter „Projekte“ erhalten.",
  "Remove console “{name}” and all its games from the tree? Existing sticker designs stay under “Projects”.":
    "Konsole „{name}“ mit allen Spielen aus dem Baum entfernen? Angelegte Sticker-Designs bleiben unter „Projekte“.",
  "{name} – edit shared template (right-click: add game / rename console)":
    "{name} – gemeinsame Vorlage bearbeiten (Rechtsklick: Spiel hinzufügen / Konsole umbenennen)",
  "No game with an image.": "Kein Spiel mit Bild.",
  "Every game has an image.": "Alle Spiele haben ein Bild.",
  "{title} (right-click: rename / remove)": "{title} (Rechtsklick: umbenennen / entfernen)",
  Console: "Konsole",
  Game: "Spiel",

  // ── Inspector ────────────────────────────────────────────────────────────
  "Console template": "Konsolen-Vorlage",
  "These layers automatically appear on ": "Diese Ebenen erscheinen automatisch auf ",
  all: "allen",
  " cards – above every console and above the console templates.":
    " Karten – über allen Konsolen und über den Konsolen-Vorlagen.",
  " game cards for {name}.": " Spiel-Karten von {name}.",
  "Card background": "Kartenhintergrund",
  "Select a layer to edit it.": "Wähle eine Ebene aus, um sie zu bearbeiten.",
  Properties: "Eigenschaften",
  Name: "Name",
  "Rotation °": "Drehung °",
  "Size %": "Größe %",
  "Opacity {n}%": "Deckkraft {n}%",
  Center: "Zentr.",
  "Use as shared alpha mask": "Als gemeinsame Alpha-Maske verwenden",
  "This layer's alpha channel clips the main image on ":
    "Der Alpha-Kanal dieser Ebene beschneidet auf ",
  every: "jeder",
  " card. The shape itself is not drawn on the cards.":
    " Karte deren Hauptbild. Die Form selbst wird auf den Karten nicht gezeichnet.",
  "Main image": "Hauptbild",
  Mask: "Maske",
  "Dissolve mask": "Maske auflösen",
  "{n} layer(s) in this mask.": "{n} Ebene(n) in dieser Maske.",
  "Add layer": "Ebene aufnehmen",
  "Release top": "Oberste lösen",
  "Move layers along (moving / scaling / rotating the mask affects all layers in it)":
    "Ebenen mitbewegen (Verschieben / Skalieren / Drehen der Maske betrifft alle Ebenen darin)",
  "Alpha mask": "Alpha-Maske",
  "As mask": "Als Maske",
  "Into mask": "In Maske",
  "This layer is clipped by the mask above it. Set other layers in between to «Into mask» to place them in the same mask.":
    "Diese Ebene wird von der Maske darüber beschnitten. Weitere Ebenen dazwischen ebenfalls auf »In Maske« stellen, um sie in dieselbe Maske zu legen.",
  "«As mask» makes this layer the alpha channel for the layer(s) below it. «Into mask» places it into the mask above.":
    "»Als Maske« macht diese Ebene zum Alpha-Kanal für die Ebene(n) darunter. »In Maske« legt sie in die Maske darüber.",
  "+ Vertical": "+ Vertikal",
  "+ Horizontal": "+ Horizontal",
  "Show guides": "Hilfslinien anzeigen",
  "Snap layers to guides": "Ebenen an Hilfslinien einrasten",
  "Lock guides": "Hilfslinien sperren",
  "Editable only here (“All consoles”), but they appear on every card. Drag on the card to position, drag past the edge to delete.":
    "Nur hier („Alle Konsolen“) bearbeitbar, erscheinen aber auf allen Karten. Auf der Karte ziehen zum Positionieren, über den Rand hinaus ziehen zum Löschen.",
  Vertical: "Vertikal",
  "Horiz.": "Horiz.",
  Delete: "Löschen",
  "Own background": "Eigener Hintergrund",
  "From the console template": "Von der Konsolen-Vorlage",
  "From the global template": "Von der globalen Vorlage",
  " (not set)": " (nicht gesetzt)",
  "Background source": "Hintergrund-Quelle",
  "The background comes from the ": "Der Hintergrund kommt aus der ",
  "console template": "Konsolen-Vorlage",
  "global template": "globalen Vorlage",
  ". Edit it there (click the console / “All consoles” in the tree).":
    ". Dort bearbeiten (Konsole / „Alle Konsolen“ im Baum anklicken).",
  Background: "Hintergrund",
  "Own background for this template": "Eigenen Hintergrund für diese Vorlage",
  "Cards can choose in their properties whether to use this background.":
    "Karten können in ihren Eigenschaften wählen, ob sie diesen Hintergrund übernehmen.",
  "{n} game(s) loaded. Shown in the “Metadata” tab on matching game cards.":
    "{n} Spiel(e) geladen. Erscheinen im Tab „Metadaten“ bei passenden Spiel-Karten.",
  "No metadata for {name} yet.": "Noch keine Metadaten für {name}.",
  "Reading gamelist.xml …": "gamelist.xml wird gelesen …",
  "Loading example …": "Beispiel wird geladen …",
  "No example available for this console.": "Kein Beispiel für diese Konsole vorhanden.",
  "Upload …": "Hochladen …",
  "Load example for {name}": "Beispiel für {name} laden",
  Color: "Farbe",
  Gradient: "Verlauf",
  From: "Von",
  To: "Nach",
  Linear: "Linear",
  Radial: "Radial",
  Colors: "Farben",
  "Add color": "Farbe hinzufügen",
  "Remove color": "Farbe entfernen",
  "Direction {n}°": "Richtung {n}°",
  "Grain / noise {n}%": "Körnung / Noise {n}%",
  "Width px": "Breite px",
  "Height px": "Höhe px",
  "Corner radius": "Ecken-Radius",
  "Original: {w}×{h} px": "Original: {w}×{h} px",
  Fill: "Füllung",
  Stroke: "Kontur",
  "Stroke width": "Konturstärke",
  "Shows the rating, release year and player count of the currently open game from its gamelist.xml. Best placed in a console or the global template.":
    "Zeigt Bewertung, Release-Jahr und Spieleranzahl des jeweils geöffneten Spiels aus dessen gamelist.xml. Am besten in einer Konsolen- oder der globalen Vorlage platzieren.",
  "Shows the star rating of the currently open game from its gamelist.xml. Best placed in a console or the global template.":
    "Zeigt die Sternebewertung des jeweils geöffneten Spiels aus dessen gamelist.xml. Am besten in einer Konsolen- oder der globalen Vorlage platzieren.",
  "Shows the release year of the currently open game from its gamelist.xml. Best placed in a console or the global template.":
    "Zeigt das Release-Jahr des jeweils geöffneten Spiels aus dessen gamelist.xml. Am besten in einer Konsolen- oder der globalen Vorlage platzieren.",
  "Shows the player count of the currently open game from its gamelist.xml. Best placed in a console or the global template.":
    "Zeigt die Spieleranzahl des jeweils geöffneten Spiels aus dessen gamelist.xml. Am besten in einer Konsolen- oder der globalen Vorlage platzieren.",
  "Text size": "Textgröße",
  "Players icon": "Spieler-Icon",
  "Automatic (1 = single player)": "Automatisch (1 = Einzelspieler)",
  "Always single player": "Immer Einzelspieler",
  "Always multiplayer": "Immer Mehrspieler",
  Controller: "Controller",
  "Text color": "Textfarbe",
  "Star color": "Sternfarbe",
  Font: "Schriftart",
  "Size px": "Größe px",
  "Box width": "Box-Breite",
  "Line height": "Zeilenhöhe",
  "Letter spacing": "Laufweite",
  "Stroke color": "Konturfarbe",

  // ── LayerList ────────────────────────────────────────────────────────────
  Layers: "Ebenen",
  "Editable only in “All consoles”": "Nur unter „Alle Konsolen“ bearbeitbar",
  "No layers yet. Add text, an image or a shape above.":
    "Noch keine Ebenen. Füge oben Text, ein Bild oder eine Form hinzu.",
  Hide: "Ausblenden",
  Show: "Einblenden",
  Unlock: "Entsperren",
  Lock: "Sperren",
  Duplicate: "Duplizieren",

  // ── MetadataPanel ────────────────────────────────────────────────────────
  "Metadata is per game.": "Metadaten gelten pro Spiel.",
  "This design is not linked to a game from the tree.":
    "Dieses Design ist keinem Spiel aus dem Baum zugeordnet.",
  Metadata: "Metadaten",
  "Delete entry": "Eintrag löschen",
  "No entry for this game yet – just fill it in, it saves automatically.":
    "Noch kein Eintrag für dieses Spiel – einfach ausfüllen, es wird automatisch gespeichert.",
  "Image (URL or path)": "Bild (URL oder Pfad)",
  Description: "Beschreibung",
  "Release date": "Release-Datum",
  Developer: "Entwickler",
  Publisher: "Publisher",
  Genre: "Genre",
  Players: "Spieler",
  "e.g. 1-4": "z. B. 1-4",
  "{n} of 5 stars (left/right half for half steps)":
    "{n} von 5 Sternen (linke/rechte Hälfte für halbe Schritte)",
  "Image (local path): {src}": "Bild (lokaler Pfad): {src}",

  // ── ProjectsDialog ───────────────────────────────────────────────────────
  "Your designs": "Deine Designs",
  "No saved designs yet.": "Noch keine gespeicherten Designs.",
  " · open": " · geöffnet",
  "Really delete “{name}”?": "„{name}“ wirklich löschen?",

  // ── CardPreview ──────────────────────────────────────────────────────────
  "No card to show.": "Keine Karte zum Anzeigen.",
  "Card preview": "Kartenvorschau",
  "rendering …": "wird gerendert …",
  "Holographic card": "Holographische Karte",
  "Reset view": "Ansicht zurücksetzen",
  Close: "Schließen",
  "Drag to rotate": "Ziehen zum Drehen",

  // ── DemoMode ─────────────────────────────────────────────────────────────
  "Demo mode": "Demo-Modus",
  "Draw a booster pack of {n} random cards – from one console or from all of them.":
    "Zieh ein Booster-Pack mit {n} zufälligen Karten – aus einer Konsole oder aus allen.",
  "Draw pack": "Pack ziehen",
  "Rendering cards …": "Karten werden gerendert …",
  "Open pack": "Pack öffnen",
  "{n} cards": "{n} Karten",
  " · {n} cards": " · {n} Karten",
  " · ✨ 1 holographic": " · ✨ 1 holografisch",
  "New pack": "Neues Pack",
  "Previous card": "Vorherige Karte",
  "Next card": "Nächste Karte",
  Holographic: "Holografisch",
  Reset: "Zurücksetzen",
  "Close viewer": "Zurück",
  "Drag to rotate · ← → for the next card": "Ziehen zum Drehen · ← → für die nächste Karte",

  // ── CoverSearchDialog ────────────────────────────────────────────────────
  "Cover {n} / {total}:": "Cover {n} / {total}:",
  "Cover for": "Cover für",
  "Credentials saved": "Zugangsdaten hinterlegt",
  " (but search uses libretro – see below)": " (aber Suche nutzt libretro – s. u.)",
  Change: "Ändern",
  "{source} credentials – free at ": "{source}-Zugangsdaten – kostenlos unter ",
  ". Requests are proxied locally by the dev server; the key stays on this machine.":
    ". Anfragen werden lokal vom Dev-Server weitergeleitet; der Key bleibt auf diesem Rechner.",
  "API key": "API-Key",
  Save: "Speichern",
  "Client ID": "Client-ID",
  "Client secret": "Client-Secret",
  "Without credentials: libretro-thumbnails (retro / emulated consoles only).":
    "Ohne Zugangsdaten: libretro-thumbnails (nur Retro-/Emulations-Konsolen).",
  "Searching covers …": "Suche Cover …",
  "Search term": "Suchbegriff",
  Search: "Suchen",
  "Try again": "Erneut versuchen",
  More: "Mehr",
  "Without credentials there's no cover database for “{name}” (libretro-thumbnails only covers retro / emulated consoles). Enter credentials above or add a cover manually via “+ Image → Add from URL”.":
    "Für „{name}“ gibt es ohne Zugangsdaten keine Cover-Datenbank (libretro-thumbnails deckt nur Retro-/Emulations-Konsolen ab). Zugangsdaten oben eintragen oder Cover manuell über „+ Bild → Von URL einfügen“ hinzufügen.",
  "No covers found for “{title}”.": "Keine Cover für „{title}“ gefunden.",
  "inserting …": "wird eingefügt …",
  "Click a cover to insert it – then it moves to the next card.":
    "Cover anklicken zum Einfügen – dann geht es zur nächsten Karte.",
  Skip: "Überspringen",

  // ── CutSheetDialog ───────────────────────────────────────────────────────
  "This card": "Diese Karte",
  "Multiple cards": "Mehrere Karten",
  "Cut sheet for Cricut …": "Schneidebogen für Cricut …",
  "Print / cut sheet (Cricut · wir-machen-druck) …":
    "Druck-/Schneidebogen (Cricut · wir-machen-druck) …",
  "Cut sheet for Cricut": "Schneidebogen für Cricut",
  "Sticker sheet for wir-machen-druck.de":
    "Stickerbogen für wir-machen-druck.de",
  "Cricut Explore (Print then Cut)": "Cricut Explore (Print then Cut)",
  "wir-machen-druck.de (print PDF)": "wir-machen-druck.de (Druck-PDF)",
  "Builds a single print-ready PDF: every design on one sheet at real size, each card full-bleed, with a 2 mm outer bleed and a “kiss_cut” contour (100 % magenta spot colour) around each card — the cut line their production expects.":
    "Erstellt ein einzelnes druckfertiges PDF: alle Designs auf einem Bogen in Originalgröße, jede Karte mit vollem Anschnitt, 2 mm Außen-Anschnitt und eine „kiss_cut“-Kontur (100 % Magenta-Sonderfarbe) um jede Karte – die Schnittlinie, die deren Produktion erwartet.",
  "Cyan = the “kiss_cut” contour. The PDF is one sheet, {w}×{h} mm incl. a 2 mm outer bleed, RGB image + magenta spot cut line — upload it as the print data. Order the sheet at this exact size. {icc}":
    "Cyan = die „kiss_cut“-Kontur. Das PDF ist ein Bogen, {w}×{h} mm inkl. 2 mm Außen-Anschnitt, RGB-Bild + Magenta-Sonderfarben-Schnittlinie – als Druckdaten hochladen. Den Bogen in exakt dieser Größe bestellen. {icc}",
  "Output intent: ISO Coated v2 300% (ECI) — the ICC profile is embedded.":
    "Output-Intent: ISO Coated v2 300% (ECI) – das ICC-Profil ist eingebettet.",
  "Output intent: ISO Coated v2 300% (ECI), named only — wir-machen-druck converts the RGB image to it.":
    "Output-Intent: ISO Coated v2 300% (ECI), nur benannt – wir-machen-druck konvertiert das RGB-Bild dahin.",
  "Download PDF": "PDF herunterladen",
  "Packs the finished designs onto {w} DPI sheets at real size — each card printed full-bleed — plus a matching SVG that cuts each card at its rounded trim edge. Print at 100 %, then Print then Cut on the Cricut.":
    "Packt die fertigen Designs in Originalgröße auf {w}-DPI-Bögen – jede Karte mit vollem Anschnitt gedruckt – plus ein passendes SVG, das jede Karte an der abgerundeten Schnittkante schneidet. Mit 100 % drucken, dann am Cricut „Print then Cut“.",
  Gap: "Abstand",
  "White background": "Weißer Hintergrund",
  "Select all": "Alle auswählen",
  "Deselect all": "Alle abwählen",
  "Build sheet": "Bogen erstellen",
  "Back to selection": "Zurück zur Auswahl",
  "{cards} card(s) · {cols}×{rows} per sheet · {pages} sheet(s)":
    "{cards} Karte(n) · {cols}×{rows} pro Bogen · {pages} Bogen/Bögen",
  "print at {w}×{h} mm": "Druck {w}×{h} mm",
  Sheet: "Bogen",
  "Image (print PNG)": "Bild (Druck-PNG)",
  "Cut line (cut SVG)": "Schnittlinie (Schnitt-SVG)",
  "Cut line offset (left / top)": "Schnittlinien-Abstand (links / oben)",
  "  image   print{s}.png : {w} x {h} mm  ({wc} x {hc} cm)":
    "  Bild      print{s}.png : {w} x {h} mm  ({wc} x {hc} cm)",
  "  cut     cut{s}.svg   : {w} x {h} mm  ({wc} x {hc} cm)":
    "  Schnitt   cut{s}.svg   : {w} x {h} mm  ({wc} x {hc} cm)",
  "  offset  cut line from the image's top-left corner: {l} mm left, {tp} mm top":
    "  Abstand   Schnittlinie von der oberen linken Ecke des Bildes: {l} mm links, {tp} mm oben",
  "If Design Space crops the SVG to the cut line, set the image size above, then move the cut layer so its top-left sits at the offset above (left / top) from the image's top-left.":
    "Wenn Design Space das SVG auf die Schnittlinie zuschneidet: das Bild auf die obige Größe stellen, dann die Schnittebene so verschieben, dass ihre obere linke Ecke im obigen Abstand (links / oben) zur oberen linken Ecke des Bildes liegt.",
  "Cyan = the cut line (cut.svg). The .zip has the full-bleed print PNG and the matching SVG; the README lists the exact print size. Fits the Cricut print area ({w}×{h} mm). Print at 100 %.":
    "Cyan = die Schnittlinie (cut.svg). Die .zip enthält das Druck-PNG mit vollem Anschnitt und das passende SVG; die README nennt die exakte Druckgröße. Passt in den Cricut-Druckbereich ({w}×{h} mm). Mit 100 % drucken.",
  "PRINT SIZE — print at 100 % / actual size, never “fit to page”, so the cut line lines up:":
    "DRUCKGRÖSSE – mit 100 % / Originalgröße drucken, niemals „an Seite anpassen“, damit die Schnittlinie passt:",
  "print*.png = the sticker sheet, each card printed full-bleed. cut*.svg = the matching cut line, one rounded path per card at the trim edge. Cricut Design Space: upload the SVG (the cut layer) and the PNG (Print then Cut image) at the same size so they line up, then Print then Cut. Or upload just the PNG and choose “Complex” to auto-trace (it will follow the bleed edge, not the rounded trim).":
    "print*.png = der Sticker-Bogen, jede Karte mit vollem Anschnitt gedruckt. cut*.svg = die passende Schnittlinie, ein abgerundeter Pfad pro Karte an der Schnittkante. Cricut Design Space: SVG (Schnittebene) und PNG (Print-then-Cut-Bild) in derselben Größe hochladen, damit sie deckungsgleich sind, dann Print then Cut. Oder nur das PNG hochladen und „Complex“ zum automatischen Nachzeichnen wählen (folgt der Anschnittkante, nicht der abgerundeten Schnittkante).",
  "Download .zip (print + cut)": ".zip herunterladen (Druck + Schnitt)",
  "A single card is larger than the Cricut print area for this format.":
    "Eine einzelne Karte ist größer als der Cricut-Druckbereich für dieses Format.",
  "None of the selected games has a saved design.":
    "Keins der ausgewählten Spiele hat ein gespeichertes Design.",
  "Could not build the sheet.": "Bogen konnte nicht erstellt werden.",

  // ── CoverSweepDialog ─────────────────────────────────────────────────────
  "Find covers – all cards": "Cover suchen – alle Karten",
  "Find covers – {name}": "Cover suchen – {name}",
  "Looking for cards without an image …": "Karten ohne Bild werden gesucht …",
  "{n} cover(s) inserted.": "{n} Cover eingefügt.",
  "Every card already has an image.": "Alle Karten haben bereits ein Bild.",

  // ── BaseImportDialog ─────────────────────────────────────────────────────
  "Base set from base_game_list.csv": "Basis-Set aus base_game_list.csv",
  "Imported {games} games across {consoles} consoles – including metadata.":
    "{games} Spiele in {consoles} Konsolen übernommen – inklusive Metadaten.",
  "Select consoles / games. “Continue” adds them to the tree and writes year, publisher, players, genre and rating into each ":
    "Konsolen / Spiele auswählen. „Weiter“ legt sie im Baum an und schreibt Jahr, Publisher, Spieler, Genre und Wertung in die jeweilige ",
  "Filter …": "Filtern …",
  "{n} game(s) selected": "{n} Spiel(e) ausgewählt",
  Cancel: "Abbrechen",
  Continue: "Weiter",

  // ── QuickImportDialog ────────────────────────────────────────────────────
  "Games without an image. Enter one image URL each and click “Done” – the images are loaded and added as a layer to each design.":
    "Spiele ohne Bild. Trage je eine Bild-URL ein und klick „Fertig“ – die Bilder werden geladen und als Ebene ins jeweilige Design gelegt.",
  "Checking games …": "Spiele werden geprüft …",
  "Every game already has an image.": "Alle Spiele haben bereits ein Bild.",
  loaded: "geladen",
  "Loading … {done}/{total}": "Lädt … {done}/{total}",
  "{ok} loaded": "{ok} geladen",
  ", {fail} failed": ", {fail} fehlgeschlagen",
  "{filled} of {total} filled in": "{filled} von {total} ausgefüllt",
  Done: "Fertig",
};
