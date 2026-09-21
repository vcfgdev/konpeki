import test from "node:test";
import assert from "node:assert/strict";
import { addComponent, addSlide, duplicateComponent, initialDraft, parseCompositionJSON, snapRect, snapResizeRect } from "./model.ts";
import { pagePresets, pageSizeIssue, resizePage } from "./page-size.ts";
import { validateComposition } from "../../composition/validate.ts";
import { canonicalJSON, compileHandoff } from "../../composition/compile.ts";
import { commitHistory, createHistory, undoHistory, redoHistory } from "./history.ts";

test("presets and custom pages support all five kinds, duplication, and JSON round trips", () => {
  for (const size of [...pagePresets, { width: 256, height: 256 }, { width: 4096, height: 4096 }]) {
    let doc = initialDraft(true);
    doc.slides[0] = resizePage(doc.slides[0], size);
    assert.deepEqual(doc.slides[0].components, []);
    for (const kind of ["text-block", "diagram", "chart", "image", "table"] as const) {
      doc = addComponent(doc, kind, { x: size.width, y: size.height });
      const component = doc.slides[0].components.at(-1)!;
      assert.equal(component.kind, kind);
      doc = duplicateComponent(doc, component.id);
    }
    assert.equal(doc.slides[0].components.length, 10);
    assert.equal(validateComposition(doc).ok, true);
    const parsed = parseCompositionJSON(canonicalJSON(doc));
    assert.ok(parsed.ok);
    if (parsed.ok) assert.deepEqual(parsed.document, doc);
  }
});

test("resize never transforms content or silently clips it, and supports undo/redo", () => {
  const doc = initialDraft(true);
  const original = addComponent(doc, "text-block").slides[0];
  const wide = resizePage(original, { width: 1600, height: 600 }, "article");
  assert.equal(wide, original); // default text rectangle extends to y=700
  assert.match(pageSizeIssue(original, { width: 1600, height: 600 })!, /Nothing has changed/);
  const square = resizePage(original, { width: 1080, height: 1080 }, "social");
  assert.deepEqual(square.components, original.components);
  assert.deepEqual(original.canvas, { width: 1920, height: 1080 });
  const history = commitHistory(createHistory(original), square);
  assert.deepEqual(undoHistory(history).present, original);
  assert.deepEqual(redoHistory(undoHistory(history)).present, square);
  for (const width of [0, 255, 4097, 1080.5, NaN, Infinity])
    assert.ok(pageSizeIssue(original, { width, height: 1080 }));
});

test("page bounds govern moves, resizes, schema validation and handoff", () => {
  const bounds = { width: 1200, height: 630 };
  assert.deepEqual(snapRect({ x: 1400, y: 900, width: 200, height: 100 }, [], 0, bounds).rect,
    { x: 1000, y: 530, width: 200, height: 100 });
  assert.deepEqual(snapResizeRect({ x: 1000, y: 530, width: 900, height: 800 }, [], 0, undefined, bounds).rect,
    { x: 1000, y: 530, width: 200, height: 100 });
  let doc = initialDraft(true);
  doc.slides[0] = resizePage(doc.slides[0], bounds, "social");
  doc = addComponent(doc, "text-block");
  assert.match(compileHandoff(doc), /Surface: 1200×630 pixels; destination: social/);
  assert.match(compileHandoff(doc), /Sketching is optional/);
  doc.slides[0].components[0].preferredRect.x = 1200;
  assert.equal(validateComposition(doc).ok, false);
  doc = initialDraft(true);
  doc.slides[0].canvas.width = 4097;
  assert.equal(validateComposition(doc).ok, false);
});

test("new pages remain independent and empty", () => {
  const doc = initialDraft();
  const next = addSlide(doc).draft;
  assert.deepEqual(next.slides[1].components, []);
  next.slides[1] = resizePage(next.slides[1], { width: 1600, height: 600 });
  assert.deepEqual(next.slides[0], doc.slides[0]);
});
