// A short, optional first-run tour: the order things build on each other in,
// from API keys through to a backup. Shown once on a fresh install (the flag
// below is app-level, not per workspace) and reopenable from Extra ▸
// Walkthrough. Each step's action button jumps to the real thing and closes
// the tour — some targets (the global template, the 3D preview) replace what
// is behind the dialog, so staying open would only hide them.

import {
  ArrowRight,
  Eye,
  FileDown,
  FolderPlus,
  KeyRound,
  Layers,
  ShieldCheck,
  Sparkles,
  SquareDashed,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useT } from "../i18n";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

const KEY = "stickerstudio:walkthroughSeen";

export function walkthroughSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true; // no storage → never nag
  }
}

export function markWalkthroughSeen(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

export interface WalkthroughTargets {
  onOpenApiKeys: () => void;
  onOpenWorkspaces: () => void;
  onOpenGlobal: () => void;
  onOpenPreview: () => void;
  onOpenDataSafety: () => void;
}

interface Step {
  icon: LucideIcon;
  title: string;
  body: string;
  actionLabel?: string;
  action?: () => void;
}

export function WalkthroughDialog({
  open,
  onOpenChange,
  targets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: WalkthroughTargets;
}) {
  const t = useT();
  const [i, setI] = useState(0);

  const close = () => {
    markWalkthroughSeen();
    onOpenChange(false);
    setI(0);
  };

  const jump = (run: () => void) => {
    close();
    run();
  };

  const steps: Step[] = [
    {
      icon: Sparkles,
      title: t("Welcome to Zap-Studio"),
      body: t(
        "This short tour walks through the app once, in the order things build on each other. You can skip it and reopen it any time from Extra ▸ Walkthrough.",
      ),
    },
    {
      icon: KeyRound,
      title: t("1. Enter your API keys"),
      body: t(
        "Cover search runs on a free API key: SteamGridDB or IGDB for games, TMDB for movies. Without one, only the keyless libretro-thumbnails fallback works, and that only covers retro consoles. Settings ▸ API keys …",
      ),
      actionLabel: t("Open API keys …"),
      action: () => jump(targets.onOpenApiKeys),
    },
    {
      icon: FolderPlus,
      title: t("2. Create a project"),
      body: t(
        "A project is a library of its own — its own consoles, cards and templates, shared with nothing else. When you create one you choose games or movies, and the format: credit card, cassette label, DVD wrap, or your own size in mm. File ▸ New project …",
      ),
      actionLabel: t("Open projects …"),
      action: () => jump(targets.onOpenWorkspaces),
    },
    {
      icon: Layers,
      title: t("3. How the levels stack"),
      body: t(
        "Three levels, bottom to top: “All consoles” is the global template and shows on every card, each console has its own template, and each game has its own card. Every level holds layers — images, text, shapes, metadata badges from the gamelist, and conditions that swap layers by genre, year or rating.",
      ),
    },
    {
      icon: SquareDashed,
      title: t("4. Add an alpha mask"),
      body: t(
        "In “All consoles”, add an “Alpha mask” layer and put it where the artwork belongs. It is the frame every game cover drops into: covers are clipped to it and sized to its box, on all cards at once. Move it later and the covers follow.",
      ),
      actionLabel: t("Open “All consoles”"),
      action: () => jump(targets.onOpenGlobal),
    },
    {
      icon: Eye,
      title: t("5. Check it in the preview"),
      body: t(
        "“Preview” shows the card in 3D — drag to tilt it, and turn it over if it has a back side. “Preview all” lays out every card of the project side by side.",
      ),
      actionLabel: t("Open preview"),
      action: () => jump(targets.onOpenPreview),
    },
    {
      icon: FileDown,
      title: t("6. Export"),
      body: t(
        "File ▸ Export writes a PNG — trimmed, with bleed, or with bleed and crop marks. For printing there is a cut sheet with several cards per page, and a card-tray PDF for printers that take PVC cards directly.",
      ),
    },
    {
      icon: ShieldCheck,
      title: t("7. Set up a backup"),
      body: t(
        "Everything lives in this browser's local database — clearing the site data deletes it. Under “Data safety” you can point the app at a folder, and it keeps a rolling set of backup .zip files there for you.",
      ),
      actionLabel: t("Open data safety …"),
      action: () => jump(targets.onOpenDataSafety),
    },
  ];

  const step = steps[i];
  const last = i === steps.length - 1;
  const Icon = step.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="flex max-w-md flex-col gap-4">
        <DialogHeader>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {t("{n} of {total}", { n: i + 1, total: steps.length })}
          </span>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-4 shrink-0 text-primary" />
            {step.title}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>

        {step.action && (
          <Button variant="outline" size="sm" className="self-start" onClick={step.action}>
            {step.actionLabel}
            <ArrowRight className="size-3.5" />
          </Button>
        )}

        <div className="mt-1 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={close}>
            {last ? t("Close") : t("Skip")}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={i === 0}
              onClick={() => setI((n) => Math.max(0, n - 1))}
            >
              {t("Previous")}
            </Button>
            <Button size="sm" onClick={() => (last ? close() : setI((n) => n + 1))}>
              {last ? t("Done") : t("Next")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
