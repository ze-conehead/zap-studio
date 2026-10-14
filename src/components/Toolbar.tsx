import { Box, Check, History, LayoutGrid, Redo2, SlidersHorizontal, Undo2 } from "lucide-react";
import { useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { describeChange } from "../historyLabel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MIN_ZOOM, MAX_ZOOM } from "./EditorCanvas";
import { useStore } from "../store";
import { useT } from "../i18n";
import {
  DEFAULT_SNAP_STRENGTH,
  MAX_SNAP_STRENGTH,
  MIN_SNAP_STRENGTH,
  setSnapStrength,
  useSnapStrength,
} from "../snapSettings";
import { useSnapSuspended } from "../snapSuspend";
import { setKeepView, setMinimap, useKeepView, useMinimap } from "../viewState";
import type { GuideApi } from "../App";

interface Props {
  guides: GuideApi;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onOpenPreview: () => void;
  onOpenOverview: () => void;
}

export function Toolbar({
  guides,
  zoom,
  onZoomChange,
  onOpenPreview,
  onOpenOverview,
}: Props) {
  const { state, dispatch } = useStore();
  const t = useT();
  const { past, future, showBleed } = state;
  const keepView = useKeepView();
  const minimap = useMinimap();
  const snapStrength = useSnapStrength();
  // Ctrl held: snapping is paused — the checkbox shows it while the key is down.
  const paused = useSnapSuspended() && guides.state.snap;

  // The history list: every step, newest first, the current one marked.
  // Labels come from diffing neighbouring snapshots (src/historyLabel.ts).
  const timeline = useMemo(() => {
    const snaps = [...past, state.pending ?? state.project, ...future];
    return snaps.map((p, i) => ({
      index: i,
      label: i === 0 ? t("Opened") : describeChange(snaps[i - 1], p),
      current: i === past.length,
    }));
  }, [past, future, state.pending, state.project, t]);





  return (
    // Left controls | preview + zoom | (empty, takes what is left). The left
    // side wraps when the bar is too narrow for everything — it never runs
    // into the preview buttons.
    <header className="relative z-20 flex items-center gap-4 border-b bg-sidebar px-3.5 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
      <div className="flex items-center gap-1">
        <IconBtn
          label={t("Undo (⌘Z)")}
          disabled={!past.length}
          onClick={() => dispatch({ type: "UNDO" })}
        >
          <Undo2 />
        </IconBtn>
        <IconBtn
          label={t("Redo (⌘⇧Z)")}
          disabled={!future.length}
          onClick={() => dispatch({ type: "REDO" })}
        >
          <Redo2 />
        </IconBtn>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              title={t("History")}
              disabled={timeline.length < 2}
            >
              <History />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 w-72 overflow-y-auto">
            <DropdownMenuLabel>{t("History")}</DropdownMenuLabel>
            {[...timeline].reverse().map((e) => (
              <DropdownMenuItem
                key={e.index}
                className={cn("gap-2 text-xs", e.current && "bg-accent")}
                onSelect={() => dispatch({ type: "JUMP", to: e.index })}
              >
                <Check className={cn("size-3.5 shrink-0", !e.current && "opacity-0")} />
                <span className="truncate">{e.label}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">{e.index}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <label className="flex items-center gap-1.5">
          <Checkbox
            checked={showBleed}
            onCheckedChange={() => dispatch({ type: "TOGGLE", key: "showBleed" })}
          />
          {t("Bleed")}
        </label>
        <label className="flex items-center gap-1.5">
          <Checkbox
            checked={guides.state.on}
            onCheckedChange={() => guides.toggle()}
          />
          {t("Guides")}
        </label>
        <label
          className={cn("flex items-center gap-1.5", paused && "text-muted-foreground")}
          title={
            paused
              ? t("Snapping is paused while Ctrl is held")
              : t("Snap to guides, the card edges and other layers — hold Ctrl while moving or resizing to switch it off")
          }
        >
          <Checkbox
            checked={guides.state.snap && !paused}
            onCheckedChange={(v) => guides.setSnap(!!v)}
          />
          {t("Snap")}
          {paused && <span className="rounded border px-1 text-[10px] leading-4">Ctrl</span>}
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="-ml-1.5 size-6 text-muted-foreground"
              title={t("Snap settings")}
            >
              <SlidersHorizontal className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="flex w-64 flex-col gap-2.5 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("Snap strength")}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">{t("{n} px", { n: snapStrength })}</span>
            </div>
            <Slider
              min={MIN_SNAP_STRENGTH}
              max={MAX_SNAP_STRENGTH}
              step={1}
              value={[snapStrength]}
              onValueChange={([v]) => setSnapStrength(v)}
              aria-label={t("Snap strength")}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{t("Weak")}</span>
              <span>{t("Strong")}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("How close, in screen pixels, a layer has to get to a guide, the card edge or another layer before it jumps onto it.")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              disabled={snapStrength === DEFAULT_SNAP_STRENGTH}
              onClick={() => setSnapStrength(DEFAULT_SNAP_STRENGTH)}
            >
              {t("Reset")}
            </Button>
          </PopoverContent>
        </Popover>
        <label
          className="flex items-center gap-1.5"
          title={t("Keep the zoom and the scroll position when you switch to another card")}
        >
          <Checkbox checked={keepView} onCheckedChange={(v) => setKeepView(!!v)} />
          {t("Keep view")}
        </label>
        <label
          className="flex items-center gap-1.5"
          title={t("While zoomed in, show a small overview of the card with the visible part marked")}
        >
          <Checkbox checked={minimap} onCheckedChange={(v) => setMinimap(!!v)} />
          {t("Minimap")}
        </label>
      </div>

      </div>

      {/* Follows the left controls; the empty block after it takes the rest. */}
      <div className="flex shrink-0 items-center justify-center">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={onOpenPreview}>
            <Box /> {t("Preview")}
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenOverview}>
            <LayoutGrid /> {t("Preview all")}
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2 px-1" title={t("Zoom — scroll, or middle-drag to pan")}>
            <Slider
              className="w-28"
              min={MIN_ZOOM * 100}
              max={MAX_ZOOM * 100}
              step={5}
              value={[Math.round(zoom * 100)]}
              onValueChange={([v]) => onZoomChange(v / 100)}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="w-11 shrink-0 text-left text-xs tabular-nums text-muted-foreground hover:text-foreground"
                  onClick={() => onZoomChange(1)}
                >
                  {Math.round(zoom * 100)}%
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("Reset zoom to fit")}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1" />
    </header>
  );
}

function IconBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" disabled={disabled} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
