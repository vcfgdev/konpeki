import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { browserDocument } from "../html/browser.ts";

const root = resolve(import.meta.dirname, ".."), cli = join(root, "bin/konpeki.mjs");
const prepare = join(root, "skills/konpeki/scripts/prepare-document.mjs");
const run = (...args) => JSON.parse(execFileSync(process.execPath, [prepare, cli, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));

test("named themes prepare portable starters, including serif fonts, without replacing existing work", async t => {
  const dir = await mkdtemp(join(tmpdir(), "konpeki-prepare-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const name of ["editorial", "dark", "dense-data"]) {
    const file = join(dir, name, "document.html");
    assert.equal(run(file, "--theme", name).created, true);
    assert.deepEqual(await readFile(join(dir, name, "theme.css")), await readFile(join(root, "themes", name, "theme.css")));
    assert.deepEqual(await readFile(join(root, "themes", name, "theme-base.css")), await readFile(join(root, "theme-base.css")), "theme folders must retain the shared base unchanged");
    assert.deepEqual((await browserDocument(file)).report.diagnostics, [], name);
    await writeFile(join(dir, name, "theme.css"), "/* authored theme */");
    assert.equal(run(file, "--theme", "default").created, false);
    assert.equal(await readFile(join(dir, name, "theme.css"), "utf8"), "/* authored theme */");
    const another = join(dir, name, "another.html");
    assert.throws(() => run(another, "--theme", "dark"), /Existing asset differs/);
    await assert.rejects(readFile(another), /ENOENT/);
  }
  assert.throws(() => run(join(dir, "unknown.html"), "--theme", "brand-conversion"), /Unknown theme/);
  await assert.rejects(readFile(join(dir, "unknown.html")), /ENOENT/);
});
