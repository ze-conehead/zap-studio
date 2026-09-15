// Photoshop-style menu bar: the app's full command set, grouped into File /
// Edit / View / Settings. The toolbar underneath keeps the handful of things
// worth one click; everything lives here.
//
// Radix' DropdownMenu has no menubar mode, so the "hover to walk across the
// open menus" behaviour is wired up by hand via `openMenu`.

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpCircle, Check, ChevronRight, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { isStale, lastBackupAt, useBackupStatus } from "../autobackup";
import {
  coverSourceLabel,
  coverSourcesFor,
  getCoverSource,
  getLogoSource,
  LOGO_SOURCES,
  logoSourceLabel,
  setCoverSource,
  setLogoSource,
} from "../covers";
import { getWorkspace, getWorkspaceKind, setWorkspaceFormat } from "../workspace";
import { EXPORT_MODES, exportLabel } from "../export";
import { FORMAT_IDS, FORMATS, getFormat, getFormatId, isCard, setFormat } from "../formats";
import { useLang, useT } from "../i18n";
import { useStore } from "../store";
import {
  accentColor,
  getThemeAuto,
  setTheme,
  setThemeAuto,
  setUiFont,
  THEME_IDS,
  THEMES,
  UI_FONTS,
  useTheme,
  useUiFont,
} from "../theme";
import type { GuideApi } from "../App";
import type { CanvasHandle } from "./EditorCanvas";
import { useFileActions } from "./fileActions";
import { checkForUpdate, dismissUpdate, type UpdateInfo } from "../updateCheck";

interface Props {
  canvas: React.MutableRefObject<CanvasHandle | null>;
  guides: GuideApi;
  onNewProject: () => void;
  onOpenProjects: () => void;
  onOpenPreview: () => void;
  onOpenDemo: () => void;
  onOpenCutSheet: () => void;
  onOpenExportAll: () => void;
  onOpenCardTray: () => void;
  onOpenBaseImport: () => void;
  onOpenQuickImport: () => void;
  onOpenZaparoo: () => void;
  onOpenOverview: () => void;
  onOpenDataSafety: () => void;
  onOpenWorkspaces: () => void;
  onOpenPreflight: () => void;
  onOpenTemplates: () => void;
  onOpenApiKeys: () => void;
  onOpenCustomFonts: () => void;
  onOpenManageLogos: () => void;
  onOpenManageCovers: () => void;
  onOpenBleed: () => void;
  onOpenWalkthrough: () => void;
  onOpenShortcuts: () => void;
  onImportJson: (file: File) => void;
}

type MenuId = "file" | "edit" | "view" | "extra" | "settings";

