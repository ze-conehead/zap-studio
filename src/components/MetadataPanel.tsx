import { Star } from "lucide-react";
import { useSyncExternalStore } from "react";
import { findGame } from "../data/catalog";
import {
  findMeta,
  formatReleaseDate,
  getGamelistVersion,
  loadGamelist,
  subscribeGamelists,
} from "../gamelist";
import { useStore } from "../store";

export function MetadataPanel() {
  const { state } = useStore();
  const project = state.project;
  // Live-update if a gamelist.xml is uploaded/removed while this is open.
  useSyncExternalStore(subscribeGamelists, getGamelistVersion, getGamelistVersion);

  if (project.isGlobalTemplate) {
    return (
      <Empty text="Metadaten gelten pro Spiel – wähle ein Spiel im Baum links, um sie zu sehen." />
    );
  }
  if (project.isTemplate) {
    return (
      <Empty
        text={`Metadaten gelten pro Spiel. Lade die gamelist.xml für ${
          project.consoleName ?? "diese Konsole"
        } oben im Reiter „Eigenschaften" hoch.`}
      />
    );
  }

  const found = findGame(project.gameKey);
  const consoleId = project.gameKey?.split("/")[0];
  const title = found?.game.title ?? project.name;

  if (!consoleId) {
    return <Empty text="Dieses Design ist keinem Spiel aus dem Baum zugeordnet." />;
  }

  const games = loadGamelist(consoleId);
  if (games.length === 0) {
    return (
      <Empty
        text={`Für ${
          found?.console.name ?? project.consoleName ?? "diese Konsole"
        } wurde noch keine gamelist.xml hochgeladen. Konsolennamen im Baum anklicken, dann im Reiter „Eigenschaften" hochladen.`}
      />
    );
  }

  const meta = findMeta(games, title);
  if (!meta) {
    return (
      <Empty
        text={`Kein Eintrag für „${title}" in der geladenen gamelist.xml gefunden (${games.length} Einträge geladen).`}
      />
    );
  }

  const rating = meta.rating !== undefined ? Number(meta.rating) : undefined;

  return (
    <section className="flex flex-col gap-3 p-3">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Metadaten
        </h2>
        <p className="mt-1 text-sm font-semibold">{meta.name}</p>
      </div>

      {meta.image && <ImagePreview src={meta.image} />}

      {meta.desc && <p className="text-sm text-muted-foreground">{meta.desc}</p>}

      {rating !== undefined && !Number.isNaN(rating) && <Rating value={rating} />}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
        {meta.releasedate && <Row label="Release" value={formatReleaseDate(meta.releasedate)} />}
        {meta.developer && <Row label="Entwickler" value={meta.developer} />}
        {meta.publisher && <Row label="Publisher" value={meta.publisher} />}
        {meta.genre && <Row label="Genre" value={meta.genre} />}
        {meta.players && <Row label="Spieler" value={meta.players} />}
      </dl>

      {meta.path && (
        <p className="truncate text-xs text-muted-foreground" title={meta.path}>
          Pfad: {meta.path}
        </p>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate">{value}</dd>
    </>
  );
}

function Rating({ value }: { value: number }) {
  const v = Math.max(0, Math.min(1, value));
  const stars = Math.round(v * 5);
  return (
    <div className="flex items-center gap-0.5 text-amber-400">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className="size-4" fill={i < stars ? "currentColor" : "none"} />
      ))}
      <span className="ml-1.5 text-xs text-muted-foreground">{Math.round(v * 100)}%</span>
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
