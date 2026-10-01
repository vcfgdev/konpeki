import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, ".."), cli = join(root, "bin/konpeki.mjs");
const prepare = join(root, "skills/konpeki/scripts/prepare-document.mjs");
const run = (...args) => JSON.parse(execFileSync(process.execPath, [prepare, cli, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));

test("prepares a portable default starter without replacing existing work", async t => {
  const dir = await mkdtemp(join(tmpdir(), "konpeki-prepare-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "document.html");
  assert.equal(run(file).created, true);
  assert.deepEqual(await readFile(join(dir, "theme.css")), await readFile(join(root, "theme.css")));
  assert.deepEqual(await readFile(join(dir, "theme-base.css")), await readFile(join(root, "theme-base.css")));
  assert.deepEqual((await readdir(dir)).sort(), ["document.html", "theme-base.css", "theme.css"]);
  const runtime = JSON.parse(execFileSync(process.execPath, [join(root, "skills/konpeki/scripts/ensure-runtime.mjs")], { encoding: "utf8" }));
  assert.equal(resolve(runtime.root), root, "runtime discovery must not require a fonts directory");
  await writeFile(join(dir, "theme.css"), "/* authored theme */");
  assert.equal(run(file).created, false);
  assert.equal(await readFile(join(dir, "theme.css"), "utf8"), "/* authored theme */");
  const another = join(dir, "another.html");
  assert.throws(() => run(another), /Existing asset differs/);
  await assert.rejects(readFile(another), /ENOENT/);
  assert.throws(() => run(join(dir, "themed.html"), "--theme", "dark"), /Usage/);
  await assert.rejects(readFile(join(dir, "themed.html")), /ENOENT/);
});
