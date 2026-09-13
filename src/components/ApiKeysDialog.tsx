// API keys for the cover-art search. These are the same keys the cover
// search dialog asks for on the fly — this is just a dedicated place to set
// them up front. Everything is kept in localStorage and only ever travels
// browser → local dev server → the service (see src/covers.ts).

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getIgdbCreds,
  getSgdbKey,
  getTmdbKey,
  setIgdbCreds,
  setSgdbKey,
  setTmdbKey,
} from "../covers";
import { useT } from "../i18n";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

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
  const [tmKey, setTmKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSgKey(getSgdbKey());
    const c = getIgdbCreds();
    setIgId(c.clientId);
    setIgSecret(c.clientSecret);
    setTmKey(getTmdbKey());
    setSaved(false);
  }, [open]);

  const touched = () => setSaved(false);

  const save = () => {
    setSgdbKey(sgKey.trim());
    setIgdbCreds(igId.trim(), igSecret.trim());
    setTmdbKey(tmKey.trim());
    setSaved(true);
  };

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

        <KeyField
          label={t("TMDB API key")}
          href="https://www.themoviedb.org/settings/api"
        >
          <Input
            value={tmKey}
            autoComplete="off"
            spellCheck={false}
            placeholder={t("API key")}
            onChange={(e) => {
              setTmKey(e.target.value);
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
