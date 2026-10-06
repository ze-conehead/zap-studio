import { describe, expect, it } from "vitest";
import { findDuplicates, imageHash } from "./duplicates";
import { makeImageLayer } from "./factory";

const img = (src: string, over = {}) => ({
  ...makeImageLayer({ src, naturalWidth: 10, naturalHeight: 10, name: src }),
  ...over,
});

describe("findDuplicates", () => {
  it("reports a picture used on two cards, not one used twice on a card", () => {
    const groups = findDuplicates([
      { key: "a", title: "A", layers: [img("data:x"), img("data:x")] },
      { key: "b", title: "B", layers: [img("data:x"), img("data:y")] },
      { key: "c", title: "C", layers: [img("data:z")] },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((u) => u.key)).toEqual(["a", "b"]);
  });

  it("ignores logos and spine backgrounds, which repeat on purpose", () => {
    const groups = findDuplicates([
      { key: "a", title: "A", layers: [img("data:l", { logo: true })] },
      { key: "b", title: "B", layers: [img("data:l", { logo: true }), img("data:s", { spineBg: true })] },
      { key: "c", title: "C", layers: [img("data:s", { spineBg: true })] },
    ]);
    expect(groups).toHaveLength(0);
  });

  it("hashes are stable and tell different strings apart", () => {
    expect(imageHash("data:abc")).toBe(imageHash("data:abc"));
    expect(imageHash("data:abc")).not.toBe(imageHash("data:abd"));
  });
});
