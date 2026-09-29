import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { addComponent, initialGridDraft } from "./document.ts";
import { toComposition } from "./grid.ts";
import { loadNodeFontContext } from "./fonts.ts";
import { inspectPage, summarizePage } from "./inspect.ts";
import { lowerPage } from "./lower.ts";
import type { ScenePage, SceneText } from "./scene.ts";
import { assertComposition } from "./validate.ts";

const fonts = await loadNodeFontContext(new URL("../fonts/", import.meta.url));
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test("summary shows components and settled groups without repeating scene items or copy", () => {
  const document = assertComposition(JSON.parse(readFileSync(new URL("./fixtures/github-cover/composition.json", import.meta.url), "utf8")));
  const page = document.pages[0], scene = lowerPage(document, page, fonts), before = structuredClone(scene);
  const report = summarizePage(page, scene), json = JSON.stringify(report);
  assert.deepEqual(report.components.map(component => component.id), page.paintOrder);
  assert.equal(report.components.length, 5);
  const brand = report.components.find(component => component.id === "brand")!;
  assert.ok("textLines" in brand);
  assert.deepEqual(brand.box, { x: 48, y: 237.2, width: 540, height: 88 });
  assert.deepEqual(brand.textLines, [["Konpeki"]]);
  assert.equal(json.match(/"Konpeki"/g)?.length, 1);
  const artwork = report.components.find(component => component.id === "visual-family")!;
  assert.ok("artwork" in artwork);
  assert.deepEqual(artwork.artwork, { shapes: 29, labels: 0 });
  assert.equal(report.groups![0].id, "brand-stack");
  assert.deepEqual(report.groups![0].box, { x: 48, y: 51, width: 540, height: 528 });
  assert.deepEqual(report.groups![0].bounds, { x: 48, y: 165.2, width: 362.36, height: 299.61 });
  assert.doesNotMatch(json, /"items"|"source"|"fontIds"|"clip"|"draft"/);
  assert.ok(json.length < JSON.stringify(inspectPage(page, scene, fonts)).length / 5, "summary must remove data, not just whitespace");
  assert.deepEqual(scene, before, "rounding cannot affect the scene or diagnostics");
});

test("inspection reports page-space lines and ink, not local coordinates or glyph arrays", () => {
  const page = toComposition(initialGridDraft()).pages[0];
  const fontId = "ibm-plex-sans-latin-400-normal";
  const glyph = (x: number, y: number, start: number) => ({ fontId, glyphId: 36, x, y, xAdvance: 14,
    yAdvance: 0, xOffset: 0, yOffset: 0, clusterStart: start, clusterEnd: start + 1 });
  const item: SceneText = {
    kind: "text", pageId: page.id, source: "H\n\nH", label: false,
    box: { x: 101, y: 203, width: 80, height: 84 }, clip: { x: 100, y: 200, width: 70, height: 60 },
    fontSize: 20, lineHeight: 28, fontWeight: 400, color: "#000000", opacity: 1,
    layout: { width: 80, height: 84, ascent: 1, descent: .2, capHeight: .698, missingGlyphs: [], lines: [
      { text: "H", start: 0, end: 1, x: 11, top: 0, baseline: 21, width: 14, glyphs: [glyph(11, 21, 0)] },
      { text: "", start: 2, end: 2, x: 0, top: 28, baseline: 49, width: 0, glyphs: [] },
      { text: "H", start: 3, end: 4, x: 5, top: 56, baseline: 77, width: 14, glyphs: [glyph(5, 77, 3)] },
    ] },
  };
  const scene: ScenePage = { pageId: page.id, width: 1920, height: 1080, background: "#ffffff", components: [], items: [
    { kind: "shape", pageId: page.id, tag: "rect", elementId: "panel", attributes: { x: 4, y: 6, width: 10, height: 20, fill: "#000000" }, transform: [2, 0, 0, 3, 7, 11] },
    item,
  ] };
  const before = structuredClone(scene), report = inspectPage(page, scene, fonts), [shape, text] = report.items;
  assert.deepEqual(scene, before);
  assert.deepEqual(inspectPage(page, scene, fonts), report);
  assert.equal(shape.kind, "shape"); assert.deepEqual(shape.bounds, { x: 15, y: 29, width: 20, height: 60 });
  assert.ok(text.kind === "text");
  assert.deepEqual(report.items.map(item => item.paintIndex), [0, 1]);
  assert.deepEqual(text.lines.map(line => line.box), [
    { x: 112, y: 203, width: 14, height: 28 }, { x: 101, y: 231, width: 0, height: 28 }, { x: 106, y: 259, width: 14, height: 28 },
  ]);
  assert.deepEqual(text.lines.map(line => line.baseline), [224, 252, 280]);
  assert.deepEqual(text.lines.map(line => [line.text, line.start, line.end]), [["H", 0, 1], ["", 2, 2], ["H", 3, 4]]);
  // Bundled Plex H: glyph 36, bounds [93, 698, 521, -698] at 1000 units/em.
  const ink = text.lines[0].inkBounds!;
  near(ink.x, 113.86); near(ink.y, 210.04); near(ink.width, 10.42); near(ink.height, 13.96);
  near(text.inkBounds!.height, 69.96);
  assert.equal(text.lines[1].inkBounds, null);
  assert.deepEqual(text.lines.map(line => line.fontIds), [[fontId], [], [fontId]]);
  assert.deepEqual(text.clip, { x: 100, y: 200, width: 70, height: 60 });
  assert.ok(text.lines[2].baseline > text.clip!.y + text.clip!.height, "clipped lines stay inspectable");
  assert.doesNotMatch(JSON.stringify(report), /"glyphs"|"glyphId"|"transform"|"attributes"/);
});

