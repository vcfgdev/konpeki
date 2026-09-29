import { test } from "node:test";
import assert from "node:assert/strict";
import { addComponent, duplicateComponent, initialGridDraft, removeComponent, transformComponentRect } from "./document.ts";
import { groupRect, resolveDocument, toComposition } from "./grid.ts";
import { assertComposition, validateComposition } from "./validate.ts";
import { loadNodeFontContext } from "./fonts.ts";
import { lowerPage } from "./lower.ts";
import { inspectPage } from "./inspect.ts";
import { checkPage } from "./check.ts";
import { renderDocument } from "../bin/render.ts";
import { pageSizeIssue } from "../src/lib/page-size.ts";

const fonts = await loadNodeFontContext(new URL("../fonts/", import.meta.url));
function fixture() {
  const document = toComposition(addComponent(initialGridDraft(), "text-block"));
  const page = document.pages[0];
  page.preset = "a4";
  page.canvas = { width: 210 / 25.4 * 96, height: 297 / 25.4 * 96 };
  page.innerPadding = { top: 56, right: 56, bottom: 56, left: 56 };
  page.contentSlots = [];
  const template = page.components[0];
  assert.ok(template.kind === "text-block");
  delete template.area; delete template.rect;
  template.slotIds = [];
  template.appearance.layout = "single";
  template.appearance.role = "body";
  template.appearance.rule = "none";
  template.textStyle = { step: "body" };
  page.components = ["paragraph", "next", "heading"].map(id => ({ ...structuredClone(template), id, content: id === "paragraph" ? "One\nTwo\nThree" : id }));
  const [paragraph, next, heading] = page.components;
  assert.ok(paragraph.kind === "text-block" && next.kind === "text-block" && heading.kind === "text-block");
  heading.textStyle = { step: "heading" };
  page.groups = [{ id: "prose", layout: "stack", childIds: [paragraph.id, next.id, heading.id] }];
  page.readingOrder = [{ kind: "group", id: "prose" }];
  // Neither source order nor paint order may become layout order.
  page.components.reverse();
  page.paintOrder = [next.id, heading.id, paragraph.id];
  return { document, page, paragraph, next, heading };
}
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);

test("stack measures text once, preserves IDs/orders, uses paragraph and section gaps, and round-trips without areas", () => {
  const { document, page, paragraph, next, heading } = fixture();
  assertComposition(document);
  const original = structuredClone(document), scene = lowerPage(document, page, fonts);
  const first = scene.components.find(c => c.id === paragraph.id)!;
  const second = scene.components.find(c => c.id === next.id)!;
  const section = scene.components.find(c => c.id === heading.id)!;
  near(first.box.y, 56);
  assert.equal(first.box.height, 60);
  near(second.box.y - first.box.y, 70); // three 20px lines + 10px paragraph gap
  near(section.box.y - second.box.y, 40); // one 20px line + 20px section gap
  assert.equal(section.box.height, 30);
  assert.deepEqual(scene.components.map(c => c.id), page.paintOrder);
  assert.deepEqual(scene.items.map(item => item.componentId), page.paintOrder);
  for (const item of scene.items) {
    assert.ok(item.kind === "text");
    assert.deepEqual(item.box, item.clip);
    assert.equal(item.box.height, item.layout.height);
  }
  const report = inspectPage(page, scene, fonts);
  const reported = report.components.find(c => c.id === paragraph.id)!;
  assert.ok("flow" in reported);
  assert.deepEqual(reported.flow, { groupId: "prose" });
  assert.deepEqual(checkPage(scene, fonts), []);
  assert.deepEqual(toComposition(resolveDocument(document)), original);
  assert.deepEqual(document, original, "no measured coordinates are written into source");
});

test("wrapping, font leading, padding and fractional gaps move later paragraphs without grid quantization", () => {
  const { document, page, paragraph, next } = fixture();
  paragraph.content = "M".repeat(80);
  const wide = lowerPage(document, page, fonts);
  assert.equal(wide.components.find(c => c.id === paragraph.id)?.box.height, 40);
  page.groups[0].rect = { x: 56, y: 80, width: 325, height: 840 };
  const narrow = lowerPage(document, page, fonts);
  assert.equal(narrow.components.find(c => c.id === paragraph.id)?.box.height, 60);
  paragraph.content = "One\nTwo\nThree";
  paragraph.padding = 8; paragraph.textStyle = { leading: 24, font: "heading", weight: 600 };
  page.groups[0].gap = 7.5;
  next.flow = { gapBefore: 3.25 };
  const scene = lowerPage(document, page, fonts);
  const first = scene.components.find(c => c.id === paragraph.id)!, second = scene.components.find(c => c.id === next.id)!;
  assert.equal(first.box.height, 88); // three 24px lines + 8px padding on both sides
  near(first.contentBox.y - first.box.y, 8);
  near(second.box.y - first.box.y, 91.25);
  near(scene.components.find(c => c.id === "heading")!.box.y - second.box.y, 35);
  assert.deepEqual(checkPage(scene, fonts), []);
});

