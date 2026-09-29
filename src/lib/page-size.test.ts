import test from "node:test";
import assert from "node:assert/strict";
import { addComponent, addSlide, duplicateComponent, initialDraft, parseCompositionJSON, snapRect, snapResizeRect } from "./model.ts";
import { pagePresets, pageSizeIssue, resizePage } from "./page-size.ts";
import { validateComposition } from "../../composition/validate.ts";
import { resolveDocument, toComposition } from "../../composition/grid.ts";
import { canonicalJSON, compileHandoff } from "../../composition/compile.ts";
import { commitHistory, createHistory, undoHistory, redoHistory } from "./history.ts";

test("presets support all five kinds, duplication, and JSON round trips", () => {
  for (const size of pagePresets) {
    let doc = initialDraft(true);
    doc.pages[0] = resizePage(doc.pages[0], size);
    assert.deepEqual(doc.pages[0].canvas, { width: size.width, height: size.height });
    assert.deepEqual(doc.pages[0].components, []);
    for (const kind of ["text-block", "diagram", "chart", "image", "table"] as const) {
      doc = addComponent(doc, kind, { x: size.width, y: size.height });
      const component = doc.pages[0].components.at(-1)!;
      assert.equal(component.kind, kind);
      doc = duplicateComponent(doc, component.id);
    }
    assert.equal(doc.pages[0].components.length, 10);
    assert.equal(validateComposition(toComposition(doc)).ok, true);
    const parsed = parseCompositionJSON(canonicalJSON(toComposition(doc)));
    assert.ok(parsed.ok);
    if (parsed.ok) assert.deepEqual(parsed.document, resolveDocument(toComposition(doc)));
  }
});

test("resize preserves authored pixels, typography and preset while supporting undo/redo", () => {
  const doc = initialDraft(true);
  const original = addComponent(doc, "text-block").pages[0];
  const wide = resizePage(original, { width: 1600, height: 1000 }, "article");
  assert.notEqual(wide, original);
  assert.equal(wide.preset, original.preset);
  assert.deepEqual(wide.components, original.components);
  assert.equal(pageSizeIssue(original, { width: 1600, height: 1000 }), undefined);
  const square = resizePage(original, { width: 1080, height: 1080 }, "social");
  assert.deepEqual(square.components, original.components);
  assert.deepEqual(original.canvas, { width: 1920, height: 1080 });
  const history = commitHistory(createHistory(original), square);
  assert.deepEqual(undoHistory(history).present, original);
  assert.deepEqual(redoHistory(undoHistory(history)).present, square);
  for (const width of [0, 255, 4097, NaN, Infinity])
    assert.ok(pageSizeIssue(original, { width, height: 1080 }));
  assert.equal(pageSizeIssue(original, { width: 1080.5, height: 777.25 }), undefined);
});

test("page bounds govern moves, resizes, schema validation and handoff", () => {
  const bounds = { width: 1200, height: 630 };
  assert.deepEqual(snapRect({ x: 1400, y: 900, width: 200, height: 100 }, [], 0, bounds).rect,
    { x: 1000, y: 530, width: 200, height: 100 });
  assert.deepEqual(snapResizeRect({ x: 1000, y: 530, width: 900, height: 800 }, [], 0, undefined, bounds).rect,
    { x: 1000, y: 530, width: 200, height: 100 });
  let doc = initialDraft(true);
  doc.pages[0] = resizePage(doc.pages[0], bounds, "social");
  doc = addComponent(doc, "text-block");
  assert.match(compileHandoff(doc), /Surface: 1200×630 pixels; destination: social/);
  assert.match(compileHandoff(doc), /rect/);
  const wire = toComposition(doc);
  wire.pages[0].components[0].rect!.x = 1100;
  assert.equal(validateComposition(wire).ok, false);
  assert.equal(pageSizeIssue(initialDraft(true).pages[0], { width: 4096, height: 4096 }), undefined);
});

test("new pages remain independent and empty", () => {
  const doc = initialDraft();
  const next = addSlide(doc).draft;
  assert.deepEqual(next.pages[1].components, []);
  next.pages[1] = resizePage(next.pages[1], { width: 1600, height: 600 });
  assert.deepEqual(next.pages[0], doc.pages[0]);
});

test("resizing checks component and group pixel bounds without retyping or rescaling", () => {
  const doc = addComponent(initialDraft(true), "text-block"), page = doc.pages[0];
  page.components[0].rect = { x: 700, y: 50, width: 300, height: 100 };
  page.groups = [{ id: "aligned", childIds: [page.components[0].id], rect: { x: 650, y: 40, width: 500, height: 200 }, verticalAlignment: "center" }];
  const size = { width: 1200, height: 630 }, next = resizePage(page, size);
  assert.deepEqual(next.components[0], page.components[0]);
  assert.equal(validateComposition(toComposition({ ...doc, pages: [next] })).ok, true);
  page.groups[0].rect!.x = 701;
  assert.ok(pageSizeIssue(page, size), "groups cannot extend beyond the canvas");
});
