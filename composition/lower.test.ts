import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { loadNodeFontContext } from "./fonts.ts";
import { lowerPage } from "./lower.ts";
import { renderSVG } from "./svg.ts";
import { assertComposition } from "./validate.ts";
import { addComponent, initialGridDraft } from "./document.ts";
import { areaRect, toComposition } from "./grid.ts";
import { itemBounds, textInkBounds, type SceneShape } from "./scene.ts";
import { checkPage } from "./check.ts";

// These independently measured fit/baseline fixtures use the original grid.
function legacyGridDraft() {
  const draft = initialGridDraft();
  draft.slides[0].grid = { preset: "presentation" };
  return draft;
}

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
      // Centering spare grid height intentionally moves these preset origins.
      const originShift = { architecture: 4, sankey: 4, release: 3, explainer: 2, intro: 0 }[name]!;
      assert.ok(Math.abs(item.box.y + item.layout.lines[0].baseline - label.baseline - originShift) <= 0.5, `${label.id}: preserve baseline relative to the centered grid within 0.5px`);
    }
  });
}

test("artwork fits once; labels keep unscaled steps, anchors, IDs and paint order", () => {
  const document = toComposition(addComponent(legacyGridDraft(), "image"));
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

test("artwork alignment uses the padded cell, keeps labels attached, and preserves default centering", () => {
  const document = toComposition(addComponent(legacyGridDraft(), "image"));
  const page = document.slides[0], component = page.components[0];
  component.area = { column: 2, span: 2, row: 4, rows: 10 }; component.padding = 1;
  // Padded cell [234,120,252,96]. Contain leaves 204px spare width; cover
  // crops 228px; stretch has no spare width. Nonzero view origins matter.
  for (const config of [
    { fit: "contain", width: 80, height: 160, sx: .6, sy: .6, dy: 108, offsets: [330, 228, 330, 432] },
    { fit: "cover", width: 200, height: 40, sx: 2.4, sy: 2.4, dy: 72, offsets: [96, 210, 96, -18] },
    { fit: "stretch", width: 80, height: 160, sx: 3.15, sy: .6, dy: 108, offsets: [202.5, 202.5, 202.5, 202.5] },
  ] as const) for (const [i, alignment] of ([undefined, "start", "center", "end"] as const).entries()) {
    component.customVisual = { format: "vector", fit: config.fit, alignment, description: "Aligned artwork with label",
      viewBox: { x: 10, y: 20, width: config.width, height: config.height }, elements: [
        { id: "panel", kind: "rect", attributes: { x: 10, y: 20, width: config.width, height: config.height, fill: "theme:wash" } },
        { id: "label", kind: "text", text: "X", attributes: { x: 50, y: 40, "text-anchor": "middle", "font-size": "scale:caption" } },
      ] };
    assertComposition(document);
    const [shape, label] = lowerPage(document, page, fonts).items;
    assert.ok(shape.kind === "shape" && label.kind === "text");
    [config.sx, 0, 0, config.sy, config.offsets[i], config.dy].forEach((expected, index) => assert.ok(Math.abs(shape.transform[index] - expected) < 1e-9));
    assert.deepEqual(shape.clip, { x: 234, y: 120, width: 252, height: 96 });
    assert.deepEqual(label.clip, shape.clip);
    assert.equal(label.fontSize, 24);
    assert.ok(Math.abs(label.box.x + label.layout.lines[0].width / 2 - (config.offsets[i] + 50 * config.sx)) < 1e-9);
    assert.ok(Math.abs(label.box.y + label.layout.lines[0].baseline - (config.dy + 40 * config.sy)) < 1e-9);
  }
});

test("nested vertical regions keep pixel gutters and put sparse content first", () => {
  const document = toComposition(addComponent(legacyGridDraft(), "text-block"));
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
  const document = toComposition(addComponent(legacyGridDraft(), "text-block"));
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

test("explicit vertical alignment overrides roles; cap centering ignores descenders and leading", () => {
  const document = toComposition(addComponent(legacyGridDraft(), "text-block"));
  const page = document.slides[0], component = page.components[0];
  assert.ok(component.kind === "text-block");
  component.area = { column: 2, span: 6, row: 4, rows: 20 };
  component.padding = 2;
  component.textStyle = { step: "heading" };
  component.appearance.role = "title";
  for (const copy of ["H", "Hp", "H\nHp"]) for (const leading of [undefined, 6]) {
    component.content = copy;
    component.textStyle.leading = leading;
    component.appearance.verticalAlignment = "center";
    const item = lowerPage(document, page, fonts).items.find(item => item.kind === "text");
    assert.ok(item?.kind === "text" && item.clip);
    const first = item.box.y + item.layout.lines[0].baseline;
    const last = item.box.y + item.layout.lines.at(-1)!.baseline;
    // IBM Plex Sans cap height is 698/1000 em; the padded region is [132,324].
    assert.ok(Math.abs((first - 44 * 0.698 + last) / 2 - 228) < 1e-9);
    assert.deepEqual(checkPage(lowerPage(document, page, fonts), fonts), []);
    if (copy === "Hp") assert.ok(textInkBounds(item, fonts)!.y + textInkBounds(item, fonts)!.height > last, "descender extends below the centered cap-to-baseline span");
  }
  component.appearance.verticalAlignment = "start";
  assert.equal(lowerPage(document, page, fonts).items.find(item => item.kind === "text")!.box.y, 132);
  component.content = "H\nH\nH\nH\nH";
  component.appearance.verticalAlignment = "center";
  assert.ok(checkPage(lowerPage(document, page, fonts), fonts).some(issue => issue.code === "native-overflow"));
});

test("group centering translates ink and selection cells together and responds to changed copy", () => {
  const document = toComposition(addComponent(addComponent(legacyGridDraft(), "image"), "text-block"));
  const page = document.slides[0], [mark, copy] = page.components;
  assert.ok(copy.kind === "text-block");
  mark.area = { column: 1, span: 1, row: 3, rows: 10 };
  mark.customVisual = { format: "vector", description: "Asymmetric mark", viewBox: { x: 0, y: 0, width: 126, height: 120 }, elements: [
    { id: "mark", kind: "path", attributes: { d: "M0 20H126V50H0Z", fill: "theme:accent" } },
  ] };
  copy.area = { column: 1, span: 3, row: 20, rows: 10 };
  copy.content = "H"; copy.textStyle = { step: "body" };
  const ungrouped = lowerPage(document, page, fonts);
  page.groups = [{ id: "stack", childIds: [mark.id, copy.id], area: { column: 1, span: 3, row: "center", rows: 40 }, verticalAlignment: "center" }];
  for (const extraLine of [false, true]) {
    copy.content = extraLine ? "H\nH" : "H";
    const original = structuredClone(document), scene = lowerPage(document, page, fonts);
    assert.deepEqual(document, original);
    const offset = extraLine ? 296.75 : 316.75; // [116,330.5] ink, centered at page y540; extra line adds40px.
    scene.components.forEach((component, i) => {
      assert.ok(Math.abs(component.box.y - ungrouped.components[i].box.y - offset) < 1e-9);
      assert.equal(component.box.height, ungrouped.components[i].box.height);
    });
    const bounds = scene.items.map(item => itemBounds(item, fonts)!);
    assert.ok(Math.abs((Math.min(...bounds.map(b => b.y)) + Math.max(...bounds.map(b => b.y + b.height))) / 2 - 540) < 1e-9);
    assert.deepEqual(scene.items.map(item => [item.componentId, item.elementId]), ungrouped.items.map(item => [item.componentId, item.elementId]));
    assert.deepEqual(checkPage(scene, fonts), []);
  }
  for (const alignment of ["start", "end"] as const) {
    page.groups[0].verticalAlignment = alignment;
    const scene = lowerPage(document, page, fonts), bounds = scene.groups![0].bounds;
    assert.equal(alignment === "start" ? bounds.y : bounds.y + bounds.height, alignment === "start" ? 300 : 780);
    assert.deepEqual(checkPage(scene, fonts), []);
  }
  page.groups[0].area!.rows = 2;
  assert.equal(checkPage(lowerPage(document, page, fonts), fonts).find(issue => issue.code === "group-overflow")?.groupId, "stack");
});

test("group shape bounds follow curve extrema and fit, and ignore invisible geometry", () => {
  const shape = (tag: SceneShape["tag"], attributes: SceneShape["attributes"]): SceneShape => ({
    kind: "shape", pageId: "bounds", tag, attributes, transform: [2, 0, 0, 3, 7, 11],
  });
  assert.deepEqual(itemBounds(shape("path", { d: "M0 0Q100 200 200 0Z", fill: "#000" }), fonts), { x: 7, y: 11, width: 400, height: 300 });
  assert.deepEqual(itemBounds(shape("circle", { cx: 10, cy: 20, r: 5, fill: "#000" }), fonts), { x: 17, y: 56, width: 20, height: 30 });
  assert.deepEqual(itemBounds(shape("polygon", { points: "0,0 10-20 30,5", fill: "#000" }), fonts), { x: 7, y: -49, width: 60, height: 75 });
  const line = shape("line", { x1: 4, y1: 6, x2: 10, y2: 20, stroke: "#000", "stroke-width": 4, "vector-effect": "non-scaling-stroke" });
  assert.deepEqual(itemBounds(line, fonts), { x: 13, y: 27, width: 16, height: 46 });
  assert.equal(itemBounds(shape("line", { x1: 4, y1: 6, x2: 10, y2: 20, fill: "#000" }), fonts), undefined);
  assert.equal(itemBounds(shape("circle", { cx: 10, cy: 20, r: 5, fill: "#000", "fill-opacity": 0 }), fonts), undefined);
});

test("cover stack stays left-aligned and vertically centered when the audience gains a line", () => {
  const document = assertComposition(JSON.parse(readFileSync(new URL("../slides/github-cover/composition.json", import.meta.url), "utf8")));
  const page = document.slides[0], group = page.groups.find(group => group.id === "brand-stack")!;
  for (const changed of [false, true]) {
    const audience = page.components.find(item => item.id === "audience")!;
    if (changed && audience.kind === "text-block") { audience.content += "\nAnd your team."; audience.area.rows += 4; }
    const scene = lowerPage(document, page, fonts);
    const mark = scene.items.find(item => item.elementId === "mark-silhouette")!;
    assert.ok(mark.kind === "shape");
    assert.equal(mark.transform[4], 48, "mark viewBox starts at the left grid margin");
    for (const item of scene.items.filter(item => item.kind === "text" && group.childIds.includes(item.componentId ?? ""))) {
      assert.ok(item.kind === "text");
      assert.equal(item.box.x, 48);
      assert.ok(item.layout.lines.every(line => line.x === 0), "every text line starts at the same column edge");
    }
    const bounds = scene.items.filter(item => group.childIds.includes(item.componentId ?? "")).map(item => itemBounds(item, fonts)!);
    assert.ok(Math.abs((Math.min(...bounds.map(b => b.y)) + Math.max(...bounds.map(b => b.y + b.height))) / 2 - 315) < 1e-9);
    assert.deepEqual(checkPage(scene, fonts), []);
  }
});

test("held group offsets move shapes, text, clips and hit boxes together without changing the document", () => {
  const document = assertComposition(JSON.parse(readFileSync(new URL("../slides/github-cover/composition.json", import.meta.url), "utf8")));
  const page = document.slides[0], before = lowerPage(document, page, fonts);
  const offsets = new Map([["brand-stack", before.components[0].box.y - areaRect(page.grid, page.components[0].area).y]]);
  for (const [id, delta] of [["brand-mark", -24], ["audience", 48]] as const) {
    const edited = structuredClone(document), next = edited.slides[0], member = next.components.find(item => item.id === id)!;
    assert.ok(typeof member.area.row === "number"); member.area.row += delta / 8;
    const source = structuredClone(edited), held = lowerPage(edited, next, fonts, offsets);
    assert.deepEqual(edited, source);
    for (const [index, item] of held.items.entries()) {
      const original = before.items[index], shift = item.componentId === id ? delta : 0;
      assert.ok(item.clip && original.clip);
      assert.equal(item.clip.y, original.clip.y + shift, `${id}: clip tracks artwork`);
      if (item.kind === "text" && original.kind === "text") assert.equal(item.box.y, original.box.y + shift);
      else if (item.kind === "shape" && original.kind === "shape") assert.equal(item.transform[5], original.transform[5] + shift);
    }
    held.components.forEach((item, i) => assert.equal(item.box.y, before.components[i].box.y + (item.id === id ? delta : 0)));
    const settled = lowerPage(edited, next, fonts);
    settled.components.forEach((item, i) => {
      const shift = item.id === "visual-family" ? 0 : (item.id === id ? delta : 0) - delta / 2;
      assert.ok(Math.abs(item.box.y - before.components[i].box.y - shift) < 1e-9);
    });
  }
  const zero = lowerPage(document, page, fonts, new Map([["brand-stack", 0]]));
  const ungrouped = lowerPage(document, { ...page, groups: [] }, fonts);
  assert.deepEqual(zero.items, ungrouped.items, "zero is a valid held offset, not a request to recenter");
  assert.deepEqual(zero.components, ungrouped.components);
});
