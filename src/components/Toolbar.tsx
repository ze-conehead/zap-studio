import {
  Box,
  FilePlus2,
  FolderOpen,
  LayoutGrid,
  MoveHorizontal,
  MoveVertical,
  Redo2,
  Ruler,
  Sparkles,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useStore } from "../store";
import { useT } from "../i18n";
import type { GuideApi } from "../App";

interface Props {
  guides: GuideApi;
  onNewProject: () => void;
  onOpenProjects: () => void;
  onOpenPreview: () => void;
  onOpenDemo: () => void;
  onOpenOverview: () => void;
}

export function Toolbar({
  guides,
  onNewProject,
  onOpenProjects,
  onOpenPreview,
  onOpenDemo,
  onOpenOverview,
}: Props) {
  const { state, dispatch } = useStore();
  const t = useT();
  const { project, past, future, showBleed } = state;






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
        {guides.state.items.length > 0 && (
          <label
            className={cn(
              "flex items-center gap-1.5",
              !guides.state.on && "opacity-40",
            )}
          >
            <Checkbox
              checked={guides.state.snap}
              disabled={!guides.state.on}
              onCheckedChange={(v) => guides.setSnap(!!v)}
            />
            {t("Snap")}
          </label>
        )}
        {project.isGlobalTemplate && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title={t("Add guide")}>
                <Ruler />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => guides.add("x")}>
                <MoveVertical /> {t("Vertical guide")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => guides.add("y")}>
                <MoveHorizontal /> {t("Horizontal guide")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={onOpenOverview}>
          <LayoutGrid /> {t("All cards")}
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenDemo}>
          <Sparkles /> Demo
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenPreview}>
          <Box /> {t("3D preview")}
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenProjects}>
          <FolderOpen /> {t("Designs")}
        </Button>
        <Button variant="outline" size="sm" onClick={onNewProject}>
          <FilePlus2 /> {t("New")}
        </Button>
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
