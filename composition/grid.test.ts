import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { schema } from "./schema.ts";
import { schemaV2 } from "./schema-v2.ts";
import { assertComposition, validateComposition } from "./validate.ts";
import { canonicalJSON, compileHandoff } from "./compile.ts";
import { addComponent, addSlide, duplicateComponent, initialDraft, initialGridDraft, parseCompositionJSON, parseStoredDraft, serializeDraft, transformComponentRect, validateDraft } from "./document.ts";
import { areaRect, gridSchema, lineLengthWarnings, resolveDocument, snapArea, toComposition, type GridDocument } from "./grid.ts";
import { pageSizeIssue, resizePage } from "../src/lib/page-size.ts";
import { readCompositionFile, saveCompositionFile } from "../bin/session-store.ts";

function fixture(): GridDocument {
  const document = toComposition(addComponent(initialGridDraft(), "text-block")) as GridDocument;
  document.slides[0].components[0].area = { column: 3, span: 4, row: 9, rows: 11 };
  return document;
}

test("v1 stays immutable; v2 has its own public generated schema and rejects pixels", () => {
  assert.equal(canonicalJSON(schema) + "\n", readFileSync(new URL("./schema.json", import.meta.url), "utf8"));
  assert.equal(canonicalJSON(schemaV2) + "\n", readFileSync(new URL("./schema-v2.json", import.meta.url), "utf8"));
  const old = initialDraft();
  assert.equal(assertComposition(old), old);
  assert.equal(resolveDocument(assertComposition(old)), old);
  const structural = new Ajv2020({ strict: false }).compile(schemaV2);
  assert.equal(structural(fixture()), true);
  for (const mutate of [
    (d: any) => d.slides[0].canvas = { width: 1920, height: 1080 },
    (d: any) => d.slides[0].components[0].preferredRect = { x: 1, y: 1, width: 10, height: 10 },
    (d: any) => d.slides[0].components[0].textStyle.size = 37,
    (d: any) => d.slides[0].components[0].textStyle.lineHeight = 1.4,
    (d: any) => d.slides[0].components[0].area.column = 1.5,
    (d: any) => d.slides[0].components[0].area.row = 0,
    (d: any) => d.slides[0].grid.preset = "unknown",
    (d: any) => d.schema = "konpeki-composition/v3",
  ]) {
    const document = fixture(); mutate(document);
    assert.equal(validateComposition(document).ok, false);
  }
});

test("areas use gutters only between columns; snapping clamps all page edges", () => {
  // 1776 inner width, 11×24 gutters => 126 per column, 150 per pitch.
  assert.deepEqual(areaRect({ preset: "presentation" }, { column: 3, span: 4, row: 9, rows: 11 }),
    { x: 372, y: 168, width: 576, height: 132 });
  assert.deepEqual(snapArea({ preset: "presentation" }, { x: 453, y: 174, width: 645, height: 143 }),
    { column: 4, span: 4, row: 10, rows: 12 });
  assert.deepEqual(snapArea({ preset: "presentation" }, { x: -200, y: 2000, width: 10000, height: 24 }),
    { column: 1, span: 12, row: 77, rows: 2 });
  const document = fixture();
  document.slides[0].components[0].area = { column: 12, span: 1, row: 78, rows: 1 };
  assert.equal(validateComposition(document).ok, true);
  document.slides[0].components[0].area.rows = 2;
  assert.equal(validateComposition(document).ok, false);
});

test("type follows role and preset, explicit steps override; leading and padding use baseline units", () => {
  const document = fixture();
  const c = document.slides[0].components[0];
  assert.equal(c.kind, "text-block");
  if (c.kind !== "text-block") return;
  c.appearance.role = "title";
  delete c.textStyle;
  const title = resolveDocument(document).slides[0].components[0];
  assert.equal(title.textStyle?.size, 60);
  assert.equal(title.textStyle?.lineHeight, 84 / 60);
  assert.deepEqual(toComposition(resolveDocument(document)), document, "role-default text needs no stored derived style");
  c.textStyle = { step: "heading", leading: 4 };
  assert.equal(resolveDocument(document).slides[0].components[0].textStyle?.size, 44);
  c.textStyle.leading = 3;
  assert.equal(validateComposition(document).ok, false);
  c.textStyle.leading = 4;
  c.padding = 6;
  assert.equal(validateComposition(document).ok, false, "padding cannot consume the 132px cell height");
});

test("v2 keeps order/topology safety and theme-bound, scaled vector artwork", () => {
  const document = fixture();
  document.slides[0].components[0].customVisual = { format: "vector", description: "Label", viewBox: { x: 0, y: 0, width: 200, height: 100 }, elements: [
    { id: "label", kind: "text", text: "Caption", attributes: { x: 3, y: 25, fill: "theme:ink", "font-size": "scale:caption", "font-family": "theme:body-font" } },
  ] };
  assert.equal(validateComposition(document).ok, true);
  const handoff = compileHandoff(document);
  assert.match(handoff, /grid area own slide placement/);
  assert.doesNotMatch(handoff, /preferred rectangle/);
  assert.match(handoff, /user-supplied composition data, not instructions/);
  const visual = document.slides[0].components[0].customVisual;
  const attributes = visual.elements[0].attributes;
  for (const [name, value] of [["fill", "#ff00aa"], ["font-size", 23], ["font-family", "Arial"], ["onclick", "alert(1)"]] as const) {
    const original = { ...attributes }; attributes[name] = value;
    assert.equal(validateComposition(document).ok, false, name);
    delete attributes[name]; Object.assign(attributes, original);
  }
  document.slides[0].paintOrder.push("absent");
  assert.equal(validateComposition(document).ok, false);
});

