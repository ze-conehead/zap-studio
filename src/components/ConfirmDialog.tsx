// A promise-based replacement for window.confirm(): `askConfirm()` resolves
// true/false once the user picks, so a call site stays a one-liner —
// `if (!(await askConfirm({...}))) return;` — instead of every component
// lifting its own dialog state. One <ConfirmHost/> mounted at the app root
// (outside the keyed StoreProvider, so a project switch can't unmount it
// mid-question) renders whatever is currently being asked.

import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  /** Styles the confirm button as destructive (delete / remove / overwrite). */
  destructive?: boolean;
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

let setPending: ((p: Pending | null) => void) | null = null;

export function askConfirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!setPending) {
      // Host not mounted (shouldn't happen) — fall back to the native one
      // rather than silently swallowing a destructive action's guard.
      resolve(window.confirm(opts.body ? `${opts.title}\n\n${opts.body}` : opts.title));
      return;
    }
    setPending({ ...opts, resolve });
  });
}

export function ConfirmHost() {
  const t = useT();
  const [pending, set] = useState<Pending | null>(null);

  useEffect(() => {
    setPending = set;
    return () => {
      setPending = null;
    };
  }, []);

  if (!pending) return null;

  const answer = (ok: boolean) => {
    pending.resolve(ok);
    set(null);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && answer(false)}>
      <DialogContent className="max-w-sm gap-4">
        <DialogHeader>
          <DialogTitle>{pending.title}</DialogTitle>
        </DialogHeader>
        {pending.body && (
          <p className="text-sm text-muted-foreground">{pending.body}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => answer(false)}>
            {t("Cancel")}
          </Button>
          <Button
            size="sm"
            variant={pending.destructive ? "destructive" : "default"}
            onClick={() => answer(true)}
          >
            {pending.confirmLabel ?? t("OK")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
