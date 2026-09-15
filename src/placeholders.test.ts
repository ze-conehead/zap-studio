import { describe, expect, it } from "vitest";
import { addConsole, addGame, gameKeyOf, getCatalog } from "./data/catalog";
import { newConsoleTemplate, newGlobalTemplate, newProject } from "./factory";
import type { GameMeta } from "./gamelist";
import {
  hasPlaceholders,
  placeholderContextFor,
  placeholderKeysFor,
  placeholderLabel,
  placeholderValue,
  resolvePlaceholders,
} from "./placeholders";

const meta: GameMeta = {
  name: "Tekken 3",
  releasedate: "19980327T000000",
  genre: "Fighting",
  developer: "Namco",
  publisher: "Namco, Sony",
  players: "1-2",
  rating: "0.921",
  desc: "Iron fist.",
  ageRating: "USK 16",
  series: "Tekken",
  url: "https://example.com/t3",
  altTitle: "鉄拳3",
  themes: "Action",
  modes: "Single player, Multiplayer",
  perspective: "Side view",
  engine: "",
  storyline: "Story",
  ratingCount: "812",
};

describe("resolvePlaceholders", () => {
  const ctx = { title: "Tekken 3", console: "PlayStation", index: 5, count: 5, meta };

  it("fills every key it knows", () => {
    expect(resolvePlaceholders("{title} · {console} · {index}/{count}", ctx)).toBe(
      "Tekken 3 · PlayStation · 5/5",
    );
    expect(resolvePlaceholders("{year} {genre} {developer} {players} {rating}", ctx)).toBe(
      "1998 Fighting Namco 1-2 4.6",
    );
    expect(resolvePlaceholders("{age}|{series}|{url}|{alt}|{votes}", ctx)).toBe(
      "USK 16|Tekken|https://example.com/t3|鉄拳3|812",
    );
    expect(resolvePlaceholders("{date}", ctx)).toMatch(/1998/);
  });

  it("is case-insensitive and leaves unknown or empty tokens as typed", () => {
    expect(resolvePlaceholders("{TITLE}", ctx)).toBe("Tekken 3");
    expect(resolvePlaceholders("{nope} {engine}", ctx)).toBe("{nope} {engine}");
    expect(resolvePlaceholders("{director}", ctx)).toBe("{director}");
  });

  it("returns the text untouched without a context or without tokens", () => {
    expect(resolvePlaceholders("{title}", undefined)).toBe("{title}");
    expect(resolvePlaceholders("plain", ctx)).toBe("plain");
    expect(hasPlaceholders("a {b} c")).toBe(true);
    expect(hasPlaceholders("{}")).toBe(false);
  });

  it("placeholderValue mirrors the same lookup", () => {
    expect(placeholderValue("title", ctx)).toBe("Tekken 3");
    expect(placeholderValue("engine", ctx)).toBeUndefined();
    expect(placeholderValue("title", undefined)).toBeUndefined();
  });
});

describe("placeholderContextFor", () => {
  it("a linked card knows its title, console and position", () => {
    const c = addConsole("Test Console")!;
    addGame(c.id, "First");
    const g = addGame(c.id, "Second")!;
    const cons = getCatalog().find((x) => x.id === c.id)!;
    const ctx = placeholderContextFor({ ...newProject("x"), gameKey: gameKeyOf(cons, g) }, meta);
    expect(ctx).toMatchObject({ title: "Second", console: "Test Console", index: 2, count: 2 });
    expect(ctx.meta).toBe(meta);
  });

  it("a console template previews with its first entry, the global one keeps tokens", () => {
    const tpl = newConsoleTemplate("ps", "PlayStation");
    expect(placeholderContextFor(tpl, meta)).toMatchObject({ title: "Tekken 3", console: "PlayStation" });
    expect(placeholderContextFor(tpl, undefined).title).toBeUndefined();
    expect(placeholderContextFor(newGlobalTemplate(), meta)).toEqual({ meta });
  });

  it("an unlinked design uses its own name", () => {
    const ctx = placeholderContextFor(newProject("Loose"), undefined);
    expect(ctx.title).toBe("Loose");
  });
});

describe("placeholder keys per workspace kind", () => {
  it("hides the other kind's fields", () => {
    const games = placeholderKeysFor("games");
    const movies = placeholderKeysFor("movies");
    expect(games).toContain("developer");
    expect(games).not.toContain("director");
    expect(movies).toContain("cast");
    expect(movies).not.toContain("players");
    expect(games).toContain("title");
    expect(movies).toContain("title");
  });

  it("labels every key", () => {
    for (const k of placeholderKeysFor("games")) expect(placeholderLabel(k, "games")).toBeTruthy();
    for (const k of placeholderKeysFor("movies")) expect(placeholderLabel(k, "movies")).toBeTruthy();
    expect(placeholderLabel("console", "movies")).not.toBe(placeholderLabel("console", "games"));
  });
});
