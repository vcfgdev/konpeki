import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// A copied skill must resolve a known runtime, not follow repo-relative links.
const version = "0.3.1";
const probeDocument = fileURLToPath(new URL("../assets/blank.json", import.meta.url));
function runtime(root) {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    if (pkg.name !== "konpeki" || pkg.version !== version) return;
    const cli = join(root, pkg.bin.konpeki);
    const sourceCLI = join(root, "bin/konpeki.mjs");
    if (!["AGENTS.md", "AUTHORING.md", "composition/README.md", "design/README.md", "docs/workflow.md"]
      .every(path => existsSync(join(root, path)))) return;
    // The development checkout runs TypeScript directly on the pinned Node.
    for (const candidate of new Set([cli, sourceCLI])) {
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
  if (process.argv.slice(2).some(arg => arg !== "--install"))
    throw new Error("Usage: node ensure-runtime.mjs [--install]");
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
  let found = (workspace && runtime(workspace)) || runtime(bundled) || runtime(cachedRoot);
  if (!found) {
    if (!process.argv.includes("--install"))
      throw new Error(`Konpeki ${version} is not installed. After the host approves installation, rerun with --install. This uses a user cache and leaves project dependencies unchanged.`);
    mkdirSync(cache, { recursive: true });
    // Explicit local prefix prevents npm from walking up into an ancestor project.
    // Resolve "." from the absolute cwd; no user path enters Windows shell text.
    const result = spawnSync("npm", ["install", "--prefix=.", "--global=false", "--save-exact", "--no-audit", "--no-fund", `konpeki@${version}`], {
      cwd: cache,
      stdio: ["inherit", 2, 2],
      shell: process.platform === "win32",
    });
    if (result.error || result.status !== 0)
      throw new Error("Konpeki installation failed. Check npm/network access and retry; the runtime is not ready.");
    found = runtime(cachedRoot);
    if (!found) throw new Error("The installed Konpeki runtime is incomplete or incompatible.");
  }
  console.log(JSON.stringify(found));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
