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
import { useT } from "../i18n";
import { useStore } from "../store";
import { getWorkspaceKind } from "../workspace";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

export function MetadataPanel() {
  const t = useT();
  const { state } = useStore();
  const project = state.project;
  // Live-update if a gamelist.xml is uploaded/removed while this is open.
  useSyncExternalStore(subscribeGamelists, getGamelistVersion, getGamelistVersion);

  // The "Metadata" tab is only shown for game cards (see App.tsx), so
  // templates never reach here — but stay defensive.
  if (project.isTemplate) {
    return <Empty text={t("Metadata is per game.")} />;
  }

  const found = findGame(project.gameKey);
  const consoleId = project.gameKey?.split("/")[0];
  const title = found?.game.title ?? project.name;

  if (!consoleId) {
    return <Empty text={t("This design is not linked to a game from the tree.")} />;
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
  const t = useT();
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
            {t("Metadata")}
          </h2>
          <p className="mt-1 text-sm font-semibold">{title}</p>
        </div>
        {saved && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
            title={t("Delete entry")}
            onClick={handleDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      {!saved && (
        <p className="text-xs text-muted-foreground">
          {t("No entry for this game yet – just fill it in, it saves automatically.")}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{t("Rating")}</Label>
        <RatingPicker value={rating} onChange={setRating} />
      </div>

      <Field label={t("Image (URL or path)")}>
        <Input
          value={draft.image ?? ""}
          onChange={(e) => update({ image: e.target.value || undefined })}
          placeholder="https://…"
        />
      </Field>
      {draft.image && <ImagePreview src={draft.image} />}

      <Field label={t("Description")}>
        <Textarea
          value={draft.desc ?? ""}
          onChange={(e) => update({ desc: e.target.value || undefined })}
          rows={4}
        />
      </Field>

      <Field label={t("Release date")}>
        <Input
          type="date"
          value={toDateInputValue(draft.releasedate)}
          onChange={(e) => update({ releasedate: fromDateInputValue(e.target.value) })}
        />
      </Field>

      {getWorkspaceKind() === "movies" ? (
        <>
          <Field label={t("Director")}>
            <Input
              value={draft.director ?? ""}
              onChange={(e) => update({ director: e.target.value || undefined })}
            />
          </Field>

          <Field label={t("Studio")}>
            <Input
              value={draft.studio ?? ""}
              onChange={(e) => update({ studio: e.target.value || undefined })}
            />
          </Field>

          <Field label={t("Genre")}>
            <Input
              value={draft.genre ?? ""}
              onChange={(e) => update({ genre: e.target.value || undefined })}
            />
          </Field>

          <Field label={t("Runtime")}>
            <Input
              value={draft.runtime ?? ""}
              onChange={(e) => update({ runtime: e.target.value || undefined })}
              placeholder={t("e.g. 118 min")}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label={t("Developer")}>
            <Input
              value={draft.developer ?? ""}
              onChange={(e) => update({ developer: e.target.value || undefined })}
            />
          </Field>

          <Field label={t("Publisher")}>
            <Input
              value={draft.publisher ?? ""}
              onChange={(e) => update({ publisher: e.target.value || undefined })}
            />
          </Field>

          <Field label={t("Genre")}>
            <Input
              value={draft.genre ?? ""}
              onChange={(e) => update({ genre: e.target.value || undefined })}
            />
          </Field>

          <Field label={t("Players")}>
            <Input
              value={draft.players ?? ""}
              onChange={(e) => update({ players: e.target.value || undefined })}
              placeholder={t("e.g. 1-4")}
            />
          </Field>
        </>
      )}
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
  const t = useT();
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
            title={t("{n} of 5 stars (left/right half for half steps)", { n: i + 1 })}
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
  const t = useT();
  if (!/^(https?:|data:)/.test(src)) {
    return (
      <p className="truncate text-xs text-muted-foreground" title={src}>
        {t("Image (local path): {src}", { src })}
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
  const t = useT();
  return (
    <section className="p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("Metadata")}
      </h2>
      <p className="text-xs text-muted-foreground">{text}</p>
    </section>
  );
}
