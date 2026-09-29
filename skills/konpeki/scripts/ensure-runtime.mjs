import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// A copied skill must resolve a known runtime, not follow repo-relative links.
const version = "0.4.0";
const html = process.argv.includes("--html");
const probeDocument = fileURLToPath(new URL(html ? "../assets/blank.html" : "../assets/blank.json", import.meta.url));
function runtime(root) {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    if (pkg.name !== "konpeki" || pkg.version !== version) return;
    const cli = join(root, pkg.bin.konpeki);
    const sourceCLI = join(root, "bin/konpeki.mjs");
    if (!["AGENTS.md", "AUTHORING.md", html ? "html/README.md" : "composition/README.md", "design/README.md", "docs/workflow.md"]
      .every(path => existsSync(join(root, path)))) return;
    // The development checkout runs TypeScript directly on the pinned Node.
    for (const candidate of new Set(html ? [sourceCLI, cli] : [cli, sourceCLI])) {
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
  if (process.argv.slice(2).some(arg => !["--install", "--html"].includes(arg)))
    throw new Error("Usage: node ensure-runtime.mjs [--html] [--install]");
  let workspace;
  try {
    workspace = dirname(createRequire(join(process.cwd(), "package.json")).resolve("konpeki/package.json"));
  } catch {}
  const bundled = fileURLToPath(new URL("../../../", import.meta.url));
  const cacheBase = process.platform === "win32"
    ? process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local")
    : process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
  const cache = resolve(cacheBase, "konpeki", version);
  const cachedRoot = join(cache, "node_modules", "konpeki");
  const found = (workspace && runtime(workspace)) || runtime(bundled) || runtime(cachedRoot);
  if (!found)
    throw new Error("Konpeki has not been published to npm. Use a prepared source checkout and its bin/konpeki.mjs; this helper will not download a runtime.");
  console.log(JSON.stringify(found));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
