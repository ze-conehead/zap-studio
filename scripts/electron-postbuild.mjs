// Root package.json says "type": "module", which would make Node treat the
// compiled electron/*.js as ESM (tsconfig.electron.json emits CommonJS). A
// nested package.json wins locally — this stamps one into dist-electron/ so
// Electron's main process loads the output as the CommonJS it actually is.
// A plain Node script (not a shell one-liner) so it runs the same on every
// platform electron-builder targets.
import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("dist-electron", { recursive: true });
writeFileSync("dist-electron/package.json", JSON.stringify({ type: "commonjs" }, null, 2) + "\n");