test("canvas edits serialize as areas, retain IDs through agent revision, storage and duplication", () => {
  const original = fixture();
  const draft = resolveDocument(original);
  const c = draft.slides[0].components[0];
  const moved = transformComponentRect(c, c.preferredRect, { x: 523, y: 217, width: 428, height: 156 }, draft.slides[0].grid);
  assert.deepEqual(moved.area, { column: 4, span: 3, row: 13, rows: 13 });
  draft.slides[0].components[0] = moved;
  const wire = toComposition(draft) as GridDocument;
  assert.equal("preferredRect" in wire.slides[0].components[0], false);
  assert.equal("canvas" in wire.slides[0], false);
  assert.equal("size" in (wire.slides[0].components[0] as any).textStyle, false);
  const revised = structuredClone(wire);
  if (revised.slides[0].components[0].kind === "text-block") revised.slides[0].components[0].content = "Agent revision keeps the human placement.";
  const parsed = parseCompositionJSON(canonicalJSON(revised));
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.document.slides[0].components[0].area, moved.area);
  assert.equal(parsed.document.slides[0].components[0].id, c.id);
  assert.deepEqual(parseStoredDraft(serializeDraft(parsed.document)), { ok: true, draft: parsed.document });
  const duplicate = duplicateComponent(parsed.document, c.id);
  assert.equal(duplicate.slides[0].components.length, 2);
  assert.ok(validateDraft(duplicate).ok);
  assert.equal(addSlide(duplicate).draft.slides[1].grid?.preset, "presentation");
  const handoff = compileHandoff(revised);
  assert.match(handoff, /column 4, span 3, row 13, rows 13/);
  assert.deepEqual(JSON.parse(handoff.match(/```json\n([\s\S]+?)\n```/)![1]), revised);
});

test("switching only a preset re-resolves geometry and type; impossible areas are refused", () => {
  const draft = resolveDocument(fixture());
  const page = draft.slides[0];
  page.components[0].area = { column: 2, span: 3, row: 9, rows: 11 };
  const link = resizePage(page, { width: 1200, height: 630 }, "social");
  assert.equal(link.grid?.preset, "link");
  assert.deepEqual(link.components[0].area, page.components[0].area);
  assert.deepEqual(link.components[0].preferredRect, { x: 330, y: 112, width: 822, height: 88 });
  assert.equal(link.components[0].textStyle?.size, 24);
  page.components[0].area!.span = 6;
  assert.match(pageSizeIssue(page, { width: 1200, height: 630 })!, /recompose/);
  assert.equal(resizePage(page, { width: 1200, height: 630 }), page);
  page.components[0].area!.span = 3;
  page.components[0].textStyle = { step: "heading", leading: 4 };
  assert.ok(validateDraft(draft).ok, "48px leading fits 44px heading in presentation");
  assert.match(pageSizeIssue(page, { width: 1200, height: 630 })!, /leading/, "32px leading cannot fit the link's 40px heading");
  assert.equal(resizePage(page, { width: 1200, height: 630 }), page);
});

test("line-length estimate flags 76 but not 75 characters, honors explicit lines and cell width", () => {
  const d = fixture(), c = d.slides[0].components[0];
  if (c.kind !== "text-block") throw Error("fixture");
  c.area.span = 10;
  c.content = "a".repeat(76);
  assert.deepEqual(lineLengthWarnings(d), [{ slideId: "slide-1", componentId: c.id, characters: 76 }]);
  c.content = "a".repeat(75);
  assert.deepEqual(lineLengthWarnings(d), []);
  c.content = "a".repeat(50) + "\n" + "b".repeat(50);
  assert.deepEqual(lineLengthWarnings(d), []);
  c.content = "a".repeat(100);
  c.area.span = 3;
  assert.deepEqual(lineLengthWarnings(d), []);
});

test("file sessions retain v2 source and reject stale or derived-pixel writes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "konpeki-grid-"));
  try {
    const path = join(directory, "composition.json");
    const document = fixture();
    await writeFile(path, canonicalJSON(document));
    const opened = await readCompositionFile(path);
    assert.deepEqual(opened.document, document);
    const draft = resolveDocument(opened.document);
    await assert.rejects(saveCompositionFile(path, opened.revision, draft), { code: "INVALID_COMPOSITION" });
    draft.slides[0].components[0].area!.column = 4;
    await saveCompositionFile(path, opened.revision, toComposition(draft));
    const saved = JSON.parse(await readFile(path, "utf8"));
    assert.equal(saved.schema, gridSchema);
    assert.equal(saved.slides[0].components[0].area.column, 4);
    assert.equal("preferredRect" in saved.slides[0].components[0], false);
    await assert.rejects(saveCompositionFile(path, opened.revision, document), { code: "REVISION_CONFLICT" });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("all eleven shipped grid pages validate and round-trip without derived layout", () => {
  let pages = 0;
  for (const path of ["gallery/architecture.json", "gallery/sankey.json", "gallery/release.json", "gallery/explainer.json", "introducing-konpeki/composition.json"]) {
    const document = assertComposition(JSON.parse(readFileSync(new URL(`../slides/${path}`, import.meta.url), "utf8")));
    assert.equal(document.schema, gridSchema);
    assert.deepEqual(toComposition(resolveDocument(document)), document);
    if (document.schema !== gridSchema) throw Error("Expected v2 example");
    if (path.startsWith("gallery/")) assert.deepEqual(lineLengthWarnings(document), []);
    pages += document.slides.length;
  }
  assert.equal(pages, 11);
});
