// Photoshop-style menu bar: the app's full command set, grouped into File /
// Edit / View / Settings. The toolbar underneath keeps the handful of things
// worth one click; everything lives here.
//
// Radix' DropdownMenu has no menubar mode, so the "hover to walk across the
// open menus" behaviour is wired up by hand via `openMenu`.

import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getCoverSource, setCoverSource, type CoverSource } from "../covers";
import { EXPORT_MODES, exportLabel } from "../export";
import { FORMAT_IDS, FORMATS, getFormat, getFormatId, setFormat } from "../formats";
import { useLang, useT } from "../i18n";
import { useStore } from "../store";
import {
  accentColor,
  setTheme,
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

interface Props {
  canvas: React.MutableRefObject<CanvasHandle | null>;
  guides: GuideApi;
  onNewProject: () => void;
  onOpenProjects: () => void;
  onOpenPreview: () => void;
  onOpenDemo: () => void;
  onOpenCutSheet: () => void;
  onOpenBaseImport: () => void;
  onOpenQuickImport: () => void;
  onImportJson: (file: File) => void;
}

type MenuId = "file" | "edit" | "view" | "settings";

export function MenuBar({
  canvas,
  guides,
  onNewProject,
  onOpenProjects,
  onOpenPreview,
  onOpenDemo,
  onOpenCutSheet,
  onOpenBaseImport,
  onOpenQuickImport,
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
      <span className="px-2 text-[13px] font-semibold text-foreground">
        {t("Sticker Studio")}
      </span>

      <Menu id="file" label={t("File")}>
        <DropdownMenuItem onClick={onNewProject}>{t("New card")}</DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenProjects}>{t("Open project …")}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("Project file")}</DropdownMenuLabel>
        <DropdownMenuItem onClick={file.saveJson}>{t("Save as JSON")}</DropdownMenuItem>
        <DropdownMenuItem onClick={file.openJson}>{t("Load JSON …")}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <Sub label={t("Export")}>
          <DropdownMenuLabel>{t("This card")}</DropdownMenuLabel>
          {EXPORT_MODES.map((m) => (
            <DropdownMenuItem key={m} onClick={() => void file.runExport(m)}>
              {exportLabel(m)}
            </DropdownMenuItem>
          ))}
          <DropdownMenuLabel>{t("Multiple cards")}</DropdownMenuLabel>
          <DropdownMenuItem onClick={onOpenCutSheet}>
            {t("Print / cut sheet (Cricut · wir-machen-druck) …")}
          </DropdownMenuItem>
        </Sub>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("Import")}</DropdownMenuLabel>
        <DropdownMenuItem onClick={onOpenBaseImport}>{t("Base set …")}</DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenQuickImport}>Quick Import …</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("Full backup")}</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => void file.saveBackup()}>
          {t("Save backup (.zip)")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={file.openZip}>{t("Load backup …")}</DropdownMenuItem>
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
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!selectedId}
          onClick={() => selectedId && dispatch({ type: "DELETE_LAYER", id: selectedId })}
        >
          {t("Delete layer")}
        </DropdownMenuItem>
      </Menu>

      <Menu id="view" label={t("View")}>
        <Toggle
          checked={showBleed}
          onSelect={() => dispatch({ type: "TOGGLE", key: "showBleed" })}
        >
          {t("Bleed")}
        </Toggle>
        <Toggle checked={guides.state.on} onSelect={() => guides.toggle()}>
          {t("Guides")}
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
        <DropdownMenuItem onClick={onOpenPreview}>{t("3D preview")}</DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenDemo}>{t("Demo mode")}</DropdownMenuItem>
      </Menu>

      <Menu id="settings" label={t("Settings")}>
        <Sub label={t("Theme")} value={t(theme.name)}>
          {THEME_IDS.map((id) => (
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
              onClick={() => setFormat(id)}
            >
              {t(FORMATS[id].name)}
            </DropdownMenuItem>
          ))}
        </Sub>

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

        <Sub label={t("Cover source")} value={coverSource.toUpperCase()}>
          {(["sgdb", "igdb", "libretro"] as CoverSource[]).map((s) => (
            <DropdownMenuItem
              key={s}
              onSelect={(e) => (e.preventDefault(), setCoverSource(s))}
            >
              {s === "sgdb" ? "SteamGridDB" : s === "igdb" ? "IGDB" : "libretro-thumbnails"}
              <Check className={cn("ml-auto size-4", s !== coverSource && "opacity-0")} />
            </DropdownMenuItem>
          ))}
        </Sub>
      </Menu>

      {file.busy && (
        <span className="ml-auto rounded bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
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
