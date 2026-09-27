import test from "node:test";
import assert from "node:assert/strict";
import { addComponent, addSlide, duplicateComponent, initialDraft, parseCompositionJSON, snapRect, snapResizeRect } from "./model.ts";
import { pagePresets, pageSizeIssue, resizePage } from "./page-size.ts";
import { validateComposition } from "../../composition/validate.ts";
import { resolveDocument, toComposition, toGridComponent } from "../../composition/grid.ts";
import { canonicalJSON, compileHandoff } from "../../composition/compile.ts";
import { commitHistory, createHistory, undoHistory, redoHistory } from "./history.ts";

test("presets support all five kinds, duplication, and JSON round trips", () => {
  for (const size of pagePresets) {
    let doc = initialDraft(true);
    doc.slides[0] = resizePage(doc.slides[0], size);
    assert.deepEqual(doc.slides[0].canvas, { width: size.width, height: size.height });
    assert.deepEqual(doc.slides[0].components, []);
    for (const kind of ["text-block", "diagram", "chart", "image", "table"] as const) {
      doc = addComponent(doc, kind, { x: size.width, y: size.height });
      const component = doc.slides[0].components.at(-1)!;
      assert.equal(component.kind, kind);
      doc = duplicateComponent(doc, component.id);
    }
    assert.equal(doc.slides[0].components.length, 10);
    assert.equal(validateComposition(toComposition(doc)).ok, true);
    const parsed = parseCompositionJSON(canonicalJSON(toComposition(doc)));
    assert.ok(parsed.ok);
    if (parsed.ok) assert.deepEqual(parsed.document, resolveDocument(toComposition(doc)));
  }
});

test("preset resize preserves authored areas and supports undo/redo", () => {
  const doc = initialDraft(true);
  const original = addComponent(doc, "text-block").slides[0];
  const wide = resizePage(original, { width: 1600, height: 600 }, "article");
  assert.notEqual(wide, original);
  assert.equal(wide.grid?.preset, "article");
  assert.equal(wide.grid?.revision, 2);
  assert.deepEqual(wide.components.map(component => component.area), original.components.map(component => component.area));
  assert.equal(pageSizeIssue(original, { width: 1600, height: 600 }), undefined);
  const square = resizePage(original, { width: 1080, height: 1080 }, "social");
  assert.deepEqual(square.components.map(toGridComponent), original.components.map(toGridComponent));
  assert.notDeepEqual(square.components[0].preferredRect, original.components[0].preferredRect);
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
  assert.match(compileHandoff(doc), /Components choose area \{column, span, row, rows\}/);
  const wire = toComposition(doc);
  wire.slides[0].components[0].area.column = 9;
  assert.equal(validateComposition(wire).ok, false);
  assert.ok(pageSizeIssue(initialDraft(true).slides[0], { width: 4096, height: 4096 }));
});

test("new pages remain independent and empty", () => {
  const doc = initialDraft();
  const next = addSlide(doc).draft;
  assert.deepEqual(next.slides[1].components, []);
  next.slides[1] = resizePage(next.slides[1], { width: 1600, height: 600 });
  assert.deepEqual(next.slides[0], doc.slides[0]);
});

test("preset switching checks component and group bounds against the page's grid revision", () => {
  const doc = addComponent(initialDraft(true), "text-block"), page = doc.slides[0];
  page.components[0].area = { column: 6, span: 3, row: 1, rows: 10 };
  page.groups = [{ id: "aligned", childIds: [page.components[0].id], area: { column: 5, span: 4, row: 1, rows: 20 }, verticalAlignment: "center" }];
  const size = { width: 1200, height: 630 }, next = resizePage(page, size);
  assert.deepEqual(next.grid, { preset: "link", revision: 2 });
  assert.deepEqual(next.components[0].preferredRect, { x: 753, y: 51, width: 399, height: 80 });
  assert.equal(validateComposition(toComposition({ ...doc, slides: [next] })).ok, true);
  page.groups[0].area!.column = 6;
  assert.ok(pageSizeIssue(page, size), "groups cannot extend beyond column 8");
  page.groups[0].area!.column = 5;
  page.grid!.revision = 1;
  assert.ok(pageSizeIssue(page, size), "the same areas do not fit the original four columns");
});
