import { describe, expect, it, vi } from "vitest";
import type { LocalLogo } from "./localLogos";
import { dataUrlPayload, matchByContent } from "./logoUsage";

const entry = (id: string, size: number): LocalLogo => ({ id, name: id, path: "", type: "image/png", size, addedAt: 0 });
const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));
const dataUrl = (bytes: number[], mime = "image/png") => `data:${mime};base64,${b64(bytes)}`;

describe("logo usage", () => {
  it("reads the decoded size off a base64 data URL, padding included", () => {
    expect(dataUrlPayload(dataUrl([1, 2, 3]))?.bytes).toBe(3);
    expect(dataUrlPayload(dataUrl([1, 2, 3, 4]))?.bytes).toBe(4); // one "=="
    expect(dataUrlPayload(dataUrl([1, 2, 3, 4, 5]))?.bytes).toBe(5); // one "="
    expect(dataUrlPayload("data:image/svg+xml,<svg/>")).toBeNull();
  });

  it("finds a layer's copy by content and only reads same-sized files", async () => {
    const a = [1, 2, 3, 4, 5];
    const b = [9, 9, 9, 9, 9]; // same size as a, other content
    const c = [7, 7, 7];
    const files: Record<string, string> = { a: dataUrl(a), b: dataUrl(b), c: dataUrl(c, "image/webp") };
    const read = vi.fn(async (id: string) => files[id]);
    const layerSrc = dataUrl(a, "image/png");
    const hits = await matchByContent([entry("b", 5), entry("a", 5), entry("c", 3), entry("big", 999)], [layerSrc], read);
    expect(hits.get(layerSrc)).toBe("a");
    expect(read.mock.calls.map((c) => c[0]).sort()).toEqual(["a", "b"]); // never c or big
  });

  it("matches regardless of the MIME type the copy was stored under", async () => {
    const bytes = [5, 6, 7];
    const hits = await matchByContent([entry("x", 3)], [dataUrl(bytes, "image/jpeg")], async () => dataUrl(bytes, "image/png"));
    expect(hits.size).toBe(1);
  });
});
