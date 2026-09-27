import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { loadNodeFontContext } from "./fonts.ts";
import { lowerPage } from "./lower.ts";
import { renderSVG } from "./svg.ts";
import { assertComposition } from "./validate.ts";
import { addComponent, initialGridDraft } from "./document.ts";
import { toComposition } from "./grid.ts";

const fonts = await loadNodeFontContext(new URL("../fonts/", import.meta.url));
const baseline = JSON.parse(readFileSync(new URL("./fixtures/text-layout-browser-baseline.json", import.meta.url), "utf8"));
for (const name of ["architecture", "sankey", "release", "explainer", "intro"]) {
  const path = name === "intro" ? "../slides/introducing-konpeki/composition.json" : `../slides/gallery/${name}.json`;
  const document = assertComposition(JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")));
  for (const page of document.slides) test(`${name}/${page.id}: deterministic scene snapshot`, t => {
    const before = structuredClone(document), scene = lowerPage(document, page, fonts);
    assert.deepEqual(document, before, "lowering cannot mutate authored data");
    assert.deepEqual(lowerPage(structuredClone(document), structuredClone(page), fonts), scene);
    // Keep positions and line breaks readable; the digest covers every glyph,
    // shape, transform, clip and target ID without storing megabytes of paths.
    t.assert.snapshot({
      digest: createHash("sha256").update(JSON.stringify(scene)).digest("hex"),
      size: [scene.width, scene.height],
      text: scene.items.filter(item => item.kind === "text").map(item => ({
        componentId: item.componentId, elementId: item.elementId, box: item.box,
        lines: item.layout.lines.map(line => ({ text: line.text, x: line.x, baseline: line.baseline, width: line.width })),
      })),
    });
    assert.doesNotMatch(renderSVG(scene, fonts), /<text\b|NaN|undefined|cqw|cqh/);
    const previous = baseline.pages.find((item: { document: string; slideId: string }) => item.document === name && item.slideId === page.id);
    // Replay captured copy independently of later product-copy revisions. Scene
    // snapshots above cover the current copy, not this historical comparison.
    const capturedPage = structuredClone(page);
    for (const block of previous.texts) {
      const component = capturedPage.components.find(item => item.id === block.id);
      if (component?.kind === "text-block") component.content = block.text;
    }
    for (const label of previous.labels) for (const component of capturedPage.components) {
      const element = component.customVisual?.elements.find(item => item.id === label.id);
      if (element) element.text = label.text;
    }
    const capturedScene = lowerPage(document, capturedPage, fonts);
    for (const block of previous.texts) {
      const item = capturedScene.items.find(item => item.kind === "text" && !item.label && item.componentId === block.id);
      assert.ok(item?.kind === "text");
      assert.deepEqual(item.layout.lines.map(line => line.text), block.lines.map((line: { text: string }) => line.text), `${block.id}: preserve captured Chromium line breaks`);
    }
    for (const label of previous.labels) {
      const item = capturedScene.items.find(item => item.kind === "text" && item.label && item.elementId === label.id && item.source === label.text);
      assert.ok(item?.kind === "text");
      assert.ok(Math.abs(item.box.y + item.layout.lines[0].baseline - label.baseline) <= 0.5, `${label.id}: preserve captured SVG baseline within 0.5px`);
    }
  });
}

test("artwork fits once; labels keep unscaled steps, anchors, IDs and paint order", () => {
  const document = toComposition(addComponent(initialGridDraft(), "image"));
  const page = document.slides[0], component = page.components[0];
  component.area = { column: 2, span: 2, row: 4, rows: 10 };
  component.customVisual = { format: "vector", description: "Asymmetric anchor fixture", viewBox: { x: 10, y: 20, width: 200, height: 80 }, elements: [
    { id: "first", kind: "rect", attributes: { x: 10, y: 20, width: 200, height: 80, fill: "theme:accent" } },
    { id: "label", kind: "text", text: "office", attributes: { x: 110, y: 60, "text-anchor": "end", "font-size": "scale:caption" } },
    { id: "last", kind: "circle", attributes: { cx: 100, cy: 50, r: 8, fill: "theme:ink" } },
  ] };
  const scene = lowerPage(document, page, fonts);
  assert.deepEqual(scene.items.map(item => item.elementId), ["first", "label", "last"]);
  const [shape, label] = scene.items;
  assert.equal(shape.kind, "shape"); assert.equal(label.kind, "text");
  if (shape.kind !== "shape" || label.kind !== "text") return;
  // Cell is [222,108,276,120]. Contain scale is 1.38, with 4.8px vertical centering.
  [1.38, 0, 0, 1.38, 208.2, 85.2].forEach((value, index) => assert.ok(Math.abs(shape.transform[index] - value) < 1e-9));
  assert.equal(label.fontSize, 24);
  assert.ok(Math.abs(label.box.x + label.layout.lines[0].width - 360) < 1e-9);
  assert.ok(Math.abs(label.box.y + label.layout.lines[0].baseline - 168) < 1e-9);
});

test("nested vertical regions keep pixel gutters and put sparse content first", () => {
  const document = toComposition(addComponent(initialGridDraft(), "text-block"));
  const page = document.slides[0], component = page.components[0];
  assert.ok(component.kind === "text-block");
  component.area = { column: 2, span: 6, row: 4, rows: 40 };
  component.appearance.layout = "one-plus-three";
  component.appearance.orientation = "vertical";
  component.content = "First\n\nSecond";
  const items = lowerPage(document, page, fonts).items.filter(item => item.kind === "text");
  assert.deepEqual(items.map(item => item.source), ["First", "Second", "", ""]);
  // Area [222,108,876,480]: first row228px, gap24; three bottom cells276px.
  assert.deepEqual(items.map(item => item.box), [
    { x: 222, y: 108, width: 876, height: 228 },
    { x: 222, y: 360, width: 276, height: 228 },
    { x: 522, y: 360, width: 276, height: 228 },
    { x: 822, y: 360, width: 276, height: 228 },
  ]);
});

test("titles bottom-align multiline copy inside padding; body copy stays at the top", () => {
  const document = toComposition(addComponent(initialGridDraft(), "text-block"));
  const page = document.slides[0], component = page.components[0];
  assert.ok(component.kind === "text-block");
  component.area = { column: 2, span: 6, row: 4, rows: 20 };
  component.padding = 2;
  component.content = "First line\nSecond line";
  component.textStyle = { step: "heading" };
  const region = { x: 246, y: 132, width: 828, height: 192 };
  for (const role of ["title", "body"] as const) {
    component.appearance.role = role;
    const item = lowerPage(document, page, fonts).items.find(item => item.kind === "text");
    assert.ok(item?.kind === "text");
    assert.deepEqual(item.clip, region);
    assert.equal(item.layout.lines.length, 2);
    // Two 52px lines use 104px of a 192px padded region, leaving 88px above a title.
    assert.deepEqual(item.box, role === "title" ? { ...region, y: 220, height: 104 } : region);
  }
});

test("restores the reviewed title offsets without moving subtitles", () => {
  for (const [name, id, offset] of [["sankey", "title", 44], ["explainer", "headline", 44], ["architecture", "headline", 20]] as const) {
    const document = assertComposition(JSON.parse(readFileSync(new URL(`../slides/gallery/${name}.json`, import.meta.url), "utf8")));
    const scene = lowerPage(document, document.slides[0], fonts);
    const title = scene.items.find(item => item.kind === "text" && item.componentId === id);
    assert.ok(title?.kind === "text" && title.clip);
    assert.equal(title.box.y - title.clip.y, offset, name);
    for (const component of document.slides[0].components.filter(item => item.kind === "text-block" && item.appearance.role === "subtitle")) {
      const subtitle = scene.items.find(item => item.kind === "text" && item.componentId === component.id);
      assert.ok(subtitle?.kind === "text" && subtitle.clip);
      assert.equal(subtitle.box.y, subtitle.clip.y);
    }
  }
});
