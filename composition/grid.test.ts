import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { schemaV2 } from "./schema-v2.ts";
import { assertComposition, validateComposition } from "./validate.ts";
import { canonicalJSON, compileHandoff } from "./compile.ts";
import { addComponent, addSlide, duplicateComponent, initialDraft, parseCompositionJSON, parseStoredDraft, serializeDraft, transformComponentRect, validateDraft } from "./document.ts";
import { gridSchema, lineLengthWarnings, resolveDocument, toComposition, type GridDocument } from "./grid.ts";
import { resizePage } from "../src/lib/page-size.ts";
import { readCompositionFile, saveCompositionFile } from "../bin/session-store.ts";

function pixelFixture(): GridDocument {
  const document = toComposition(addComponent(initialDraft(true), "text-block")) as GridDocument;
  const component = document.pages[0].components[0];
  component.rect = { x: 137.25, y: 83.75, width: 511.5, height: 147.25 };
  return document;
}

function legacyFixture(): GridDocument {
  const document = pixelFixture();
  const page = document.pages[0];
  delete page.canvas; delete page.preset; delete page.innerPadding;
  page.grid = { preset: "presentation" };
  const component = page.components[0];
  delete component.rect;
  component.area = { column: 3, span: 4, row: 9, rows: 11 };
  component.padding = 2;
  if (component.kind === "text-block") component.textStyle = { step: "heading", leading: 4 };
  return document;
}

test("v2 schema accepts pixel authoring and rejects derived or malformed geometry", () => {
  assert.equal(canonicalJSON(schemaV2) + "\n", readFileSync(new URL("./schema-v2.json", import.meta.url), "utf8"));
  const structural = new Ajv2020({ strict: false }).compile(schemaV2);
  assert.equal(structural(pixelFixture()), true);
  for (const mutate of [
    (d: any) => d.pages[0].components[0].preferredRect = { x: 1, y: 1, width: 10, height: 10 },
    (d: any) => d.pages[0].components[0].rect.x = -0.1,
    (d: any) => d.pages[0].components[0].rect.width = 0,
    (d: any) => d.pages[0].components[0].textStyle.size = 0,
    (d: any) => d.pages[0].canvas.width = 255.9,
    (d: any) => d.schema = "konpeki-composition/v3",
  ]) {
    const document = pixelFixture(); mutate(document);
    assert.equal(validateComposition(document).ok, false);
  }
});

test("true legacy grid input normalizes exactly to pixels", () => {
  const legacy = legacyFixture(), normalized = assertComposition(legacy), page = normalized.pages[0];
  assert.equal(page.grid, undefined);
  assert.deepEqual(page.canvas, { width: 1920, height: 1080 });
  assert.deepEqual(page.innerPadding, { top: 72, right: 72, bottom: 72, left: 72 });
  assert.deepEqual(page.components[0].rect, { x: 372, y: 168, width: 576, height: 132 });
  assert.equal(page.components[0].padding, 24);
  assert.ok(page.components[0].kind === "text-block");
  assert.equal(page.components[0].textStyle?.leading, 48);
  const resolved = resolveDocument(legacy);
  assert.deepEqual(toComposition(resolved), normalized);
  assert.deepEqual(parseStoredDraft(serializeDraft(resolved)), { ok: true, draft: resolved });
});

test("revision-2 legacy centered groups retain centered margins and fractional geometry", () => {
  const legacy = legacyFixture(), page = legacy.pages[0], component = page.components[0];
  page.grid = { preset: "link", revision: 2 };
  component.area = { column: "center", span: 3, row: "center", rows: 4 };
  component.padding = 1;
  assert.ok(component.kind === "text-block");
  component.textStyle = { step: "caption", leading: 3 };
  page.groups = [{ id: "centered", childIds: [component.id], verticalAlignment: "center", area: { column: 2, span: 5, row: 10, rows: 30 } }];
  const normalized = assertComposition(legacy), imported = normalized.pages[0];
  assert.deepEqual(imported.innerPadding, { top: 51, right: 48, bottom: 51, left: 48 });
  assert.deepEqual(imported.components[0].rect, { x: 400.5, y: 299, width: 399, height: 32 });
  assert.equal(imported.components[0].padding, 8);
  assert.deepEqual(imported.groups[0], { id: "centered", childIds: [component.id], verticalAlignment: "center", rect: { x: 189, y: 123, width: 681, height: 240 } });
  assert.deepEqual(toComposition(resolveDocument(legacy)), normalized);
  page.grid = { preset: "a4", revision: 2 };
  component.textStyle = { step: "caption", leading: 4 };
  const print = assertComposition(legacy).pages[0];
  assert.ok(Math.abs(print.canvas!.width - 793.7007874015749) < 1e-9);
  assert.ok(Math.abs(print.innerPadding!.top - 57.259842519685094) < 1e-9);
  assert.ok(Math.abs(print.components[0].rect!.y - 553.2598425196851) < 1e-9);
});

