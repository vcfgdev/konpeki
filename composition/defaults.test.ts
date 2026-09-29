import { test } from "node:test";
import assert from "node:assert/strict";
import { initialDraft } from "./document.ts";
import { toComposition } from "./grid.ts";
import { validateComposition } from "./validate.ts";
import { renderDocument } from "../bin/render.ts";

function fullDocument() {
  const document = toComposition(initialDraft());
  const slide = document.pages[0];
  slide.components = [...slide.components].reverse();
  for (const component of slide.components) {
    component.slotIds = [];
    if (component.kind === "chart" || component.kind === "diagram") delete component.topology;
  }
  slide.contentSlots = [];
  slide.groups = [];
  slide.relationships = [];
  slide.readingOrder = slide.components.map(component => ({ kind: "component", id: component.id }));
  slide.paintOrder = slide.components.map(component => component.id);
  return document;
}

test("omitted bookkeeping defaults without mutating frozen source and renders identically", async () => {
  const full = fullDocument();
  const shortened: any = structuredClone(full);
  const slide = shortened.pages[0];
  delete slide.contentSlots;
  delete slide.groups;
  delete slide.relationships;
  delete slide.readingOrder;
  delete slide.paintOrder;
  for (const component of slide.components) delete component.slotIds;
  Object.freeze(shortened);
  Object.freeze(slide);
  for (const component of slide.components) Object.freeze(component);

  const result = validateComposition(shortened);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.document, full);
  const normalized = result.document.pages[0];
  assert.deepEqual(normalized.contentSlots, []);
  assert.deepEqual(normalized.groups, []);
  assert.deepEqual(normalized.relationships, []);
  assert.deepEqual(normalized.readingOrder, slide.components.map((component: any) => ({ kind: "component", id: component.id })));
  assert.deepEqual(normalized.paintOrder, slide.components.map((component: any) => component.id));
  assert.ok(normalized.components.every(component => component.slotIds.length === 0));
  assert.equal("paintOrder" in slide, false);
  for (const format of ["svg", "png"] as const) {
    const expected = await renderDocument(full, { format });
    const actual = await renderDocument(shortened, { format });
    assert.ok(Buffer.from(actual.bytes).equals(Buffer.from(expected.bytes)), `${format}: source defaults preserve rendering`);
  }
});

test("explicit reading and paint orders are preserved independently", () => {
  const document = fullDocument();
  const slide = document.pages[0];
  slide.readingOrder = [...slide.readingOrder].reverse();
  slide.paintOrder = [...slide.paintOrder];
  const expectedReading = structuredClone(slide.readingOrder);
  const expectedPaint = [...slide.paintOrder];
  const result = validateComposition(document);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.document.pages[0].readingOrder, expectedReading);
    assert.deepEqual(result.document.pages[0].paintOrder, expectedPaint);
  }

  // Neither default may be copied from the other explicit order.
  for (const omitted of ["readingOrder", "paintOrder"] as const) {
    const source: any = fullDocument();
    const ids = source.pages[0].components.map((component: any) => component.id);
    source.pages[0].readingOrder = [...ids].reverse().map(id => ({ kind: "component", id }));
    source.pages[0].paintOrder = [...ids].reverse();
    delete source.pages[0][omitted];
    const normalized = validateComposition(source);
    assert.equal(normalized.ok, true);
    if (!normalized.ok) continue;
    assert.deepEqual(normalized.document.pages[0].readingOrder.map(entry => entry.id), omitted === "readingOrder" ? ids : [...ids].reverse());
    assert.deepEqual(normalized.document.pages[0].paintOrder, omitted === "paintOrder" ? ids : [...ids].reverse());
  }
});

test("explicit invalid values and unresolved references still fail", () => {
  const emptyOrder = fullDocument();
  emptyOrder.pages[0].readingOrder = [];
  assert.equal(validateComposition(emptyOrder).ok, false);

  for (const key of ["groups", "relationships", "contentSlots", "readingOrder", "paintOrder"] as const) {
    const document: any = fullDocument();
    document.pages[0][key] = null;
    assert.equal(validateComposition(document).ok, false, key);
  }

  const unknownSlot = fullDocument();
  unknownSlot.pages[0].components[0].slotIds = ["missing"];
  assert.equal(validateComposition(unknownSlot).ok, false);

  const unassignedSlot = fullDocument();
  unassignedSlot.pages[0].contentSlots = [{ id: "orphan", label: "Orphan", required: true, instruction: "Keep", role: "body" }];
  assert.equal(validateComposition(unassignedSlot).ok, false);
});
