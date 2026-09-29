import test from "node:test";
import assert from "node:assert/strict";
import { assertComposition, validateComposition } from "./validate.ts";
import { lowerPage } from "./lower.ts";
import { loadNodeFontContext } from "./fonts.ts";
import { checkPage } from "./check.ts";
import { textInkBounds } from "./scene.ts";
import { resolveDocument, toComposition } from "./grid.ts";
import { addComponent, duplicateComponent, initialDraft, transformComponentRect } from "./document.ts";
import { alignmentGuides } from "../src/lib/model.ts";
import { commitHistory, createHistory, undoHistory } from "../src/lib/history.ts";

const fonts = await loadNodeFontContext(new URL("../fonts/", import.meta.url));
function fixture() {
  return assertComposition({ schema: "konpeki-composition/v2", title: "Pixel text bounds",
    pages: [{ id: "page", name: "Measured text", canvas: { width: 521.5, height: 401.25 },
      audience: "Readers", question: "How large is this text?", intendedViewingSize: "custom",
      components: [{ id: "text", kind: "text-block", content: "Hg\njp", appearance: { role: "body" },
        rect: { x: 13.25, y: 17.75, width: 191.5 }, padding: 3.25, textStyle: { size: 17.5, leading: 20.5 } }],
    }],
  });
}

test("measured text boxes include exact pixel padding, distinct from visible glyph ink", () => {
  const document = fixture(), page = document.pages[0], before = structuredClone(document);
  const scene = lowerPage(document, page, fonts), item = scene.items[0];
  assert.deepEqual(scene.components[0].box, { x: 13.25, y: 17.75, width: 191.5, height: 47.5 });
  assert.deepEqual(scene.components[0].contentBox, { x: 16.5, y: 21, width: 185, height: 41 });
  assert.ok(item.kind === "text");
  assert.equal(item.fontSize, 17.5); assert.equal(item.lineHeight, 20.5);
  assert.deepEqual(item.layout.lines.map(line => line.text), ["Hg", "jp"]);
  const ink = textInkBounds(item, fonts)!;
  assert.ok(ink.height > 20.5 && ink.height < 41, "two glyph lines are not a fixed-height selection box");
  assert.ok(ink.y > 21 && ink.y + ink.height < 62, "leading is separate from padding and visible ink");
  assert.deepEqual(checkPage(scene, fonts), []);
  assert.deepEqual(document, before);
  assert.deepEqual(toComposition(resolveDocument(document)), before);

  page.components[0].rect!.height = 47.5;
  assert.deepEqual(lowerPage(document, page, fonts), scene, "explicit matching height renders identically in every scene writer");
  page.components[0].padding = 0;
  delete page.components[0].rect!.height;
  const tight = lowerPage(document, page, fonts);
  assert.deepEqual(tight.components[0].box, { x: 13.25, y: 17.75, width: 191.5, height: 41 });
  assert.deepEqual(tight.components[0].contentBox, tight.components[0].box);
});

test("auto-height and matching fixed-height text share vertical alignment with multiline padding", () => {
  for (const alignment of ["start", "center", "end"] as const) {
    const document = fixture(), page = document.pages[0], component = page.components[0];
    assert.ok(component.kind === "text-block");
    component.appearance.verticalAlignment = alignment;
    const automatic = lowerPage(document, page, fonts);
    component.rect!.height = 47.5; // two 20.5px lines plus 6.5px padding
    const fixed = lowerPage(document, page, fonts);
    assert.deepEqual(automatic, fixed, `${alignment}: only sizing intent changed`);
    const item = automatic.items[0]; assert.ok(item.kind === "text");
    if (alignment === "center") assert.notEqual(item.box.y, 21, "cap centering is not start alignment");
  }
});

test("moves, duplicates and undo preserve subpixel dimensions and untouched resize axes", () => {
  for (const size of [{ width: .5, height: 40 }, { width: 30, height: .75 }]) {
    const document = fixture(), page = document.pages[0];
    page.components = [{ id: "line", kind: "image", slotIds: [], appearance: {}, rect: { x: 100.25, y: 70.5, ...size } }];
    page.paintOrder = ["line"]; page.readingOrder = [{ kind: "component", id: "line" }];
    const draft = resolveDocument(assertComposition(document)), component = draft.pages[0].components[0];
    const before = component.preferredRect;
    const moved = transformComponentRect(component, before, { ...before, x: before.x + 1 }, draft.pages[0].canvas);
    assert.deepEqual(moved.rect, { ...before, x: 101.25 });
    const resized = transformComponentRect(component, before,
      { ...before, width: before.width + (size.width < 1 ? 0 : 1), height: before.height + (size.height < 1 ? 0 : 1) });
    assert.deepEqual(resized.rect, { ...before, width: size.width + (size.width < 1 ? 0 : 1), height: size.height + (size.height < 1 ? 0 : 1) });
    const duplicate = duplicateComponent(draft, component.id);
    assert.deepEqual(duplicate.pages[0].components[1].rect, { ...before, x: 148.25, y: 118.5 });
    const history = commitHistory(createHistory(draft), duplicate);
    assert.deepEqual(toComposition(undoHistory(history).present), document);
  }
});