test("flow rejects ambiguous or unsupported placement and reports overflow without shrinking or dropping text", () => {
  for (const mutate of [
    ({ page }: ReturnType<typeof fixture>) => page.groups = [],
    ({ paragraph }: ReturnType<typeof fixture>) => paragraph.rect = { x: 56, y: 56, width: 400, height: 40 },
    ({ paragraph }: ReturnType<typeof fixture>) => paragraph.appearance.layout = "two-column",
    ({ paragraph }: ReturnType<typeof fixture>) => paragraph.appearance.verticalAlignment = "center",
    ({ page }: ReturnType<typeof fixture>) => page.groups[0].verticalAlignment = "start",
    ({ page }: ReturnType<typeof fixture>) => page.groups[0].gap = -1,
    ({ page }: ReturnType<typeof fixture>) => page.groups.push({ id: "other", layout: "stack", childIds: ["paragraph"] }),
    ({ page }: ReturnType<typeof fixture>) => page.groups[0].childIds.push("missing"),
    ({ page, paragraph }: ReturnType<typeof fixture>) => { page.groups[0].rect = { x: 56, y: 56, width: 54, height: 80 }; paragraph.padding = 28; },
  ]) {
    const value = fixture(); mutate(value);
    assert.equal(validateComposition(value.document).ok, false);
  }
  const { document, page, paragraph } = fixture();
  page.groups[0].rect = { x: 56, y: 56, width: 682, height: 12 };
  paragraph.padding = 8; // Auto-height padding must not be rejected against the frame's height.
  assertComposition(document); // Text overflow is a measured diagnostic, not a schema guess.
  const scene = lowerPage(document, page, fonts);
  assert.equal(scene.items.filter(item => item.kind === "text").length, 3);
  const first = scene.items.find(item => item.kind === "text" && item.componentId === paragraph.id)!;
  assert.ok(first.kind === "text");
  assert.equal(first.fontSize, 14); assert.equal(first.layout.lines.length, 3);
  assert.equal(checkPage(scene, fonts).filter(d => d.code === "group-overflow").length, 1);
  assert.equal(document.pages.length, 1);

  page.groups[0].rect = { x: 56, y: 56, width: 54, height: 80 };
  paragraph.padding = 16;
  assertComposition(document); // 32px total padding fits the A4 column.
  assert.equal(pageSizeIssue(resolveDocument(document).pages[0], { width: 1080, height: 1350 }), undefined,
    "page resizing does not reinterpret or retype flow content");
});

test("text changes, deletion, duplication and correction offsets preserve flow and stable references", () => {
  const { document, page, paragraph, next } = fixture();
  const original = lowerPage(document, page, fonts);
  const rect = original.components.find(c => c.id === next.id)!.box;
  const draft = resolveDocument(document), member = draft.pages[0].components.find(c => c.id === next.id)!;
  const moved = transformComponentRect(member, rect, { ...rect, x: rect.x + 1.9, y: rect.y - 1.9 }, page.canvas);
  assert.deepEqual(moved.flow, { offset: { x: 2, y: -2 } });
  draft.pages[0].components = draft.pages[0].components.map(c => c.id === next.id ? moved : c);
  const wire = toComposition(draft); assertComposition(wire);
  const edited = wire.pages[0].components.find(c => c.id === paragraph.id)!;
  assert.ok(edited.kind === "text-block"); edited.content += "\nFourth";
  const scene = lowerPage(wire, wire.pages[0], fonts);
  const corrected = scene.components.find(c => c.id === next.id)!;
  near(corrected.box.x - rect.x, 2); near(corrected.box.y - rect.y, 18);
  near(scene.components.find(c => c.id === "heading")!.box.y - original.components.find(c => c.id === "heading")!.box.y, 20);
  const removed = toComposition(removeComponent(resolveDocument(wire), paragraph.id)); assertComposition(removed);
  near(lowerPage(removed, removed.pages[0], fonts).components.find(c => c.id === next.id)!.box.y, groupRect(page).y - 2);
  const duplicate = toComposition(duplicateComponent(resolveDocument(document), next.id)); assertComposition(duplicate);
  assert.deepEqual(duplicate.pages[0].groups[0].childIds, [paragraph.id, next.id, "next-copy", "heading"]);
  assert.ok(duplicate.pages[0].components.every(c => !c.area));
});

test("pixel flow and positioned siblings export identically to every format", async () => {
  const { document, page } = fixture();
  page.groups[0].rect = { x: 180, y: 76, width: 420, height: 840 };
  const positioned = structuredClone(page.components[0]);
  positioned.id = "fixed"; positioned.rect = { x: 56, y: 996, width: 682, height: 48 };
  page.components.push(positioned); page.paintOrder.push(positioned.id); page.readingOrder.push({ kind: "component", id: positioned.id });
  assertComposition(document);
  for (const format of ["svg", "png", "pdf"] as const) {
    const result = await renderDocument(document, { format });
    assert.ok(result.bytes.length > 100);
  }
});
