import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { FontManifest } from "../composition/fonts.ts";

test("font generation reproduces the manifest and rejects drift without accepting or writing it", async t => {
  const root = await mkdtemp(join(tmpdir(), "konpeki-font-generation-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "scripts"));
  await mkdir(join(root, "fonts"));
  for (const name of ["generate-fonts.py", "generate-fonts.py.lock"])
    await copyFile(new URL(name, import.meta.url), join(root, "scripts", name));
  await symlink(fileURLToPath(new URL("../node_modules", import.meta.url)), join(root, "node_modules"), "dir");
  const expected = await readFile(new URL("../fonts/manifest.json", import.meta.url), "utf8");
  const manifest = JSON.parse(expected) as FontManifest;
  const manifestPath = join(root, "fonts/manifest.json");
  await writeFile(manifestPath, expected);
  const run = (...args: string[]) => spawnSync("uv", ["run", "--locked", "scripts/generate-fonts.py", ...args], { cwd: root, encoding: "utf8" });

  const generated = run();
  assert.equal(generated.status, 0, generated.stderr);
  assert.equal(await readFile(manifestPath, "utf8"), expected, "normal generation cannot rewrite the manifest");
  for (const font of manifest.fonts) {
    const data = await readFile(join(root, "fonts", font.file));
    assert.equal(createHash("sha256").update(data).digest("hex"), font.sha256);
    assert.equal(data.length, font.bytes);
  }
  assert.equal((await readdir(join(root, "fonts"))).filter(name => name.startsWith("LICENSE-")).length, 6);

  // A stale expected hash must fail even when an old generated file is present.
  // Remove another asset to prove failure cannot leave a partially written set.
  manifest.fonts[0].sha256 = "0".repeat(64);
  const stale = JSON.stringify(manifest);
  await writeFile(manifestPath, stale);
  const missing = join(root, "fonts", manifest.fonts[1].file);
  await rm(missing);
  const rejected = run();
  assert.equal(rejected.status, 1, rejected.stderr);
  assert.match(rejected.stderr, /Generated fonts differ/);
  assert.equal(await readFile(manifestPath, "utf8"), stale);
  await assert.rejects(readFile(missing), { code: "ENOENT" });

  const updated = run("--update-manifest");
  assert.equal(updated.status, 0, updated.stderr);
  assert.equal(await readFile(manifestPath, "utf8"), expected);
  assert.equal((await readFile(missing)).length, manifest.fonts[1].bytes);
});