test("inspection preserves fitted label anchors, element IDs and interleaved paint order", () => {
  const document = toComposition(addComponent(initialGridDraft(), "image"));
  const page = document.pages[0], component = page.components[0];
  page.grid = { preset: "presentation" };
  component.area = { column: 2, span: 2, row: 4, rows: 10 };
  component.customVisual = { format: "vector", description: "Asymmetric fit", viewBox: { x: 10, y: 20, width: 200, height: 80 }, elements: [
    { id: "panel", kind: "rect", attributes: { x: 10, y: 20, width: 200, height: 80, fill: "theme:accent" } },
    { id: "label", kind: "text", text: "office", attributes: { x: 110, y: 60, "text-anchor": "end", "font-size": "scale:caption" } },
    { id: "dot", kind: "circle", attributes: { cx: 100, cy: 50, r: 8, fill: "theme:ink" } },
  ] };
  const report = inspectPage(page, lowerPage(document, page, fonts), fonts);
  assert.deepEqual(report.items.map(item => item.elementId), ["panel", "label", "dot"]);
  assert.ok(report.items.every(item => item.componentId === component.id && item.pageId === page.id));
  assert.deepEqual(report.components[0].artworkScale, [1.38, 1.38]);
  assert.deepEqual(report.components[0].box, { x: 222, y: 108, width: 276, height: 120 });
  const label = report.items[1]; assert.ok(label.kind === "text");
  assert.equal(label.fontSize, 24);
  near(label.lines[0].box.x + label.lines[0].box.width, 360);
  near(label.lines[0].baseline, 168);
  assert.deepEqual(label.clip, { x: 222, y: 108, width: 276, height: 120 });
});

test("inspection uses settled group geometry and reports authored pixel rectangles", () => {
  const document = assertComposition(JSON.parse(readFileSync(new URL("./fixtures/github-cover/composition.json", import.meta.url), "utf8")));
  const page = document.pages[0], original = structuredClone(document);
  const report = inspectPage(page, lowerPage(document, page, fonts), fonts);
  const group = report.groups.find(group => group.id === "brand-stack")!;
  near(group.bounds!.y + group.bounds!.height / 2, 315);
  assert.equal(report.preset, "link");
  for (const component of report.components.filter(item => group.childIds.includes(item.id))) {
    assert.ok("rect" in component);
    assert.equal(component.box.x, 48);
    assert.notEqual(component.box.y, component.rect.y, "use settled scene geometry, not only authored rectangles");
  }
  assert.deepEqual(document, original);
  const visual = page.components.find(component => component.id === "visual-family")!;
  assert.ok(visual.rect);
  visual.rect = { x: 611.5, y: 71.25, width: 540.5, height: 487.75 };
  const result = inspectPage(page, lowerPage(document, page, fonts), fonts).components.find(item => item.id === visual.id)!;
  assert.ok("rect" in result);
  assert.deepEqual(result.rect, visual.rect);
  assert.deepEqual(result.box, visual.rect);
});

test("native multicolumn regions remain distinct and include exact breaks and fallback fonts", () => {
  const document = toComposition(addComponent(initialGridDraft(), "text-block"));
  const page = document.pages[0], component = page.components[0];
  page.grid = { preset: "presentation" };
  assert.ok(component.kind === "text-block");
  component.area = { column: 2, span: 6, row: 4, rows: 20 }; component.padding = 2;
  component.appearance.layout = "two-column"; component.appearance.alignment = "start";
  component.content = "First\nline\n\nNext →"; component.textStyle = { step: "heading" };
  const report = inspectPage(page, lowerPage(document, page, fonts), fonts);
  const texts = report.items.filter(item => item.kind === "text");
  assert.equal(texts.length, 2);
  assert.deepEqual(texts.map(item => item.box), [
    { x: 246, y: 132, width: 402, height: 192 }, { x: 672, y: 132, width: 402, height: 192 },
  ]);
  assert.deepEqual(texts.map(item => item.lines.map(line => line.text)), [["First", "line"], ["Next →"]]);
  assert.ok(texts[1].lines[0].fontIds.includes("ibm-plex-sans-latin-400-normal"));
  assert.ok(texts[1].lines[0].fontIds.some(id => id.includes("symbols")), "report the font actually used for the arrow");
  const summary = summarizePage(page, lowerPage(document, page, fonts));
  assert.ok("textLines" in summary.components[0]);
  assert.deepEqual(summary.components[0].textLines, [["First", "line"], ["Next →"]], "keep the regions' line breaks distinct");
});
