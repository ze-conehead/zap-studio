// API keys for the cover-art search. These are the same keys the cover
// search dialog asks for on the fly — this is just a dedicated place to set
// them up front. Everything is kept in localStorage and only ever travels
// browser → local dev server → the service (see src/covers.ts).

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getCoverSource,
  getIgdbCreds,
  getSgdbKey,
  isConfigured,
  setCoverSource,
  setIgdbCreds,
  setSgdbKey,
  type CoverSource,
} from "../covers";
import { useT } from "../i18n";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const SOURCES: [CoverSource, string][] = [
  ["sgdb", "SteamGridDB"],
  ["igdb", "IGDB"],
  ["libretro", "libretro-thumbnails"],
];

export function ApiKeysDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [sgKey, setSgKey] = useState("");
  const [igId, setIgId] = useState("");
  const [igSecret, setIgSecret] = useState("");
  const [source, setSource] = useState<CoverSource>("sgdb");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSgKey(getSgdbKey());
    const c = getIgdbCreds();
    setIgId(c.clientId);
    setIgSecret(c.clientSecret);
    setSource(getCoverSource());
    setSaved(false);
  }, [open]);

  const touched = () => setSaved(false);

  const save = () => {
    setSgdbKey(sgKey.trim());
    setIgdbCreds(igId.trim(), igSecret.trim());
    setCoverSource(source);
    setSaved(true);
  };

  const needsKey = source !== "libretro" && !isConfigured(source);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-lg flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("API keys")}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          {t(
            "Keys for the cover-art search. They are stored on this machine only and go through the local dev server to the service — nowhere else.",
          )}
        </p>

        <div className="flex flex-col gap-1.5">
          <Label>{t("Use for cover search")}</Label>
          <div className="flex flex-wrap gap-1">
            {SOURCES.map(([s, label]) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSource(s);
                  touched();
                }}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium",
                  source === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {needsKey && (
            <p className="text-xs text-amber-500">
              {t(
                "No key for {source} yet — the search falls back to libretro-thumbnails (retro / emulated consoles only).",
                { source: source === "sgdb" ? "SteamGridDB" : "IGDB" },
              )}
            </p>
          )}
        </div>

        <KeyField
          label={t("SteamGridDB API key")}
          href="https://www.steamgriddb.com/profile/preferences/api"
        >
          <Input
            value={sgKey}
            autoComplete="off"
            spellCheck={false}
            placeholder={t("API key")}
            onChange={(e) => {
              setSgKey(e.target.value);
              touched();
            }}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </KeyField>

        <KeyField
          label={t("IGDB (Twitch) credentials")}
          href="https://dev.twitch.tv/console/apps"
        >
          <Input
            value={igId}
            autoComplete="off"
            spellCheck={false}
            placeholder={t("Client ID")}
            onChange={(e) => {
              setIgId(e.target.value);
              touched();
            }}
          />
          <Input
            value={igSecret}
            autoComplete="off"
            spellCheck={false}
            placeholder={t("Client secret")}
            onChange={(e) => {
              setIgSecret(e.target.value);
              touched();
            }}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </KeyField>

        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="text-xs text-muted-foreground">{t("Saved.")}</span>
          )}
          <Button onClick={save}>{t("Save")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KeyField({
  label,
  href,
  children,
}: {
  label: string;
  href: string;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 text-xs text-muted-foreground underline"
        >
          {t("get a key")}
          <ExternalLink className="size-3" />
        </a>
      </div>
      {children}
    </div>
  );
}
