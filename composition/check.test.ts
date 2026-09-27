import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadNodeFontContext } from "./fonts.ts";
import { layoutText } from "./text-layout.ts";
import type { ScenePage, SceneText } from "./scene.ts";
import { checkPage } from "./check.ts";
import { checkPageNode } from "./check-node.ts";
import { lowerPage } from "./lower.ts";
import { assertComposition } from "./validate.ts";

const fonts = await loadNodeFontContext(new URL("../fonts/", import.meta.url));
const text = (source: string, overrides: Partial<SceneText> = {}): SceneText => ({
  kind: "text", pageId: "p", componentId: "chart", elementId: "named-label", source,
  box: { x: 4, y: 4, width: 90, height: 30 }, layout: layoutText(fonts, { text: source, width: 90,
    fontFamily: "IBM Plex Sans", fontSize: 14, lineHeight: 18, wrap: "no-wrap" }), fontSize: 14,
  lineHeight: 18, fontWeight: 400, color: "#333333", opacity: 1, label: true,
  clip: { x: 4, y: 4, width: 90, height: 30 }, ...overrides,
});
const scene = (items: ScenePage["items"]): ScenePage => ({ pageId: "p", width: 100, height: 40,
  background: "#ffffff", items, components: [] });

test("uses glyph extents for small, named label overflow and reports missing glyphs", () => {
  const clipped = text("ink", { clip: { x: 5, y: 5, width: 2, height: 2 } });
  const missing = text("\u{10ffff}");
  const diagnostics = checkPage(scene([clipped, missing]), fonts);
  assert.equal(diagnostics.find(value => value.code === "clipped-label")?.elementId, "named-label");
  assert.deepEqual(diagnostics.find(value => value.code === "missing-glyph")?.evidence.codePoints, ["U+10FFFF"]);
});

test("contrast follows painter order, alpha stacks, and cross-component paint", () => {
  const shape = (fill: string, opacity: number, componentId: string) => ({ kind: "shape" as const, pageId: "p", componentId,
    tag: "rect" as const, attributes: { x: 0, y: 0, width: 100, height: 40, fill, opacity, "fill-opacity": .5 },
    transform: [1, 0, 0, 1, 0, 0] as [number, number, number, number, number, number] });
  const diagnostic = checkPageNode(scene([shape("#000000", 1, "under-a"), shape("#ffffff", .2, "under-b"), text("dark ink")]), fonts)
    .find(value => value.code === "text-contrast");
  assert.ok(diagnostic, "dark 400 label on the actual translucent painter stack fails");
  assert.equal(diagnostic.elementId, "named-label");
  assert.match(String(diagnostic.evidence.method), /paint-order prefix/);
});

test("scaled chart is review-only and makes no caption claim", () => {
  const diagnostics = checkPage({ ...scene([]), components: [{ id: "sankey", box: { x: 0, y: 0, width: 1, height: 1 },
    contentBox: { x: 0, y: 0, width: 1, height: 1 }, draft: false, chart: true, artworkScale: [.8, .8] }] }, fonts);
  const warning = diagnostics.find(value => value.code === "chart-scale")!;
  assert.equal(warning.severity, "warning");
  assert.doesNotMatch(warning.message, /caption/i);
});

test("reproduces the port's fixed-row overflow, scaled Sankey, and dark 400 contrast", () => {
  const document = assertComposition(JSON.parse(readFileSync(new URL("../slides/gallery/sankey.json", import.meta.url), "utf8")));
  const page = document.slides[0];
  const chart = page.components.find(component => component.id === "chart")!;
  chart.customVisual!.elements.find(element => element.id === "flow-value-2")!.attributes.fill = "theme:ink";
  page.components.find(component => component.id === "title")!.area.rows = 1;
  const diagnostics = checkPageNode(lowerPage(document, page, fonts), fonts);
  assert.ok(diagnostics.some(item => item.code === "native-overflow" && item.componentId === "title"));
  assert.ok(diagnostics.some(item => item.code === "chart-scale" && item.componentId === "chart" && item.severity === "warning"));
  const contrast = diagnostics.find(item => item.code === "text-contrast" && item.elementId === "flow-value-2")!;
  assert.ok(contrast);
  assert.equal(contrast.evidence.source, "400");
  // WCAG luminance of current Plex ink #20242A on accent #2458B8.
  // Independently computed from those colors, rather than the review's 2.37.
  assert.ok(Math.abs(Number(contrast.evidence.minimumRatio) - 2.347865) < .000001);
});
