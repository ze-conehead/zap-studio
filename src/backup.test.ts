import { beforeEach, describe, expect, it } from "vitest";
import {
  exportBackup,
  getIncludeKeysInBackup,
  importBackup,
  setIncludeKeysInBackup,
} from "./backup";
import { getIgdbCreds, getSgdbKey, getTmdbKey, setIgdbCreds, setSgdbKey, setTmdbKey } from "./covers";
import { newProject } from "./factory";
import { deleteProject, loadAllProjects, saveProject } from "./persist";
import { strFromU8, unzipSync } from "fflate";

async function unzip(blob: Blob) {
  return unzipSync(new Uint8Array(await blob.arrayBuffer()));
}

beforeEach(async () => {
  for (const p of await loadAllProjects()) await deleteProject(p.id);
  setIncludeKeysInBackup(false);
  setSgdbKey("");
  setTmdbKey("");
  setIgdbCreds("", "");
});

describe("API keys in backups — off by default", () => {
  it("a plain backup carries no key material at all", async () => {
    setSgdbKey("sg-secret");
    setTmdbKey("tmdb-secret");
    setIgdbCreds("client-id", "client-secret");
    await saveProject(newProject("p"));

    expect(getIncludeKeysInBackup()).toBe(false);
    const { blob } = await exportBackup();
    const entries = await unzip(blob);
    expect(entries["settings/keys.json"]).toBeUndefined();
    const manifest = JSON.parse(strFromU8(entries["manifest.json"]));
    expect(manifest.includesApiKeys).toBe(false);

    // The zip's own bytes never spell out the secret either.
    const whole = strFromU8(new Uint8Array(await blob.arrayBuffer()), true);
    expect(whole.includes("sg-secret")).toBe(false);
  });

  it("switching it on includes the keys and flags the manifest; importing restores them", async () => {
    setSgdbKey("sg-secret");
    setTmdbKey("tmdb-secret");
    setIgdbCreds("client-id", "client-secret");
    setIncludeKeysInBackup(true);
    await saveProject(newProject("p"));

    const { blob } = await exportBackup();
    const entries = await unzip(blob);
    expect(entries["settings/keys.json"]).toBeDefined();
    const keys = JSON.parse(strFromU8(entries["settings/keys.json"]));
    expect(keys).toEqual({
      sgdbKey: "sg-secret",
      igdbClientId: "client-id",
      igdbClientSecret: "client-secret",
      tmdbKey: "tmdb-secret",
    });
    const manifest = JSON.parse(strFromU8(entries["manifest.json"]));
    expect(manifest.includesApiKeys).toBe(true);

    // Wipe the local keys, then restoring this backup brings them back.
    setSgdbKey("");
    setTmdbKey("");
    setIgdbCreds("", "");
    const r = await importBackup(new File([blob], "b.zip"));
    expect(r.includesApiKeys).toBe(true);
    expect(getSgdbKey()).toBe("sg-secret");
    expect(getTmdbKey()).toBe("tmdb-secret");
    expect(getIgdbCreds()).toEqual({ clientId: "client-id", clientSecret: "client-secret" });
  });

  it("importing a backup without keys reports that and leaves existing keys alone", async () => {
    await saveProject(newProject("p"));
    const { blob } = await exportBackup(); // opt-in still off
    setSgdbKey("still-here");
    const r = await importBackup(new File([blob], "b.zip"));
    expect(r.includesApiKeys).toBe(false);
    expect(getSgdbKey()).toBe("still-here");
  });

  it("the setting persists and can be turned back off", () => {
    setIncludeKeysInBackup(true);
    expect(getIncludeKeysInBackup()).toBe(true);
    setIncludeKeysInBackup(false);
    expect(getIncludeKeysInBackup()).toBe(false);
  });
});
