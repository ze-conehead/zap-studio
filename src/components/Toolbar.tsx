import { Box, Check, History, LayoutGrid, Redo2, Undo2 } from "lucide-react";
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
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MIN_ZOOM, MAX_ZOOM } from "./EditorCanvas";
import { useStore } from "../store";
import { useT } from "../i18n";
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
    <header className="relative z-20 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-sidebar px-3.5 py-2">
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
        <label className="flex items-center gap-1.5" title={t("Snap to guides, the card edges and other layers")}>
          <Checkbox
            checked={guides.state.snap}
            onCheckedChange={(v) => guides.setSnap(!!v)}
          />
          {t("Snap")}
        </label>
      </div>

      {/* Centred on the whole bar, independent of the controls on the left. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="pointer-events-auto flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={onOpenPreview}>
            <Box /> {t("Preview")}
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenOverview}>
            <LayoutGrid /> {t("Preview all")}
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2 px-1" title={t("Zoom — Ctrl/Cmd + scroll, or middle-drag to pan")}>
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
