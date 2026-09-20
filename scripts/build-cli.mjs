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
    rolldownOptions: { output: { entryFileNames: "konpeki.mjs" } },
  },
});