export function MenuBar({
  canvas,
  guides,
  onNewProject,
  onOpenProjects,
  onOpenPreview,
  onOpenDemo,
  onOpenCutSheet,
  onOpenExportAll,
  onOpenCardTray,
  onOpenBaseImport,
  onOpenQuickImport,
  onOpenZaparoo,
  onOpenOverview,
  onOpenDataSafety,
  onOpenWorkspaces,
  onOpenPreflight,
  onOpenTemplates,
  onOpenApiKeys,
  onOpenCustomFonts,
  onOpenManageLogos,
  onOpenManageCovers,
  onOpenBleed,
  onOpenWalkthrough,
  onOpenShortcuts,
  onImportJson,
}: Props) {
  const t = useT();
  const [lang, setLang] = useLang();
  const theme = useTheme();
  const uiFont = useUiFont();
  const { state, dispatch } = useStore();
  const { project, past, future, showBleed, selectedId } = state;
  const [open, setOpen] = useState<MenuId | null>(null);
  const file = useFileActions(canvas);
  const coverSource = getCoverSource();
  const logoSource = getLogoSource();
  const backup = useBackupStatus();
  // `backup.lastAt` is what makes this re-evaluate after a run.
  const backupStale = backup.lastAt >= 0 && isStale();
  // Desktop only; null in the browser and when already up to date.
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  useEffect(() => {
    let alive = true;
    void checkForUpdate().then((u) => alive && setUpdate(u));
    return () => {
      alive = false;
    };
  }, []);

  // Once one menu is open, hovering a sibling switches to it.
  const hover = (id: MenuId) => () => {
    if (open && open !== id) setOpen(id);
  };

  const Menu = ({ id, label, children }: { id: MenuId; label: string; children: React.ReactNode }) => (
    // modal={false} keeps the rest of the bar clickable while a menu is open,
    // which is what lets the hover hand-off below work at all.
    <DropdownMenu
      modal={false}
      open={open === id}
      onOpenChange={(o) => setOpen(o ? id : null)}
    >
      <DropdownMenuTrigger
        onMouseEnter={hover(id)}
        className={cn(
          "rounded px-2.5 py-1 text-[13px] outline-none",
          open === id ? "bg-accent text-foreground" : "hover:bg-accent/70",
        )}
      >
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4} className="w-60">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // The shortcut hint on the right of a row.
  const Key = ({ k }: { k: string }) => (
    <span className="ml-auto pl-6 text-[11px] tabular-nums text-muted-foreground">
      {k}
    </span>
  );

  // A checkable row — Radix' checkbox item isn't wired up in this project.
  const Toggle = ({
    checked,
    onSelect,
    children,
  }: {
    checked: boolean;
    onSelect: () => void;
    children: React.ReactNode;
  }) => (
    <DropdownMenuItem onSelect={(e) => (e.preventDefault(), onSelect())}>
      <Check className={cn("size-4", !checked && "opacity-0")} />
      {children}
    </DropdownMenuItem>
  );

  // A nested list rendered inline behind a "›" header, so no extra Radix
  // sub-menu primitive is needed.
  const Sub = ({
    label,
    value,
    children,
  }: {
    label: string;
    value?: string;
    children: React.ReactNode;
  }) => {
    const [openSub, setOpenSub] = useState(false);
    return (
      <>
        <DropdownMenuItem
          onSelect={(e) => (e.preventDefault(), setOpenSub((v) => !v))}
          className="justify-between"
        >
          <span>{label}</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            {value}
            <ChevronRight className={cn("size-3.5 transition-transform", openSub && "rotate-90")} />
          </span>
        </DropdownMenuItem>
        {openSub && <div className="ml-2 border-l pl-1">{children}</div>}
      </>
    );
  };

  return (
    <div className="flex items-center gap-0.5 border-b bg-sidebar px-2 py-0.5 text-muted-foreground">
      <Menu id="file" label={t("File")}>
        <DropdownMenuItem onClick={onOpenWorkspaces}>
          {t("New project …")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenWorkspaces} className="justify-between">
          <span>{t("Switch project …")}</span>
          <span className="max-w-32 truncate text-muted-foreground">
            {getWorkspace().name}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onNewProject}>
          {t("New card")}
          <Key k="⌘N" />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenProjects}>{t("Open design …")}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("Design file")}</DropdownMenuLabel>
        <DropdownMenuItem onClick={file.saveJson}>{t("Save as JSON")}</DropdownMenuItem>
        <DropdownMenuItem onClick={file.openJson}>{t("Load JSON …")}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenPreflight}>
          {t("Preflight check …")}
        </DropdownMenuItem>
        <Sub label={t("Export")}>
          <DropdownMenuLabel>{t("This card")}</DropdownMenuLabel>
          {EXPORT_MODES.map((m) => (
            <DropdownMenuItem key={m} onClick={() => void file.runExport(m)}>
              {exportLabel(m)}
            </DropdownMenuItem>
          ))}
          {isCard() && (
            <DropdownMenuItem onClick={onOpenCardTray}>
              {t("PDF – card-tray printer …")}
            </DropdownMenuItem>
          )}
          <DropdownMenuLabel>{t("Multiple cards")}</DropdownMenuLabel>
          <DropdownMenuItem onClick={onOpenExportAll}>
            {t("All cards as PNG (.zip) …")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenCutSheet}>
            {t("Print / cut sheet (Cricut · wir-machen-druck) …")}
          </DropdownMenuItem>
        </Sub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenTemplates}>
          {t("Templates …")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("Import")}</DropdownMenuLabel>
        {getWorkspaceKind() === "games" && (
          <DropdownMenuItem onClick={onOpenBaseImport}>{t("Base set …")}</DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onOpenQuickImport}>Quick Import …</DropdownMenuItem>
        {getWorkspaceKind() === "games" && (
          <DropdownMenuItem onClick={onOpenZaparoo}>
            {t("Zaparoo (MiSTer) …")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("Full backup")}</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => void file.saveBackup()}>
          {t("Save backup (.zip)")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={file.openZip}>{t("Load backup …")}</DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenDataSafety}>
          {t("Data safety …")}
          {backupStale && <AlertTriangle className="ml-auto size-4 text-amber-400" />}
        </DropdownMenuItem>
      </Menu>

      <Menu id="edit" label={t("Edit")}>
        <DropdownMenuItem
          disabled={!past.length}
          onClick={() => dispatch({ type: "UNDO" })}
        >
          {t("Undo (⌘Z)")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!future.length}
          onClick={() => dispatch({ type: "REDO" })}
        >
          {t("Redo (⌘⇧Z)")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!selectedId}
          onClick={() =>
            selectedId && dispatch({ type: "DUPLICATE_LAYER", id: selectedId })
          }
        >
          {t("Duplicate layer")}
          <Key k="⌘D" />
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!selectedId}
          onClick={() => selectedId && dispatch({ type: "DELETE_LAYER", id: selectedId })}
        >
          {t("Delete layer")}
          <Key k="⌫" />
        </DropdownMenuItem>
      </Menu>

      <Menu id="view" label={t("View")}>
        <Toggle
          checked={showBleed}
          onSelect={() => dispatch({ type: "TOGGLE", key: "showBleed" })}
        >
          {t("Bleed")}
          <Key k="B" />
        </Toggle>
        <Toggle checked={guides.state.on} onSelect={() => guides.toggle()}>
          {t("Guides")}
          <Key k="G" />
        </Toggle>
        <Toggle
          checked={guides.state.snap}
          onSelect={() => guides.setSnap(!guides.state.snap)}
        >
          {t("Snap")}
        </Toggle>
        <Toggle
          checked={guides.state.locked}
          onSelect={() => guides.setLocked(!guides.state.locked)}
        >
          {t("Lock")}
        </Toggle>
        {project.isGlobalTemplate && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => guides.add("x")}>
              {t("Vertical guide")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => guides.add("y")}>
              {t("Horizontal guide")}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenOverview}>{t("All cards")}</DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenPreview}>
          {t("3D preview")}
          <Key k="P" />
        </DropdownMenuItem>
      </Menu>

      <Menu id="extra" label={t("Extra")}>
        <DropdownMenuItem onClick={onOpenWalkthrough}>
          {t("Walkthrough …")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenShortcuts} className="justify-between">
          {t("Keyboard shortcuts …")}
          <span className="text-xs text-muted-foreground">?</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenDemo}>
          {t("Demo mode (card packs)")}
        </DropdownMenuItem>
      </Menu>

      <Menu id="settings" label={t("Settings")}>
        <Sub label={t("Theme")} value={t(theme.name)}>
          <Toggle checked={getThemeAuto()} onSelect={() => setThemeAuto(!getThemeAuto())}>
            {t("Follow system light / dark")}
          </Toggle>
          <DropdownMenuSeparator />
          {THEME_IDS.filter((id) => THEMES[id].mode === "dark").map((id) => (
            <DropdownMenuItem
              key={id}
              onSelect={(e) => (e.preventDefault(), setTheme(id))}
            >
              <span
                className="size-3.5 rounded-full ring-1 ring-white/25"
                style={{ background: accentColor(THEMES[id]) }}
              />
              {t(THEMES[id].name)}
              <Check className={cn("ml-auto size-4", id !== theme.id && "opacity-0")} />
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {THEME_IDS.filter((id) => THEMES[id].mode === "light").map((id) => (
            <DropdownMenuItem
              key={id}
              onSelect={(e) => (e.preventDefault(), setTheme(id))}
            >
              <span
                className="size-3.5 rounded-full ring-1 ring-black/15"
                style={{ background: accentColor(THEMES[id]) }}
              />
              {t(THEMES[id].name)}
              <Check className={cn("ml-auto size-4", id !== theme.id && "opacity-0")} />
            </DropdownMenuItem>
          ))}
        </Sub>

        <Sub label={t("Interface font")} value={t(uiFont.name)}>
          {UI_FONTS.map((f) => (
            <DropdownMenuItem
              key={f.id}
              onSelect={(e) => (e.preventDefault(), setUiFont(f.id))}
            >
              <span style={{ fontFamily: f.stack }}>{t(f.name)}</span>
              <Check className={cn("ml-auto size-4", f.id !== uiFont.id && "opacity-0")} />
            </DropdownMenuItem>
          ))}
        </Sub>

        <Sub label={t("Format")} value={t(getFormat().name)}>
          {FORMAT_IDS.map((id) => (
            <DropdownMenuItem
              key={id}
              disabled={id === getFormatId()}
              onClick={() => {
                setWorkspaceFormat(id);
                setFormat(id); // reloads
              }}
            >
              {t(FORMATS[id].name)}
            </DropdownMenuItem>
          ))}
        </Sub>

        <DropdownMenuItem onClick={onOpenBleed}>
          {t("Bleed …")}
          <span className="ml-auto pl-4 text-xs text-muted-foreground">{getFormat().bleedMM} mm</span>
        </DropdownMenuItem>

        <Sub label={t("Language")} value={lang.toUpperCase()}>
          <DropdownMenuItem
            onSelect={(e) => (e.preventDefault(), setLang("en"))}
          >
            English
            <Check className={cn("ml-auto size-4", lang !== "en" && "opacity-0")} />
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => (e.preventDefault(), setLang("de"))}
          >
            Deutsch
            <Check className={cn("ml-auto size-4", lang !== "de" && "opacity-0")} />
          </DropdownMenuItem>
        </Sub>

        <Sub label={t("Cover source")} value={coverSourceLabel(coverSource)}>
          {coverSourcesFor(getWorkspaceKind()).map((s) => (
            <DropdownMenuItem
              key={s}
              onSelect={(e) => (e.preventDefault(), setCoverSource(s))}
            >
              {coverSourceLabel(s)}
              <Check className={cn("ml-auto size-4", s !== coverSource && "opacity-0")} />
            </DropdownMenuItem>
          ))}
        </Sub>

        <Sub label={t("Logo source")} value={logoSourceLabel(logoSource)}>
          {LOGO_SOURCES.map((s) => (
            <DropdownMenuItem
              key={s}
              onSelect={(e) => (e.preventDefault(), setLogoSource(s))}
            >
              {logoSourceLabel(s)}
              <Check className={cn("ml-auto size-4", s !== logoSource && "opacity-0")} />
            </DropdownMenuItem>
          ))}
        </Sub>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenApiKeys}>
          {t("API keys …")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenCustomFonts}>
          {t("Custom fonts …")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenManageLogos}>
          {t("Manage logos …")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenManageCovers}>
          {t("Manage covers …")}
        </DropdownMenuItem>
      </Menu>

      <div className="ml-auto" />

      {update && (
        <span className="flex items-center gap-1 rounded bg-primary/15 pl-2 text-[11px] text-primary">
          <a
            href={update.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 py-0.5 hover:underline"
            title={t("Open the release page")}
          >
            <ArrowUpCircle className="size-3.5" />
            {t("Version {v} available", { v: update.version })}
          </a>
          <button
            className="rounded p-1 hover:bg-accent"
            title={t("Dismiss")}
            onClick={() => {
              dismissUpdate(update.version);
              setUpdate(null);
            }}
          >
            <X className="size-3" />
          </button>
        </span>
      )}

      {backupStale && (
        <button
          onClick={onOpenDataSafety}
          title={
            lastBackupAt()
              ? t("Last backup: {when}", {
                  when: new Date(lastBackupAt()).toLocaleString(),
                })
              : t("No backup written yet.")
          }
          className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] text-amber-400 hover:bg-accent"
        >
          <AlertTriangle className="size-3.5" />
          {t("Back up your work")}
        </button>
      )}

      {file.busy && (
        <span className="rounded bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
          {file.busy}
        </span>
      )}

      <input
        ref={file.zipRef}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void file.loadBackup(f);
          e.target.value = "";
        }}
      />
      <input
        ref={file.jsonRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportJson(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
