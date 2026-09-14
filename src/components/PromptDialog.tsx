// A single-line text-input modal, replacing window.prompt() — Electron
// doesn't implement prompt() (it throws "prompt() is not supported."), so
// every rename/new-name flow needs a real dialog instead.

import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";

export interface PromptState {
  title: string;
  defaultValue?: string;
  placeholder?: string;
  submitLabel?: string;
  onSubmit: (value: string) => void;
}

export function PromptDialog({
  state,
  onOpenChange,
}: {
  state: PromptState | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (state) setValue(state.defaultValue ?? "");
  }, [state]);

  if (!state) return null;

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    state.onSubmit(v);
    onOpenChange(false);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-4">
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={value}
          placeholder={state.placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("Cancel")}
          </Button>
          <Button size="sm" onClick={submit}>
            {state.submitLabel ?? t("OK")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
