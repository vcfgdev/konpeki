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
  "composition/schema.json", "composition/README.md",
  "scripts/migrate-react-page.ts", "slides/README.md",
  "slides/drawing-references.md", "slides/github-cover/composition.json",
  "slides/introducing-konpeki/composition.json",
  "slides/architecture/index.tsx", "slides/architecture/PROMPT.md",
]) assert(paths.has(required), `Missing package resource: ${required}`);

for (const path of paths) {
  assert(!path.startsWith("slides/") || !/\.(png|jpe?g|webp|gif)$/i.test(path),
    `Gallery image in package: ${path}`);
  assert(!/(^|\/)(node_modules|dist|resources|fixtures|pilot|first-return|outputs|inputs)(\/|$)|\.test\.|(^|\/)\.env|pnpm-lock|tsconfig|intent-.*trial|impeccable|DEMO-REVIEW|RESULTS\.md|scripts\/check-|\/review\.mjs/.test(path),
    `Development or research file in package: ${path}`);
  if (!/\.(?:ts|tsx|mjs)$/.test(path)) continue;
  const source = readFileSync(new URL(path, new URL("../", import.meta.url)), "utf8");
  // Every static relative import must resolve inside the tarball, including
  // type imports and assets: compiling from the checkout can hide missing files.
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*)["'](\.[^"']+)["']/g)) {
    const target = posix.normalize(posix.join(dirname(path), match[1].split("?")[0]));
    const candidates = [target, `${target}.ts`, `${target}.tsx`, `${target}/index.ts`, `${target}/index.tsx`];
    assert(candidates.some((candidate) => paths.has(candidate)), `Missing import: ${path} -> ${target}`);
  }
}
console.log(`Package OK: ${pack.entryCount} files, ${(pack.size / 1e6).toFixed(2)} MB packed; resources and relative imports verified.`);
