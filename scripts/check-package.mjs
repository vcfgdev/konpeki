import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, posix } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
execFileSync(process.execPath, ["scripts/build-cli.mjs"], { cwd: root, stdio: "inherit" });
const [pack] = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
  cwd: root,
  encoding: "utf8",
}));
const paths = new Set(pack.files.map(({ path }) => path));
for (const required of [
  "LICENSE", "README.md", "AGENTS.md", "AUTHORING.md", "SETUP.md",
  "docs/workflow.md", "docs/development.md",
  "plugin.json", "skills/konpeki/SKILL.md",
  "skills/konpeki/scripts/ensure-runtime.mjs",
  "skills/konpeki/scripts/prepare-document.mjs", "skills/konpeki/assets/blank.json",
  "runtime/konpeki.mjs",
  "index.html", "vite.config.ts", "src/main.tsx", "src/assets/konpeki-mark.png",
  "public/og.png",
  "composition/README.md", "composition/scene.ts", "composition/fonts.ts",
  "composition/lower.ts", "composition/text-layout.ts", "composition/svg.ts",
  "composition/pdf.ts", "composition/check.ts", "composition/check-node.ts",
  "composition/draft-artwork.ts", "composition/draft-icons.json",
  "composition/schema-v2.json", "composition/schema-v2.ts",
  "composition/grid.ts", "composition/runtime.ts",
  "lib/linebreak.d.ts", "fonts/manifest.json",
  "fonts/noto-sans-symbols-2-400-normal.ttf",
  "fonts/LICENSE-hanken-grotesk.txt", "fonts/LICENSE-ibm-plex-sans.txt",
  "fonts/LICENSE-ibm-plex-serif.txt", "fonts/LICENSE-noto-sans.txt",
  "fonts/LICENSE-noto-sans-symbols-2.txt",
  "scripts/migrate-react-page.ts", "slides/README.md",
  "slides/drawing-references.md", "slides/github-cover/composition.json",
  "slides/introducing-konpeki/composition.json",
  "slides/architecture/index.tsx", "slides/architecture/PROMPT.md",
]) assert(paths.has(required), `Missing package resource: ${required}`);

const manifest = JSON.parse(readFileSync(new URL("../fonts/manifest.json", import.meta.url), "utf8"));
for (const font of manifest.fonts) assert(paths.has(`fonts/${font.file}`), `Missing font: ${font.file}`);
assert(paths.has("fonts/LICENSE-noto-sans-symbols.txt"));
for (const obsolete of [
  "composition/schema.json",
  "src/lib/examples/react-page-migration.json",
  "src/lib/export-png.ts",
]) assert(!paths.has(obsolete), `Obsolete package resource: ${obsolete}`);

for (const path of paths) {
  assert(!path.startsWith("slides/") || !/\.(png|jpe?g|webp|gif)$/i.test(path),
    `Gallery image in package: ${path}`);
  assert(!/(^|\/)(node_modules|dist|resources|fixtures|pilot|first-return|outputs|inputs)(\/|$)|\.test\.|(^|\/)\.env|pnpm-lock|tsconfig|intent-.*trial|impeccable|DEMO-REVIEW|RESULTS\.md|scripts\/check-|\/review\.mjs/.test(path),
    `Development or research file in package: ${path}`);
  if (!/\.(?:ts|tsx|mjs|js)$/.test(path)) continue;
  const source = readFileSync(new URL(path, new URL("../", import.meta.url)), "utf8");
  // Every static relative import must resolve inside the tarball, including
  // type imports and assets: compiling from the checkout can hide missing files.
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.[^"']+)["']/g)) {
    const target = posix.normalize(posix.join(dirname(path), match[1].split("?")[0]));
    const candidates = [target, `${target}.ts`, `${target}.tsx`, `${target}/index.ts`, `${target}/index.tsx`];
    assert(candidates.some((candidate) => paths.has(candidate)), `Missing import: ${path} -> ${target}`);
  }
}
console.log(`Package OK: ${pack.entryCount} files, ${(pack.size / 1e6).toFixed(2)} MB packed; resources and relative imports verified.`);
