import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addComponent, initialGridDraft } from "../composition/document.ts";
import { toComposition } from "../composition/grid.ts";

test("CLI inspect emits deterministic, revision-bound reports with selected-page diagnostics", async t => {
  const directory = await mkdtemp(join(tmpdir(), "konpeki-inspect-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "document.json");
  const cli = (...args: string[]) => spawnSync(process.execPath, [new URL("./konpeki.mjs", import.meta.url).pathname, ...args], { encoding: "utf8" });
  const document = toComposition(addComponent(initialGridDraft(), "text-block"));
  const first = document.pages[0], component = first.components[0];
  assert.ok(component.kind === "text-block");
  component.rect = { x: 147, y: 96, width: 276, height: 96 }; component.content = "Fits.";
  first.pageNumber = { style: "01", color: "ink" };
  const second = structuredClone(first); second.id = "overfull"; second.preset = "portrait"; second.canvas = { width: 1080, height: 1350 };
  const overfull = second.components[0]; assert.ok(overfull.kind === "text-block");
  overfull.rect!.height = 12; overfull.content = "H\nH\n漢";
  document.pages.push(second);
  const source = JSON.stringify(document);
  await writeFile(path, source);

  const all = cli("inspect", path), report = JSON.parse(all.stdout);
  assert.equal(all.status, 1); assert.equal(all.stderr, "");
  assert.equal(report.schema, "konpeki-inspection/v1");
  assert.equal(report.detail, "summary");
  assert.equal(report.pages[0].items, undefined);
  assert.deepEqual(report.pages[1].components[0].textLines, [["H", "H", "漢"]]);
  assert.equal(report.units, "page-pixels");
  assert.equal(report.revision, createHash("sha256").update(source).digest("hex"));
  assert.equal(report.ok, false);
  assert.deepEqual(report.pages.map((page: { pageNumber: number; pageId: string; width: number; height: number }) =>
    [page.pageNumber, page.pageId, page.width, page.height]), [[1, first.id, 1920, 1080], [2, "overfull", 1080, 1350]]);
  assert.equal(cli("inspect", path).stdout, all.stdout);
  assert.deepEqual(report.diagnostics, JSON.parse(cli("check", path).stdout).diagnostics);
  for (const code of ["native-overflow", "missing-glyph"])
    assert.ok(report.diagnostics.some((item: { code: string; pageId: string; componentId: string }) =>
      item.code === code && item.pageId === "overfull" && item.componentId === component.id));
  const clean = cli("inspect", path, "--page", "1"), selected = JSON.parse(clean.stdout);
  assert.equal(clean.status, 0, clean.stderr);
  assert.equal(selected.ok, true); assert.deepEqual(selected.diagnostics, []);
  assert.deepEqual(selected.pages, [report.pages[0]]);
  const details = cli("inspect", path, "--details"), detailed = JSON.parse(details.stdout);
  assert.equal(details.status, all.status);
  assert.equal(detailed.detail, "full");
  assert.equal(detailed.revision, report.revision);
  assert.deepEqual(detailed.diagnostics, report.diagnostics, "summary must not hide errors or their evidence");
  const pageNumber = detailed.pages[0].items.find((item: { componentId?: string; kind: string }) => !item.componentId && item.kind === "text");
  assert.equal(pageNumber.source, "01"); assert.equal(pageNumber.pageId, first.id);
  const selectedDetails = cli("inspect", path, "--details", "--page", "2");
  assert.equal(selectedDetails.status, 1);
  assert.deepEqual(JSON.parse(selectedDetails.stdout).pages, [detailed.pages[1]]);
  assert.equal(await readFile(path, "utf8"), source, "inspection must never write the composition");

  for (const args of [["--page", "0"], ["--page", "3"], ["--page", "1.5"], ["--page", "oops"], ["--page"]]) {
    const result = cli("inspect", path, ...args), invalid = JSON.parse(result.stdout);
    assert.equal(result.status, 1); assert.equal(result.stderr, "");
    assert.equal(invalid.ok, false); assert.deepEqual(invalid.pages, []);
    assert.equal(invalid.diagnostics[0].code, "inspection-failed");
    assert.match(invalid.diagnostics[0].message, /Page must/);
  }

  const draft = toComposition(addComponent(initialGridDraft(), "image"));
  await writeFile(path, JSON.stringify(draft));
  const warning = cli("inspect", path), warned = JSON.parse(warning.stdout);
  assert.equal(warning.status, 0, warning.stdout);
  assert.ok(warned.pages[0].components[0].draft);
  assert.ok(warned.diagnostics.some((item: { code: string; severity: string }) => item.code === "draft-placeholder" && item.severity === "warning"));
  for (const input of ['{"schema":"konpeki-composition/v1"}', "not JSON"]) {
    await writeFile(path, input);
    const result = cli("inspect", path), invalid = JSON.parse(result.stdout);
    assert.equal(result.status, 1); assert.equal(invalid.ok, false);
    assert.equal(invalid.diagnostics[0].code, "inspection-failed");
  }
  const missing = cli("inspect", join(directory, "missing.json"));
  assert.equal(missing.status, 1); assert.equal(JSON.parse(missing.stdout).ok, false);
});
