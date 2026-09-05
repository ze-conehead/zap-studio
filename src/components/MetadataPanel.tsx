import { Star, Trash2 } from "lucide-react";
import { useState, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import { findGame } from "../data/catalog";
import {
  findMeta,
  fromDateInputValue,
  getGamelistVersion,
  loadGamelist,
  removeGameMeta,
  subscribeGamelists,
  toDateInputValue,
  upsertGameMeta,
  type GameMeta,
} from "../gamelist";
import { useStore } from "../store";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

export function MetadataPanel() {
  const { state } = useStore();
  const project = state.project;
  // Live-update if a gamelist.xml is uploaded/removed while this is open.
  useSyncExternalStore(subscribeGamelists, getGamelistVersion, getGamelistVersion);

  // The "Metadaten" tab is only shown for game cards (see App.tsx), so
  // templates never reach here — but stay defensive.
  if (project.isTemplate) {
    return <Empty text="Metadaten gelten pro Spiel." />;
  }

  const found = findGame(project.gameKey);
  const consoleId = project.gameKey?.split("/")[0];
  const title = found?.game.title ?? project.name;

  if (!consoleId) {
    return <Empty text="Dieses Design ist keinem Spiel aus dem Baum zugeordnet." />;
  }

  return (
    <GameMetaForm
      key={`${consoleId}/${title}`}
      consoleId={consoleId}
      title={title}
    />
  );
}

function GameMetaForm({ consoleId, title }: { consoleId: string; title: string }) {
  const games = loadGamelist(consoleId);
  const saved = findMeta(games, title);
  const [draft, setDraft] = useState<GameMeta>(() => saved ?? { name: title });

  function update(patch: Partial<GameMeta>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    upsertGameMeta(consoleId, title, patch);
  }

  function setRating(stars: number) {
    const clamped = Math.max(0, Math.min(5, stars));
    update({ rating: (clamped / 5).toFixed(3) });
  }

  function handleDelete() {
    removeGameMeta(consoleId, title);
    setDraft({ name: title });
  }

  const rating = draft.rating !== undefined ? Number(draft.rating) : undefined;

  return (
    <section className="flex flex-col gap-3 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Metadaten
          </h2>
          <p className="mt-1 text-sm font-semibold">{title}</p>
        </div>
        {saved && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
            title="Eintrag löschen"
            onClick={handleDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      {!saved && (
        <p className="text-xs text-muted-foreground">
          Noch kein Eintrag für dieses Spiel – einfach ausfüllen, es wird automatisch
          gespeichert.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Bewertung</Label>
        <RatingPicker value={rating} onChange={setRating} />
      </div>

      <Field label="Bild (URL oder Pfad)">
        <Input
          value={draft.image ?? ""}
          onChange={(e) => update({ image: e.target.value || undefined })}
          placeholder="https://…"
        />
      </Field>
      {draft.image && <ImagePreview src={draft.image} />}

      <Field label="Beschreibung">
        <Textarea
          value={draft.desc ?? ""}
          onChange={(e) => update({ desc: e.target.value || undefined })}
          rows={4}
        />
      </Field>

      <Field label="Release-Datum">
        <Input
          type="date"
          value={toDateInputValue(draft.releasedate)}
          onChange={(e) => update({ releasedate: fromDateInputValue(e.target.value) })}
        />
      </Field>

      <Field label="Entwickler">
        <Input
          value={draft.developer ?? ""}
          onChange={(e) => update({ developer: e.target.value || undefined })}
        />
      </Field>

      <Field label="Publisher">
        <Input
          value={draft.publisher ?? ""}
          onChange={(e) => update({ publisher: e.target.value || undefined })}
        />
      </Field>

      <Field label="Genre">
        <Input
          value={draft.genre ?? ""}
          onChange={(e) => update({ genre: e.target.value || undefined })}
        />
      </Field>

      <Field label="Spieler">
        <Input
          value={draft.players ?? ""}
          onChange={(e) => update({ players: e.target.value || undefined })}
          placeholder="z. B. 1-4"
        />
      </Field>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function RatingPicker({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (stars: number) => void;
}) {
  const v = value !== undefined && !Number.isNaN(value) ? Math.max(0, Math.min(1, value)) : 0;
  const starsValue = v * 5;

  function handleClick(i: number, e: MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    onChange(i + (fraction < 0.5 ? 0.5 : 1));
  }

  return (
    <div className="flex items-center gap-1 text-amber-400">
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.max(0, Math.min(1, starsValue - i));
        return (
          <button
            key={i}
            type="button"
            className="relative size-4 shrink-0 cursor-pointer"
            title={`${i + 1} von 5 Sternen (linke/rechte Hälfte für halbe Schritte)`}
            onClick={(e) => handleClick(i, e)}
          >
            <Star className="absolute inset-0 size-4" fill="none" />
            {fill > 0 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star className="size-4" fill="currentColor" />
              </span>
            )}
          </button>
        );
      })}
      {value !== undefined && (
        <span className="ml-1.5 text-xs text-muted-foreground">
          {starsValue.toFixed(1)} / 5
        </span>
      )}
    </div>
  );
}

function ImagePreview({ src }: { src: string }) {
  if (!/^(https?:|data:)/.test(src)) {
    return (
      <p className="truncate text-xs text-muted-foreground" title={src}>
        Bild (lokaler Pfad): {src}
      </p>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="max-h-40 w-full rounded-md border bg-muted object-contain"
    />
  );
}

function Empty({ text }: { text: string }) {
  return (
    <section className="p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Metadaten
      </h2>
      <p className="text-xs text-muted-foreground">{text}</p>
    </section>
  );
}
