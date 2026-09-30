import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// A copied skill must resolve a known runtime, not follow repo-relative links.
const version = "0.4.0";
const probeDocument = fileURLToPath(new URL("../assets/blank.html", import.meta.url));
function runtime(root) {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    if (pkg.name !== "konpeki" || pkg.version !== version) return;
    const cli = join(root, pkg.bin.konpeki);
    const sourceCLI = join(root, "bin/konpeki.mjs");
    if (!["AUTHORING.md", "html/README.md", "theme.css", "fonts/OFL.txt"]
      .every(path => existsSync(join(root, path)))) return;
    // The development checkout runs TypeScript directly on the pinned Node.
    for (const candidate of [sourceCLI, cli]) {
      if (!existsSync(candidate)) continue;
      const probe = spawnSync(process.execPath, [candidate, "validate", probeDocument], {
        stdio: "ignore",
        timeout: 10_000,
      });
      if (probe.status === 0) return { root, cli: candidate, version };
    }
  } catch {
    // Missing or incompatible installations are not modified.
  }
}

try {
  if (Number(process.versions.node.split(".")[0]) < 24)
    throw new Error("Konpeki needs Node.js 24+. Use your host's approved toolchain setup, then retry.");
  if (process.argv.length > 2) throw new Error("Usage: node ensure-runtime.mjs");
  let workspace;
  try {
    workspace = dirname(createRequire(join(process.cwd(), "package.json")).resolve("konpeki/package.json"));
  } catch {}
  const bundled = fileURLToPath(new URL("../../../", import.meta.url));
  const found = (workspace && runtime(workspace)) || runtime(bundled);
  if (!found)
    throw new Error("Install a locally packed Konpeki 0.4.0 tarball or use a prepared checkout. See SETUP.md. The konpeki package on npm is an earlier, incompatible release.");
  console.log(JSON.stringify(found));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
