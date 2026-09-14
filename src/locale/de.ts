// German translations. Keys are the English source strings used in the
// code; {tokens} are filled in by t(). Anything missing here falls back to
// the English key.

export const de: Record<string, string> = {
  // ── App shell ────────────────────────────────────────────────────────────
  "loading …": "lädt …",

  // ── PromptDialog ─────────────────────────────────────────────────────────
  OK: "OK",

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
  "Generating PDF …": "PDF wird erzeugt …",
  "PDF – card-tray printer …": "PDF – Kartenfach-Drucker …",
  "Card-tray printing": "Kartenfach-Druck",
  "For a printer's disc/card tray (e.g. Canon's). The tray is usually bigger than the card, and exactly where the card sits on it depends on your printer — print a test page, measure the offset from a corner against the real card, and adjust it below. Remembered per tray type.":
    "Für das Disc-/Kartenfach eines Druckers (z. B. Canon). Das Fach ist meist größer als die Karte, und wo genau die Karte darauf sitzt, hängt vom Drucker ab – drucke eine Testseite, miss den Versatz ab einer Ecke an der echten Karte und passe ihn unten an. Wird je Fach-Typ gemerkt.",
  "Tray type": "Fach-Typ",
  "Card position on the tray page": "Kartenposition auf der Fach-Seite",
  "Page width (mm)": "Seitenbreite (mm)",
  "Page height (mm)": "Seitenhöhe (mm)",
  "Card offset X (mm)": "Karten-Versatz X (mm)",
  "Card offset Y (mm)": "Karten-Versatz Y (mm)",
  "Export PDF (front + back)": "PDF exportieren (Vorder- + Rückseite)",
  "Export PDF": "PDF exportieren",
  "Load backup? Projects and templates from the file are imported (existing ones with the same ID are overwritten). The page then reloads.":
    "Backup laden? Projekte und Vorlagen aus der Datei werden übernommen (vorhandene mit gleicher ID überschrieben). Die Seite wird danach neu geladen.",
  "{projects} project(s) and {templates} template(s) imported.":
    "{projects} Projekt(e) und {templates} Vorlage(n) übernommen.",
  Language: "Sprache",
  English: "Englisch",
  German: "Deutsch",

  // ── Menu bar ─────────────────────────────────────────────────────────────
  File: "Datei",
  Edit: "Bearbeiten",
  View: "Ansicht",
  Extra: "Extra",
  Settings: "Einstellungen",
  "Demo mode (card packs)": "Demo-Modus (Kartenpacks)",
  Preview: "Vorschau",
  "Preview all": "Gesamtvorschau",
  "New card": "Neue Karte",
  "Load JSON \u2026": "JSON laden \u2026",
  "Base set \u2026": "Basis-Set \u2026",
  "Load backup \u2026": "Backup laden \u2026",
  Export: "Export",
  Import: "Import",
  "Duplicate layer": "Ebene duplizieren",
  "Delete layer": "Ebene l\u00f6schen",
  "Interface font": "Schriftart der Oberfl\u00e4che",
  "Cover source": "Cover-Quelle",
  System: "System",
  Monospace: "Monospace",

  // ── Projects (whole libraries; a single card design is a "Design") ───────
  "New project \u2026": "Neues Projekt \u2026",
  "Switch project \u2026": "Projekt wechseln \u2026",
  "Open design \u2026": "Design \u00f6ffnen \u2026",
  Designs: "Designs",
  "Design file": "Design-Datei",
  "Main project": "Hauptprojekt",
  "A project is its own library: its own consoles, cards, templates and guides. Nothing is shared between them, so a new one is a clean slate.":
    "Ein Projekt ist eine eigene Sammlung: eigene Konsolen, Karten, Vorlagen und Hilfslinien. Nichts wird geteilt \u2013 ein neues f\u00e4ngt also bei null an.",
  "Switch to this project": "Zu diesem Projekt wechseln",
  "(empty start)": "(leer gestartet)",
  "Delete project": "Projekt l\u00f6schen",
  "Delete \u201c{name}\u201d with all its consoles, cards and templates? This cannot be undone.":
    "\u201e{name}\u201c mit allen Konsolen, Karten und Vorlagen l\u00f6schen? Das l\u00e4sst sich nicht r\u00fcckg\u00e4ngig machen.",
  "Project name": "Projektname",
  "New project": "Neues Projekt",
  "Name, e.g. \u201cMega Drive collection\u201d": "Name, z. B. \u201eMega-Drive-Sammlung\u201c",
  "Example consoles": "Beispiel-Konsolen",
  "Games per console": "Spiele pro Konsole",
  "{consoles} \u2014 top {n} games each, with metadata from base_game_list.csv.":
    "{consoles} \u2013 je die besten {n} Spiele, mit Metadaten aus base_game_list.csv.",
  "Starts empty — no consoles, no cards. Add your own in the tree.":
    "Startet leer \u2013 keine Konsolen, keine Karten. Eigene im Baum anlegen.",
  "Starts empty — no movies, no cards. Add your own in the tree.":
    "Startet leer \u2013 keine Filme, keine Karten. Eigene im Baum anlegen.",
  Content: "Inhalt",
  Games: "Spiele",
  Movies: "Filme",
  Create: "Erstellen",

  // ── Data safety (automatic backups + trash) ──────────────────────────────
  "Data safety": "Datensicherheit",
  "Data safety \u2026": "Datensicherheit \u2026",
  "Back up your work": "Sichere deine Arbeit",
  "Everything you design lives in this browser's local database. Clearing the browser's site data deletes it. Point the app at a folder and it keeps a rolling set of backup .zip files there for you.":
    "Alles, was du gestaltest, liegt in der lokalen Datenbank dieses Browsers. Wenn du die Websitedaten l\u00f6schst, ist es weg. W\u00e4hle einen Ordner, dann legt die App dort automatisch rotierende Backup-.zip-Dateien ab.",
  "Automatic backup": "Automatisches Backup",
  "This browser can't write to a folder (needs the File System Access API — Chrome, Edge or Opera). Use File ▸ Save backup (.zip) regularly instead.":
    "Dieser Browser kann nicht in einen Ordner schreiben (ben\u00f6tigt die File System Access API \u2013 Chrome, Edge oder Opera). Nutze stattdessen regelm\u00e4\u00dfig Datei \u25b8 Backup (.zip) speichern.",
  "No folder selected yet.": "Noch kein Ordner gew\u00e4hlt.",
  "Choose folder \u2026": "Ordner w\u00e4hlen \u2026",
  "Change folder \u2026": "Ordner \u00e4ndern \u2026",
  Forget: "Vergessen",
  "The browser needs your permission again for this folder — click \u201cBack up now\u201d.":
    "Der Browser braucht erneut deine Freigabe f\u00fcr diesen Ordner \u2013 klicke auf \u201eJetzt sichern\u201c.",
  "Back up automatically": "Automatisch sichern",
  "at most every": "h\u00f6chstens alle",
  min: "Min.",
  keep: "behalte",
  files: "Dateien",
  "Last backup: {when}": "Letztes Backup: {when}",
  "No backup written yet.": "Noch kein Backup geschrieben.",
  "\u2014 over {n} days ago": "\u2014 vor \u00fcber {n} Tagen",
  "Back up now": "Jetzt sichern",
  Trash: "Papierkorb",
  "Empty trash": "Papierkorb leeren",
  "Permanently delete everything in the trash?":
    "Alles im Papierkorb endg\u00fcltig l\u00f6schen?",
  "Nothing deleted. Deleted designs stay here for {n} days.":
    "Nichts gel\u00f6scht. Gel\u00f6schte Designs bleiben {n} Tage hier.",
  Restore: "Wiederherstellen",

  // ── Overview ("All cards") ───────────────────────────────────────────────
  "All cards": "Gesamtansicht",
  "Filter by game or console \u2026": "Nach Spiel oder Konsole filtern \u2026",
  "Only cards with a design": "Nur Karten mit Design",
  Size: "Gr\u00f6\u00dfe",
  "{shown} of {total} card(s) \u00b7 {designed} designed":
    "{shown} von {total} Karte(n) \u00b7 {designed} mit Design",
  "no design": "kein Design",
  "Rendering {done} / {total} \u2026": "Rendere {done} / {total} \u2026",
  "Click a card to open it in the editor.":
    "Karte anklicken, um sie im Editor zu \u00f6ffnen.",

  // ── Themes ───────────────────────────────────────────────────────────────
  Theme: "Design",
  "Accent colour": "Akzentfarbe",
  Lime: "Limette",
  Emerald: "Smaragd",
  Cyan: "Cyan",
  Cobalt: "Kobalt",
  Violet: "Violett",
  Magenta: "Magenta",
  Crimson: "Karmesin",
  Ember: "Glut",
  Gold: "Gold",
  Graphite: "Graphit",
  Paper: "Papier",
  Sky: "Himmel",
  Rose: "Rosé",

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
  Custom: "Benutzerdefiniert",
  Width: "Breite",
  Height: "Höhe",
  Radius: "Radius",
  Spine: "Rücken",
  Flap: "Lasche",
  "{w} × {h} mm": "{w} × {h} mm",
  "front & back": "Vorder- & Rückseite",
  "{n} panels": "{n} Felder",
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
  "TMDB is not reachable.": "TMDB ist nicht erreichbar.",
  "TMDB API key missing or invalid. Create one at themoviedb.org.":
    "TMDB-API-Key fehlt oder ist ung\u00fcltig. Neuen Key unter themoviedb.org anlegen.",
  "TMDB error (HTTP {status}).": "TMDB-Fehler (HTTP {status}).",

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
  "Add console": "Konsole hinzuf\u00fcgen",
  "Console name:": "Name der Konsole:",
  "That console already exists.": "Diese Konsole gibt es bereits.",
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
  "Collections & movies": "Sammlungen & Filme",
  "All collections": "Alle Sammlungen",
  "Add collection": "Sammlung hinzuf\u00fcgen",
  "Collection name:": "Name der Sammlung:",
  "That collection already exists.": "Diese Sammlung gibt es bereits.",
  "New movie for {name}:": "Neuer Film f\u00fcr {name}:",
  "Rename movie:": "Film umbenennen:",
  "Rename collection:": "Sammlung umbenennen:",
  "Remove collection \u201c{name}\u201d and all its movies from the tree? Existing sticker designs stay under \u201cProjects\u201d.":
    "Sammlung \u201e{name}\u201c mit allen Filmen aus dem Baum entfernen? Angelegte Sticker-Designs bleiben unter \u201eProjekte\u201c.",
  "{name} \u2013 edit shared template (right-click: add movie / rename collection)":
    "{name} \u2013 gemeinsame Vorlage bearbeiten (Rechtsklick: Film hinzuf\u00fcgen / Sammlung umbenennen)",
  "Add movie": "Film hinzuf\u00fcgen",
  "All movies": "Alle Filme",
  "Show movies": "Filme anzeigen",

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
  "A placement frame — it always shows as a dashed outline.":
    "Ein Platzierungsrahmen – wird immer als gestrichelte Umrandung angezeigt.",
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

  // ── custom fonts ─────────────────────────────────────────────────────────
  "Custom fonts …": "Eigene Schriftarten …",
  "Custom fonts": "Eigene Schriftarten",
  "Uploaded": "Hochgeladen",
  "Upload font …": "Schriftart hochladen …",
  "Upload a font file (.ttf, .otf, .woff, .woff2)":
    "Schriftdatei hochladen (.ttf, .otf, .woff, .woff2)",
  "Font files stay on this machine, in this project. They show up in every text layer's font picker.":
    "Schriftdateien bleiben auf diesem Rechner, in diesem Projekt. Sie erscheinen in jeder Text-Ebene in der Schriftauswahl.",
  "No custom fonts yet.": "Noch keine eigenen Schriftarten.",
  "That doesn't look like a font file (.ttf, .otf, .woff, .woff2).":
    "Das sieht nicht nach einer Schriftdatei aus (.ttf, .otf, .woff, .woff2).",
  "That font file is too big (max {n} MB).": "Diese Schriftdatei ist zu groß (max. {n} MB).",
  "Couldn't read that file.": "Die Datei konnte nicht gelesen werden.",

  // ── LayerList ────────────────────────────────────────────────────────────
  Layers: "Ebenen",
  "Editable only in “All consoles”": "Nur unter „Alle Konsolen“ bearbeitbar",
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
  Director: "Regisseur",
  Studio: "Studio",
  Runtime: "Laufzeit",
  "e.g. 118 min": "z. B. 118 Min.",
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
  Flip: "Umdrehen",
  "Zoom in": "Vergrößern",
  "Zoom out": "Verkleinern",
  "Drag to rotate · flick to spin · wheel to zoom · F flips, R resets":
    "Ziehen zum Drehen · Schwung zum Weiterdrehen · Mausrad zoomt · F dreht um, R setzt zurück",
  "Previous card ([)": "Vorherige Karte ([)",
  "Next card (])": "Nächste Karte (])",
  "[ ] step cards · drag to rotate · flick to spin · wheel to zoom · F flips, R resets":
    "[ ] blättert Karten · Ziehen zum Drehen · Schwung zum Weiterdrehen · Mausrad zoomt · F dreht um, R setzt zurück",

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
  "Click to tear open": "Zum Aufreißen klicken",
  RARE: "RAR",
  "Drag to rotate · flick to spin · wheel to zoom · ← → for the next card":
    "Ziehen zum Drehen · Schwung zum Weiterdrehen · Mausrad zoomt · ← → für die nächste Karte",

  // ── Logo layer ───────────────────────────────────────────────────────────
  Logo: "Logo",
  "Logo for": "Logo f\u00fcr",
  "Searching logos \u2026": "Logos werden gesucht \u2026",
  "No logos found for \u201c{title}\u201d.":
    "Keine Logos f\u00fcr \u201e{title}\u201c gefunden.",
  "Logos come from SteamGridDB only \u2014 an API key is required.":
    "Logos gibt es nur bei SteamGridDB \u2013 daf\u00fcr wird ein API-Key ben\u00f6tigt.",

  // ── Image adjustment (greyscale / threshold) ─────────────────────────────
  "Colour reduction": "Farbreduktion",
  Original: "Original",
  Greyscale: "Graustufen",
  Threshold: "Schwellenwert",
  "Threshold {n}": "Schwellenwert {n}",
  "Brightness {n}": "Helligkeit {n}",
  "Contrast {n}": "Kontrast {n}",
  Invert: "Invertieren",
  "Silhouette (one colour, rest transparent)":
    "Silhouette (eine Farbe, Rest transparent)",
  Colour: "Farbe",
  White: "Wei\u00df",
  Black: "Schwarz",

  // ── Layer effects (shadow / glow) ──
  "Shadow / glow": "Schatten / Schein",
  "Shadow colour": "Schattenfarbe",
  "Blur {n}": "Weichzeichnen {n}",
  "Offset X": "Versatz X",
  "Offset Y": "Versatz Y",
  "Offset 0 / 0 makes it an even glow.":
    "Versatz 0 / 0 ergibt einen gleichm\u00e4\u00dfigen Schein.",

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
  "Cyan = the “kiss_cut” contour. The PDF is one sheet, {w}×{h} mm incl. a 2 mm outer bleed, RGB image + magenta spot cut line — upload it as the print data. Order the sheet at this exact size. Output intent: ISO Coated v2 300% (ECI), named only — wir-machen-druck converts the RGB image to it.":
    "Cyan = die „kiss_cut“-Kontur. Das PDF ist ein Bogen, {w}×{h} mm inkl. 2 mm Außen-Anschnitt, RGB-Bild + Magenta-Sonderfarben-Schnittlinie – als Druckdaten hochladen. Den Bogen in exakt dieser Größe bestellen. Output-Intent: ISO Coated v2 300% (ECI), nur benannt – wir-machen-druck konvertiert das RGB-Bild dahin.",
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

  // ── Alpha masks ──────────────────────────────────────────────────────────
  "Alpha mask {n}": "Alpha-Maske {n}",
  "Cards can drop an image into this frame: the image is clipped to this layer's alpha and sized to its box. The frame itself is not drawn on the cards.":
    "Karten k\u00f6nnen ein Bild in diesen Rahmen legen: Das Bild wird auf den Alphakanal dieser Ebene beschnitten und auf ihre Gr\u00f6\u00dfe gebracht. Der Rahmen selbst wird auf den Karten nicht gezeichnet.",
  "No alpha masks yet — add one in a console template or \u201cAll consoles\u201d.":
    "Noch keine Alpha-Masken \u2013 leg eine in einer Konsolen-Vorlage oder in \u201eAlle Konsolen\u201c an.",
  None: "Keine",
  global: "global",
  console: "Konsole",
  "Screenshot {n}": "Screenshot {n}",
  "Screenshot {n} for": "Screenshot {n} f\u00fcr",
  "Screenshot {n} / {total}:": "Screenshot {n} / {total}:",
  "Cover ({n} of {total})": "Cover ({n} von {total})",
  "Searching screenshots \u2026": "Screenshots werden gesucht \u2026",
  "No screenshots found for \u201c{title}\u201d.":
    "Keine Screenshots f\u00fcr \u201e{title}\u201c gefunden.",
  "Find cover and {n} screenshot(s)": "Cover und {n} Screenshot(s) suchen",
  Screenshot: "Screenshot",

  // ── Preflight ────────────────────────────────────────────────────────────
  "Preflight check": "Druckvorstufen-Pr\u00fcfung",
  "Preflight check \u2026": "Druckvorstufen-Pr\u00fcfung \u2026",
  "Checks resolution ({dpi} dpi or better), text size (at least {pt} pt) and distance to the cut line ({safe} mm clear).":
    "Pr\u00fcft Aufl\u00f6sung (mindestens {dpi} dpi), Schriftgr\u00f6\u00dfe (mindestens {pt} pt) und Abstand zur Schnittlinie ({safe} mm frei).",
  "Checking \u2026": "Wird gepr\u00fcft \u2026",
  "Nothing to fix — ready to print.": "Nichts zu beanstanden \u2013 druckfertig.",
  "{n} problem(s)": "{n} Problem(e)",
  "{n} warning(s)": "{n} Warnung(en)",
  "on {n} cards": "auf {n} Karten",
  Open: "\u00d6ffnen",
  "Only {dpi} dpi at this size — {good} dpi or more prints cleanly.":
    "Nur {dpi} dpi in dieser Gr\u00f6\u00dfe \u2013 ab {good} dpi wird es sauber.",
  "Text is {pt} pt — under {small} pt it gets hard to read in print.":
    "Text ist {pt} pt \u2013 unter {small} pt wird es im Druck schwer lesbar.",
  "Sticks {mm} mm past the cut line — that part gets trimmed off.":
    "Ragt {mm} mm \u00fcber die Schnittlinie \u2013 dieser Teil wird abgeschnitten.",
  "Only {mm} mm from the cut line — keep {safe} mm clear so a drifting cut can't clip it.":
    "Nur {mm} mm von der Schnittlinie \u2013 lass {safe} mm frei, damit ein versetzter Schnitt nichts abschneidet.",
  "This card has no layers yet.": "Diese Karte hat noch keine Ebenen.",

  // ── Logo sweep ───────────────────────────────────────────────────────────
  "Logo slot": "Logo-Platzhalter",
  "Shrink to fit": "Automatisch verkleinern",
  "max.": "max.",
  "line(s)": "Zeile(n)",
  "\u201cSize px\u201d is the largest it may get \u2014 long titles shrink to fit the box width.":
    "\u201eGr\u00f6\u00dfe px\u201c ist das Maximum \u2013 lange Titel werden verkleinert, bis sie in die Boxbreite passen.",
  "Snap to guides, the card edges and other layers":
    "An Hilfslinien, Kartenr\u00e4ndern und anderen Ebenen einrasten",
  "Find logos": "Logos suchen",
  "Logo {n} / {total}:": "Logo {n} / {total}:",
  "Click a logo to insert it \u2013 then it moves to the next console.":
    "Logo anklicken zum Einf\u00fcgen \u2013 dann geht es zur n\u00e4chsten Konsole.",
  "Find logos \u2013 every console": "Logos suchen \u2013 jede Konsole",
  "Looking for consoles without a logo \u2026":
    "Konsolen ohne Logo werden gesucht \u2026",
  "{n} console logo(s) inserted.": "{n} Konsolen-Logo(s) eingef\u00fcgt.",
  "Every console already has a logo.": "Jede Konsole hat bereits ein Logo.",

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

  // ── ZaparooImportDialog ──────────────────────────────────────────────────
  "Zaparoo (MiSTer) …": "Zaparoo (MiSTer) …",
  "Import from Zaparoo (MiSTer)": "Aus Zaparoo (MiSTer) importieren",
  "Address of the MiSTer (or other Zaparoo device). The dev server forwards the request — Zaparoo Core must be running.":
    "Adresse des MiSTer (oder eines anderen Zaparoo-Geräts). Der Dev-Server leitet die Anfrage weiter – Zaparoo Core muss laufen.",
  Connect: "Verbinden",
  "Connected to Zaparoo {version} on {platform}.":
    "Verbunden mit Zaparoo {version} auf {platform}.",
  "{n} systems": "{n} Systeme",
  "~{n} games": "~{n} Spiele",
  "List games": "Spiele auflisten",
  "Import games": "Spiele importieren",
  "Fetching games … {n}": "Spiele werden geladen … {n}",
  "Imported {games} games across {consoles} systems — with metadata.":
    "{games} Spiele aus {consoles} Systemen übernommen – mit Metadaten.",
  "Nothing to import.": "Nichts zu importieren.",
  "Enter the Zaparoo / MiSTer address first.": "Zuerst die Zaparoo-/MiSTer-Adresse eingeben.",
  "The dev server isn't reachable — is it running?":
    "Der Dev-Server ist nicht erreichbar – läuft er?",
  "Can't reach Zaparoo at {host}. Check the address and that Zaparoo Core is running.":
    "Zaparoo unter {host} nicht erreichbar. Prüfe die Adresse und ob Zaparoo Core läuft.",
  "Zaparoo error (HTTP {status}).": "Zaparoo-Fehler (HTTP {status}).",
  "{host} isn't a local address — this only reaches a device on your network.":
    "{host} ist keine lokale Adresse – erreichbar ist nur ein Gerät in deinem Netzwerk.",
  "Zaparoo: {message}": "Zaparoo: {message}",
  "Cancelled.": "Abgebrochen.",
  "Selected for import": "F\u00fcr den Import ausgew\u00e4hlt",
  "{n} games available": "{n} Spiele verf\u00fcgbar",
  "No games found.": "Keine Spiele gefunden.",
  "Pick games or whole consoles on the left \u2014 they move here.":
    "W\u00e4hle links Spiele oder ganze Konsolen aus \u2013 sie wandern hierher.",

  // \u2500\u2500 ApiKeysDialog \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  "API keys": "API-Schl\u00fcssel",
  "API keys \u2026": "API-Schl\u00fcssel \u2026",
  "Keys for the cover-art search. They are stored on this machine only and go through the local dev server to the service \u2014 nowhere else.":
    "Schl\u00fcssel f\u00fcr die Cover-Suche. Sie werden nur auf diesem Rechner gespeichert und gehen \u00fcber den lokalen Dev-Server an den Dienst \u2013 sonst nirgendwohin.",
  "SteamGridDB API key": "SteamGridDB-API-Schl\u00fcssel",
  "IGDB (Twitch) credentials": "IGDB-(Twitch-)Zugangsdaten",
  "TMDB API key": "TMDB-API-Schl\u00fcssel",
  "get a key": "Schl\u00fcssel anlegen",
  "Saved.": "Gespeichert.",

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
  // \u2500\u2500 Templates (import / export / viewer) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  Templates: "Vorlagen",
  "Templates \u2026": "Vorlagen \u2026",
  "A template is the whole shared look: the \u201cAll consoles\u201d layers plus every console template. Applying one leaves your cards' own layers alone.":
    "Eine Vorlage ist das komplette gemeinsame Aussehen: die Ebenen aus \u201eAlle Konsolen\u201c plus jede Konsolen-Vorlage. Beim Anwenden bleiben die eigenen Ebenen deiner Karten unber\u00fchrt.",
  "Save the current templates as \u2026": "Aktuelle Vorlagen speichern als \u2026",
  "Name, e.g. \u201cNeon arcade\u201d": "Name, z. B. \u201eNeon Arcade\u201c",
  "Import JSON \u2026": "JSON importieren \u2026",
  "Export JSON": "Als JSON exportieren",
  "Rendering preview \u2026": "Vorschau wird gerendert \u2026",
  "Reading \u2026": "Wird gelesen \u2026",
  "Applying \u2026": "Wird angewendet \u2026",
  Apply: "Anwenden",
  "no preview": "keine Vorschau",
  "{n} console template(s)": "{n} Konsolen-Vorlage(n)",
  "No templates yet. Save the current one above, or import a JSON file.":
    "Noch keine Vorlagen. Speichere oben die aktuelle oder importiere eine JSON-Datei.",
  "Apply \u201c{name}\u201d? It replaces the global template and {n} console template(s). Your cards keep their own layers.":
    "\u201e{name}\u201c anwenden? Ersetzt die globale Vorlage und {n} Konsolen-Vorlage(n). Deine Karten behalten ihre eigenen Ebenen.",
  "That file isn't valid JSON.": "Diese Datei ist kein g\u00fcltiges JSON.",
  "Not a template file.": "Keine Vorlagen-Datei.",
  "The template is empty.": "Die Vorlage ist leer.",
  // \u2500\u2500 Condition layers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  Condition: "Bedingung",
  Title: "Titel",
  "Metadata field": "Metadaten-Feld",
  "Value on this card": "Wert auf dieser Karte",
  "nothing in the gamelist \u2014 the \u201cDefault\u201d case is used":
    "nichts in der gamelist \u2013 es greift der Fall \u201eDefault\u201c",
  "Draws nothing on its own. The layers under it are its cases: the case whose name matches the field's value is drawn, and with no match the one named \u201cDefault\u201d.":
    "Zeichnet selbst nichts. Die Ebenen darunter sind seine F\u00e4lle: Gezeichnet wird der Fall, dessen Name dem Wert des Feldes entspricht \u2013 trifft keiner zu, der Fall namens \u201eDefault\u201c.",
  "Cases ({n})": "F\u00e4lle ({n})",
  "No cases yet. Add a layer while this one is selected \u2014 it joins the condition, and its name is the value it stands for.":
    "Noch keine F\u00e4lle. F\u00fcge eine Ebene hinzu, w\u00e4hrend diese ausgew\u00e4hlt ist \u2013 sie geh\u00f6rt dann zur Bedingung, und ihr Name ist der Wert, f\u00fcr den sie steht.",
  fallback: "Standard",
  "Shown by condition": "Anzeige \u00fcber Bedingung",
  "Always shown": "Immer anzeigen",
  "The fallback: drawn when no other case matches.":
    "Der Standardfall: wird gezeichnet, wenn kein anderer Fall zutrifft.",
  "Drawn when {field} is \u201c{value}\u201d \u2014 this layer's name is the value.":
    "Wird gezeichnet, wenn {field} \u201e{value}\u201c ist \u2013 der Name dieser Ebene ist der Wert.",
  // \u2500\u2500 Flowing text frames \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  "Flow around alpha masks": "Um Alphamasken umbrechen",
  "The text becomes a frame: lines break around the alpha mask frames instead of running under the images. Drag its handles to resize the frame.":
    "Der Text wird zum Rahmen: Die Zeilen brechen um die Alphamasken herum, statt unter den Bildern zu verschwinden. Zieh an den Anfassern, um den Rahmen zu \u00e4ndern.",
  "Frame height": "Rahmenh\u00f6he",
  Clearance: "Abstand",
};
