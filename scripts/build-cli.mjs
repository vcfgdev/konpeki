import { fileURLToPath } from "node:url";
import { build } from "vite";

// Node cannot strip TypeScript inside node_modules. Bundle our CLI modules;
// keep npm dependencies external and retain the package-relative UI root.
await build({
  root: fileURLToPath(new URL("../", import.meta.url)),
  configFile: false,
  build: {
    ssr: "bin/konpeki.mjs",
    outDir: "runtime",
    emptyOutDir: true,
    sourcemap: false,
    // Keep every module one level below the package root, like html/*.ts,
    // so package-relative theme and font URLs work after installation too.
    rolldownOptions: { output: { entryFileNames: "konpeki.mjs", chunkFileNames: "[name]-[hash].mjs" } },
  },
});
