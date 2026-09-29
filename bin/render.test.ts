import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { PDFDocument } from "pdf-lib";
import { addComponent, initialGridDraft } from "../composition/document.ts";
import { resolveDocument, toComposition } from "../composition/grid.ts";
import { resizePage } from "../src/lib/page-size.ts";
import { renderDocument } from "./render.ts";

test("shared renderer selects one-based pages, sizes mixed PDFs, and scales only PNG", async () => {
  const draft = resolveDocument(toComposition(initialGridDraft()));
  draft.pages.push({ ...resizePage(structuredClone(draft.pages[0]), { width: 1080, height: 1350 }, "social"), id: "portrait", preset: "portrait" });
  const document = toComposition(draft);
  const svg = await renderDocument(document, { format: "svg", page: 2, scale: 3 });
  assert.match(new TextDecoder().decode(svg.bytes), /width="1080" height="1350"/);
  const png = Buffer.from((await renderDocument(document, { format: "png", page: 2, scale: .5 })).bytes);
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [540, 675]);
  const pdf = await PDFDocument.load((await renderDocument(document, { format: "pdf", scale: 3 })).bytes);
  assert.deepEqual(pdf.getPages().map(page => page.getSize()), [{ width: 1440, height: 810 }, { width: 810, height: 1012.5 }]);
  const selected = await PDFDocument.load((await renderDocument(document, { format: "pdf", page: 2 })).bytes);
  assert.equal(selected.getPageCount(), 1);
  for (const page of [0, 3, 1.5]) await assert.rejects(renderDocument(document, { format: "png", page }), /Page must/);
  for (const scale of [0, -1, Infinity, 9]) await assert.rejects(renderDocument(document, { format: "png", scale }), /scale must/);
});

test("A4 keeps exact print dimensions while PNG rounds only at rasterization", async () => {
  const draft = resolveDocument(toComposition(addComponent(initialGridDraft(), "text-block")));
  draft.pages[0] = resizePage(draft.pages[0], { width: 210 / 25.4 * 96, height: 297 / 25.4 * 96 });
  draft.pages[0].preset = "a4";
  draft.pages[0].components[0].rect = { x: 56, y: 56, width: 682, height: 48 };
  const document = toComposition(draft);
  const pdf = await PDFDocument.load((await renderDocument(document, { format: "pdf", scale: 4 })).bytes);
  const { width, height } = pdf.getPage(0).getSize();
  assert.ok(Math.abs(width * 25.4 / 72 - 210) < 1e-9);
  assert.ok(Math.abs(height * 25.4 / 72 - 297) < 1e-9);
  const svg = new TextDecoder().decode((await renderDocument(document, { format: "svg" })).bytes);
  const size = /<svg[^>]+width="([\d.]+)" height="([\d.]+)"/.exec(svg)!;
  assert.ok(Math.abs(Number(size[1]) / 96 * 25.4 - 210) < 1e-9);
  assert.ok(Math.abs(Number(size[2]) / 96 * 25.4 - 297) < 1e-9);
  // PNG scales the integral 96 dpi canvas (794×1123), not the physical PDF.
  for (const [scale, expected] of [[1, [794, 1123]], [2, [1588, 2246]]] as const) {
    const png = Buffer.from((await renderDocument(document, { format: "png", scale })).bytes);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], expected);
  }
});

test("CLI render never overwrites outputs and check emits machine-readable errors", async t => {
  const directory = await mkdtemp(join(tmpdir(), "konpeki-render-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "document.json"), output = join(directory, "output.svg");
  await writeFile(path, JSON.stringify(toComposition(initialGridDraft())));
  const cli = (...args: string[]) => spawnSync(process.execPath, [new URL("./konpeki.mjs", import.meta.url).pathname, ...args], { encoding: "utf8" });
  assert.equal(cli("render", path, "--format", "svg", "--output", output).status, 0);
  const bytes = await readFile(output);
  assert.equal(cli("render", path, "--format", "svg", "--output", output).status, 1);
  assert.deepEqual(await readFile(output), bytes);
  const clean = cli("check", path);
  assert.equal(clean.status, 0);
  assert.deepEqual(JSON.parse(clean.stdout), { ok: true, diagnostics: [] });
  await writeFile(path, JSON.stringify({ schema: "konpeki-composition/v1" }));
  const invalid = cli("check", path);
  assert.equal(invalid.status, 1);
  assert.equal(JSON.parse(invalid.stdout).diagnostics[0].code, "invalid-document");
});

test("removed refine-grid command does not write output", async t => {
  const directory = await mkdtemp(join(tmpdir(), "konpeki-no-refine-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "document.json"), output = join(directory, "document.refined.json");
  const document = toComposition(addComponent(initialGridDraft(), "text-block"));
  const page = document.pages[0];
  page.grid = { preset: "presentation" };
  page.components[0].area = { column: 3, span: 5, row: 7, rows: 15 };
  page.groups = [{ id: "stack", childIds: [page.components[0].id], area: { column: "center", span: 8, row: 1, rows: 78 }, verticalAlignment: "center" }];
  const source = JSON.stringify(document);
  await writeFile(path, source);
  const cli = (...args: string[]) => spawnSync(process.execPath, [new URL("./konpeki.mjs", import.meta.url).pathname, ...args], { encoding: "utf8" });
  const result = cli("refine-grid", path);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:/);
  await assert.rejects(readFile(output), { code: "ENOENT" });
  assert.equal(await readFile(path, "utf8"), source);
});