test("created text inherits role and preset typography while authored sizes remain overrides", () => {
  const starter = toComposition(initialDraft());
  const text = lowerPage(starter, starter.pages[0], fonts).items.filter(item => item.kind === "text").filter(item => item.componentId?.startsWith("text-block"));
  assert.deepEqual(text.map(item => [item.fontSize, item.lineHeight]), [[60, 68], [28, 40], [20, 28]]);
  for (const [preset, width, height, size, leading] of [["a4", 794, 1123, 14, 20], ["link", 1200, 630, 24, 32]] as const) {
    const draft = initialDraft(true);
    draft.pages[0].preset = preset; draft.pages[0].canvas = { width, height };
    const document = toComposition(addComponent(draft, "text-block")), page = document.pages[0];
    const component = page.components[0]; assert.ok(component.kind === "text-block");
    assert.equal(component.textStyle?.size, undefined);
    const item = lowerPage(document, page, fonts).items[0]; assert.ok(item.kind === "text");
    assert.deepEqual([item.fontSize, item.lineHeight], [size, leading]);
    component.textStyle = { size: 17.5, leading: 23 };
    const explicit = lowerPage(document, page, fonts).items[0]; assert.ok(explicit.kind === "text");
    assert.deepEqual([explicit.fontSize, explicit.lineHeight], [17.5, 23]);
    assert.deepEqual(toComposition(resolveDocument(document)), document);
  }
});

test("padding reduces wrap width and auto height follows copy without hiding page overflow", () => {
  const document = fixture(), page = document.pages[0], component = page.components[0];
  assert.ok(component.kind === "text-block");
  component.content = "WWWW\nWWWW";
  component.rect = { x: 8, y: 280, width: 100 };
  component.padding = 0; component.textStyle = { size: 17.5, leading: 23 };
  assert.equal(lowerPage(document, page, fonts).components[0].box.height, 46);
  component.padding = 20;
  const scene = lowerPage(document, page, fonts);
  assert.equal(scene.components[0].box.height, 132); // four 23px lines + 40px padding
  assert.ok(validateComposition(document).ok, "height requires font measurement, not a schema estimate");
  assert.deepEqual(checkPage(scene, fonts).map(d => [d.code, d.componentId]), [["component-overflow", "text"]]);
  assert.equal(document.pages.length, 1); assert.equal(component.rect.height, undefined);
  component.rect.height = 50;
  assert.ok(checkPage(lowerPage(document, page, fonts), fonts).some(d => d.code === "native-overflow"));
});

test("auto-height corrections preserve source sizing until an explicit vertical resize", () => {
  const document = fixture(), draft = resolveDocument(document), component = draft.pages[0].components[0];
  const measured = { x: 13.25, y: 17.75, width: 191.5, height: 47.5 };
  const moved = transformComponentRect(component, measured, { ...measured, x: 14.25, y: 16.75 }, draft.pages[0].canvas);
  assert.deepEqual(moved.rect, { x: 14.25, y: 16.75, width: 191.5 });
  const wider = transformComponentRect(component, measured, { ...measured, width: 192.5 });
  assert.equal(wider.rect?.height, undefined);
  const taller = transformComponentRect(component, measured, { ...measured, height: 48.5 });
  assert.equal(taller.rect?.height, 48.5);
  const overflowing = { ...measured, height: 500 };
  const bounded = transformComponentRect(component, overflowing, { ...overflowing, x: 14.25, y: 0 }, draft.pages[0].canvas);
  assert.deepEqual(bounded.rect, { x: 14.25, y: 0, width: 191.5 }, "overflowing measured text can move without shrinking or acquiring negative coordinates");
});

test("alignment guides find edges and page centers without moving fractional rectangles", () => {
  const rect = { x: 301.25, y: 232, width: 98, height: 40 }, before = { ...rect };
  const bounds = { width: 1000, height: 600 }, margins = { top: 40, right: 40, bottom: 40, left: 40 };
  assert.deepEqual(alignmentGuides(rect, [{ x: 400, y: 300, width: 100, height: 61 }], bounds, margins), [{ axis: "x", value: 400 }]);
  assert.deepEqual(rect, before);
  assert.deepEqual(alignmentGuides({ x: 450.5, y: 281.25, width: 100, height: 40 }, [], bounds, margins),
    [{ axis: "x", value: 500 }, { axis: "y", value: 300 }]);
  assert.deepEqual(alignmentGuides({ ...rect, x: 296 }, [{ x: 400, y: 300, width: 100, height: 61 }], bounds, margins), []);
});