test("component corrections use exact 1px deltas and retain fractional authored origins", () => {
  const draft = resolveDocument(pixelFixture()), component = draft.pages[0].components[0];
  const before = component.preferredRect;
  assert.equal(transformComponentRect(component, before, { ...before, x: before.x + .49, y: before.y - .49 }), component);
  const moved = transformComponentRect(component, before, { x: before.x + 1.51, y: before.y - 2.51, width: before.width + 3.51, height: before.height - 4.51 });
  assert.deepEqual(moved.rect, { x: 139.25, y: 80.75, width: 515.5, height: 142.25 });
  const bounded = transformComponentRect(component, before, { ...before, x: 1900, y: 1070 }, { width: 1920, height: 1080 });
  assert.deepEqual(bounded.rect, { ...component.rect, x: 1408.5, y: 932.75 });
});

test("native single-region text may omit measured height and saves authored pixels only", () => {
  const document = pixelFixture(), component = document.pages[0].components[0];
  assert.ok(component.kind === "text-block");
  component.rect = { x: 91.5, y: 107.25, width: 603.75 };
  component.padding = 11.5;
  component.textStyle = { size: 37.5, leading: 46.25 };
  assert.ok(validateComposition(document).ok);
  const resolved = resolveDocument(document);
  assert.equal(resolved.pages[0].components[0].preferredRect.height, 0);
  const saved = toComposition(resolved);
  assert.deepEqual(saved, document);
  assert.equal("preferredRect" in saved.pages[0].components[0], false);
});

test("custom fractional canvases preserve geometry, type, preset and support history operations", () => {
  const draft = resolveDocument(pixelFixture()), page = draft.pages[0];
  const before = structuredClone(page.components[0]);
  page.preset = "article";
  const resized = resizePage(page, { width: 1537.5, height: 777.25 }, "custom");
  assert.deepEqual(resized.canvas, { width: 1537.5, height: 777.25 });
  assert.equal(resized.preset, "article");
  assert.deepEqual(resized.components[0], before);
  assert.deepEqual(addSlide({ ...draft, pages: [resized] }).draft.pages[1].canvas, resized.canvas);
  const duplicate = duplicateComponent({ ...draft, pages: [resized] }, before.id);
  assert.ok(validateDraft(duplicate).ok);
});

test("pixel movement survives parsing, agent edits and file sessions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "konpeki-pixels-"));
  try {
    const path = join(directory, "composition.json"), document = pixelFixture();
    await writeFile(path, canonicalJSON(document));
    const opened = await readCompositionFile(path);
    const draft = resolveDocument(opened.document), component = draft.pages[0].components[0];
    const moved = transformComponentRect(component, component.preferredRect, { ...component.preferredRect, x: 523.6, y: 217.2 });
    draft.pages[0].components[0] = moved;
    const wire = toComposition(draft);
    assert.deepEqual(wire.pages[0].components[0].rect, { x: 523.25, y: 216.75, width: 511.5, height: 147.25 });
    assert.equal("preferredRect" in wire.pages[0].components[0], false);
    const parsed = parseCompositionJSON(canonicalJSON(wire)); assert.ok(parsed.ok);
    if (!parsed.ok) return;
    await saveCompositionFile(path, opened.revision, toComposition(parsed.document));
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")).pages[0].components[0].rect, wire.pages[0].components[0].rect);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("line-length estimate uses pixel width and padding", () => {
  const document = pixelFixture(), component = document.pages[0].components[0];
  assert.ok(component.kind === "text-block");
  component.rect = { x: 30, y: 40, width: 760, height: 100 };
  component.textStyle = { size: 20 };
  component.content = "a".repeat(76);
  assert.deepEqual(lineLengthWarnings(document), [{ slideId: "slide-1", componentId: component.id, characters: 76 }]);
  component.content = "a".repeat(75); assert.deepEqual(lineLengthWarnings(document), []);
  component.content = "a".repeat(100); component.padding = 260;
  assert.deepEqual(lineLengthWarnings(document), []);
});

test("handoff and shipped pages round-trip without derived rectangles", () => {
  const handoff = compileHandoff(pixelFixture());
  assert.match(handoff, /137\.25/); assert.doesNotMatch(handoff, /preferredRect/);
  for (const path of ["gallery/architecture.json", "gallery/sankey.json", "gallery/release.json", "gallery/explainer.json", "introducing-konpeki/composition.json"]) {
    const document = assertComposition(JSON.parse(readFileSync(new URL(`./fixtures/${path}`, import.meta.url), "utf8")));
    assert.equal(document.schema, gridSchema);
    assert.deepEqual(toComposition(resolveDocument(document)), document);
  }
});
