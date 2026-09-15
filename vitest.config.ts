import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for the pure modules (masks, backgrounds, placeholders,
// metadata mapping, local logos, bleed …). jsdom gives them localStorage /
// DOMParser / canvas-less document; fake-indexeddb stands in for the
// browser's IndexedDB. Konva rendering and dialogs are not covered here.
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify("0.0.0-test") },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
    restoreMocks: true,
  },
});
