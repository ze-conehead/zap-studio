import { describe, expect, it, vi } from "vitest";
import { fold, matchScore, searchCommands, type Command } from "./commands";

const cmd = (id: string, title: string, over: Partial<Command> = {}): Command => ({
  id,
  title,
  group: "Actions",
  run: vi.fn(),
  ...over,
});

describe("fold", () => {
  it("ignores case and accents", () => {
    expect(fold("Größe")).toBe("grosse");
    expect(fold("PokÉmon")).toBe("pokemon");
  });
});

describe("matchScore", () => {
  it("needs every word, in the title or its group / hint / keywords", () => {
    const c = cmd("a", "Export to print …", { keywords: "png pdf" });
    expect(matchScore(c, "export")).not.toBeNull();
    expect(matchScore(c, "export pdf")).not.toBeNull(); // keyword
    expect(matchScore(c, "export zip")).toBeNull();
    expect(matchScore(c, "")).toBe(0);
  });

  it("a start of the title beats a start of a word beats a hit inside beats a keyword", () => {
    const c = cmd("a", "Manage logos …", { keywords: "bilder" });
    const s = (q: string) => matchScore(c, q)!;
    expect(s("man")).toBeLessThan(s("logo"));
    expect(s("logo")).toBeLessThan(s("nage"));
    expect(s("nage")).toBeLessThan(s("bilder"));
  });

  it("finds across languages' accents", () => {
    expect(matchScore(cmd("a", "Größe"), "grosse")).not.toBeNull();
  });
});

describe("searchCommands", () => {
  const all = [
    cmd("action:export", "Export to print …"),
    cmd("action:export-project", "Export project as .zip"),
    cmd("action:preview", "3D preview"),
    cmd("go:game:ps/tekken", "Tekken 3", { group: "Go to", hint: "PlayStation" }),
    cmd("go:console:ps", "PlayStation", { group: "Go to", hint: "Console template" }),
    cmd("theme:lime", "Theme: Lime", { group: "Settings" }),
    cmd("layer:1", "Logo", { group: "Layers" }),
  ];

  it("lists the everyday actions first when nothing is typed — not every card", () => {
    const ids = searchCommands(all, "").map((c) => c.id);
    expect(ids).toContain("action:export");
    expect(ids).toContain("layer:1");
    expect(ids).not.toContain("go:game:ps/tekken");
    expect(ids).not.toContain("theme:lime");
  });

  it("puts the recently run ones on top", () => {
    const ids = searchCommands(all, "", ["action:preview", "gone"]).map((c) => c.id);
    expect(ids[0]).toBe("action:preview");
    expect(ids.filter((i) => i === "action:preview")).toHaveLength(1);
  });

  it("finds cards by title or console, best match first", () => {
    expect(searchCommands(all, "tek").map((c) => c.id)).toEqual(["go:game:ps/tekken"]);
    const play = searchCommands(all, "playstation").map((c) => c.id);
    expect(play[0]).toBe("go:console:ps"); // title match before the card whose hint says PlayStation
    expect(play).toContain("go:game:ps/tekken");
  });

  it("every word has to match, in any order", () => {
    expect(searchCommands(all, "print export").map((c) => c.id)).toEqual(["action:export"]);
    expect(searchCommands(all, "export zzz")).toEqual([]);
  });

  it("keeps the original order between equal matches, and caps the list", () => {
    expect(searchCommands(all, "export").map((c) => c.id)).toEqual(["action:export", "action:export-project"]);
    const many = Array.from({ length: 200 }, (_, i) => cmd(`go:game:${i}`, `Game ${i}`, { group: "Go to" }));
    expect(searchCommands(many, "game")).toHaveLength(60);
  });
});
