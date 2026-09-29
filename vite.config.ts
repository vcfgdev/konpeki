import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  // HarfBuzz loads its sibling WASM via import.meta.url. Prebundling would
  // relocate the JS without that binary in an npm-installed preview.
  optimizeDeps: { exclude: ["harfbuzzjs"] },
  server: { host: "0.0.0.0", allowedHosts: [".onamp.dev"], headers: { "x-amp-review-widget": "off" } },
  preview: { host: "0.0.0.0", allowedHosts: [".onamp.dev"], headers: { "x-amp-review-widget": "off" } },
});
