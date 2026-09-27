import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { PDFDocument } from "pdf-lib";
import { initialGridDraft } from "../composition/document.ts";
import { toComposition } from "../composition/grid.ts";
import { renderDocument } from "./render.ts";

test("shared renderer selects one-based pages, sizes mixed PDFs, and scales only PNG", async () => {
  const document = toComposition(initialGridDraft());
  document.slides.push({ ...structuredClone(document.slides[0]), id: "portrait", grid: { preset: "portrait" } });
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
