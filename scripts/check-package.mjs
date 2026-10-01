import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { isGoogleFontResource } from "../html/document.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
execFileSync(process.execPath, ["scripts/build-cli.mjs"], { cwd: root, stdio: "inherit" });
const [pack] = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { cwd: root, encoding: "utf8" }));
const paths = new Set(pack.files.map(({ path }) => path));
for (const required of [
  "LICENSE", "README.md", "AGENTS.md", "AUTHORING.md", "SETUP.md", "theme.css",
  "theme-base.css", "html/theme.md", "html/theme-authoring.md", "html/starter.ts",
  "docs/workflow.md", "docs/development.md", "plugin.json", "skills/konpeki/SKILL.md", "skills/konpeki/floor.md", "html/floor.ts",
  ...["slides", "resume", "long-document", "one-pager", "cover", "patterns"].map(name => `skills/konpeki/references/${name}.md`),
  "skills/konpeki/scripts/ensure-runtime.mjs", "skills/konpeki/scripts/prepare-document.mjs",
  "skills/konpeki/assets/blank.html", "html/README.md", "html/index.html", "html/preview.tsx",
  "html/preview.css", "html/inspect.ts", "runtime/konpeki.mjs", "index.html", "vite.config.ts",
  "src/components/PageBoard.tsx", "src/lib/page-board.ts", "src/lib/alignment.ts",
  "src/lib/review-position.ts", "src/styles/base.css", "src/styles/shell.css",
  "src/styles/feedback.css", "src/assets/konpeki-mark.png", "public/og.png",
]) assert(paths.has(required), `Missing package resource: ${required}`);
assert(![...paths].some(path => path.startsWith("themes/")), "Only the default theme is packaged");
for (const css of [...paths].filter(path => path.endsWith(".css")))
  for (const [, asset] of readFileSync(new URL(`../${css}`, import.meta.url), "utf8").matchAll(/url\("([^"]+)"\)/g))
    assert(isGoogleFontResource(new URL(asset, "https://local.invalid/").href, "stylesheet")
      || paths.has(posix.join(dirname(css), asset)), `Missing or disallowed theme asset: ${css} -> ${asset}`);
for (const path of paths) {
  assert(!/^(fonts|examples|evaluation|composition|design|lib|scripts|resources)\/|^legacy\.html$|\.test\.|(^|\/)\.env|pnpm-lock|tsconfig/.test(path), `Development or legacy file in package: ${path}`);
  if (!/\.(?:ts|tsx|mjs|js)$/.test(path)) continue;
  const source = readFileSync(new URL(path, new URL("../", import.meta.url)), "utf8");
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.[^"']+)["']/g)) {
    const target = posix.normalize(posix.join(dirname(path), match[1].split("?")[0]));
    const candidates = [target, `${target}.ts`, `${target}.tsx`, `${target}/index.ts`, `${target}/index.tsx`];
    assert(candidates.some(candidate => paths.has(candidate)), `Missing import: ${path} -> ${target}`);
  }
}
console.log(`Package OK: ${pack.entryCount} files, ${(pack.size / 1e6).toFixed(2)} MB packed; HTML resources and relative imports verified.`);
