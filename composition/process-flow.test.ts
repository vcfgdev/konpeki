import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadNodeFontContext } from "./fonts.ts";
import { lowerPage } from "./lower.ts";
import { checkPageNode } from "./check-node.ts";
import { validateComposition, assertComposition } from "./validate.ts";
import { resolveDocument, toComposition, type GridDocument, type GridComponent } from "./grid.ts";
import { inspectPage, summarizePage } from "./inspect.ts";
import { transformComponentRect } from "./document.ts";
import { renderSVG } from "./svg.ts";

const fonts = await loadNodeFontContext(new URL("../fonts/", import.meta.url));
function fixture(direction: "right" | "down" = "right") {
  const document: GridDocument = JSON.parse(readFileSync(new URL("../skills/konpeki/assets/blank.json", import.meta.url), "utf8"));
  const page = document.pages[0];
  page.contentSlots = ["Receive request", "Capacity available?", "Reserve stock", "Notify customer"].map((label, i) => ({
    id: `s${i}`, label, role: "process-step", required: true, instruction: "Illustrative order handling",
  }));
  const flow: Extract<GridComponent, { kind: "diagram" }> = {
    id: "flow", kind: "diagram", rect: { x: 72, y: 72, width: 1776, height: 936 },
    appearance: { type: "process" }, slotIds: page.contentSlots.map(slot => slot.id), processFlow: { direction },
    topology: { kind: "explicit", nodes: page.contentSlots.map((slot, i) => ({ id: `n${i}`, slotId: slot.id })),
      edges: [{ id: "receive", from: "n0", to: "n1" }, { id: "reserve", from: "n1", to: "n2", label: "Yes" }, { id: "notify", from: "n1", to: "n3", label: "No" }] },
  };
  page.components = [flow]; page.paintOrder = [flow.id]; page.readingOrder = [{ kind: "component", id: flow.id }];
  return { document, page, flow };
}
const route = (scene: ReturnType<typeof lowerPage>, id: string) => scene.items.find(item => item.kind === "shape" && item.tag === "polyline" && item.elementId === id);

test("a single step and a linear chain need no branch labels", () => {
  const { document, page, flow } = fixture();
  flow.topology!.edges = [
    { id: "a", from: "n0", to: "n1" }, { id: "b", from: "n1", to: "n2" }, { id: "c", from: "n2", to: "n3" },
  ];
  assertComposition(document);
  let scene = lowerPage(document, page, fonts);
  assert.deepEqual(checkPageNode(scene, fonts), []);
  const nodes = scene.components[0].processNodes!;
  assert.ok(nodes.every(node => node.box.y + node.box.height / 2 === 540));
  flow.topology!.nodes = flow.topology!.nodes.slice(0, 1); flow.topology!.edges = [];
  flow.slotIds = ["s0"]; page.contentSlots = page.contentSlots.slice(0, 1);
  assertComposition(document);
  scene = lowerPage(document, page, fonts);
  assert.deepEqual(scene.components[0].processNodes![0].box, { x: 840, y: 506, width: 240, height: 68 });
  assert.deepEqual(checkPageNode(scene, fonts), []);
});

test("process flow is opt-in, preserves legacy drafts and custom artwork", () => {
  const { document, page, flow } = fixture();
  assertComposition(document);
  const semantic = lowerPage(document, page, fonts);
  assert.deepEqual(checkPageNode(semantic, fonts), []);
  assert.equal(semantic.components[0].draft, false);
  delete flow.processFlow;
  assert.equal(lowerPage(document, page, fonts).components[0].draft, true);
  flow.customVisual = { format: "vector", description: "Existing drawing", viewBox: { x: 0, y: 0, width: 100, height: 100 },
    elements: [{ id: "existing-shape", kind: "circle", attributes: { cx: 50, cy: 50, r: 20, fill: "theme:accent" } }] };
  const old = lowerPage(document, page, fonts);
  assert.equal(old.items.length, 1);
  assert.equal(old.items[0].elementId, "existing-shape");
  assert.equal(old.components[0].processNodes, undefined);
});

test("both flow directions derive every labelled connection from stable node IDs", () => {
  for (const direction of ["right", "down"] as const) {
    const { document, page, flow } = fixture(direction);
    const scene = lowerPage(document, page, fonts), nodes = scene.components[0].processNodes!;
    assert.deepEqual(checkPageNode(scene, fonts), []);
    assert.deepEqual(scene.items.filter(item => item.kind === "text").map(item => item.source).sort(),
      ["Yes", "No", "Receive request", "Capacity available?", "Reserve stock", "Notify customer"].sort());
    for (const edge of flow.topology!.edges) {
      const line = route(scene, edge.id!);
      assert.ok(line?.kind === "shape");
      const points = String(line.attributes.points).split(" ").map(point => point.split(",").map(Number));
      const a = nodes.find(node => node.id === edge.from)!.box, b = nodes.find(node => node.id === edge.to)!.box;
      assert.deepEqual(points[0], direction === "right" ? [a.x + a.width, a.y + a.height / 2] : [a.x + a.width / 2, a.y + a.height]);
      assert.deepEqual(points.at(-1), direction === "right" ? [b.x, b.y + b.height / 2] : [b.x + b.width / 2, b.y]);
      assert.ok(points.slice(1).every((p, i) => p[0] === points[i][0] || p[1] === points[i][1]), "orthogonal segments only");
    }
    const before = new Map(nodes.map(node => [node.id, node.box]));
    flow.topology!.nodes.reverse();
    for (const node of lowerPage(document, page, fonts).components[0].processNodes!) assert.deepEqual(node.box, before.get(node.id), "node array order is not flow order");
    assert.match(renderSVG(scene, fonts), /data-vector-element="reserve"/);
    assert.deepEqual(inspectPage(page, scene, fonts).components[0].processNodes, nodes);
    assert.equal(summarizePage(page, scene).components[0].processNodes?.length, 4);
  }
});

test("longer copy and inserting a step preserve pinned placement, IDs and wire round trips", () => {
  const { document, page, flow } = fixture();
  flow.topology!.nodes[2].position = { x: 1260, y: 190 };
  const before = lowerPage(document, page, fonts);
  page.contentSlots[2].label = "Reserve the requested stock before confirming the order";
  page.contentSlots.push({ id: "audit-slot", label: "Record decision", role: "process-step", required: true, instruction: "Audit event" });
  flow.slotIds.push("audit-slot");
  flow.topology!.nodes.push({ id: "audit", slotId: "audit-slot" });
  flow.topology!.edges[0].to = "audit";
  flow.topology!.edges.push({ id: "audit-check", from: "audit", to: "n1" });
  assertComposition(document);
  const after = lowerPage(document, page, fonts), pinned = after.components[0].processNodes!.find(node => node.id === "n2")!;
  assert.equal(pinned.box.x, 1332); assert.equal(pinned.box.y, 262);
  assert.ok(pinned.box.height > before.components[0].processNodes!.find(node => node.id === "n2")!.box.height);
  assert.notDeepEqual(route(after, "reserve"), route(before, "reserve"));
  const resolved = resolveDocument(document);
  const saved = toComposition(resolved);
  assert.equal("preferredRect" in saved.pages[0].components[0], false, "derived geometry never enters saved JSON");
  assert.deepEqual(saved.pages[0].components[0].rect, flow.rect);
  const component = resolved.pages[0].components[0];
  const moved = transformComponentRect(component, component.preferredRect, { ...component.preferredRect, y: component.preferredRect.y + 12, height: component.preferredRect.height - 12 }, page.canvas);
  assert.ok(moved.kind === "diagram");
  assert.deepEqual(moved.topology!.nodes.find(node => node.id === "n2")!.position, { x: 1260, y: 190 });
  delete flow.topology!.nodes[2].position;
  assert.equal(lowerPage(document, page, fonts).components[0].processNodes!.find(node => node.id === "n2")!.pinned, false);
});

test("crowding and unsafe overrides report errors without shrinking or omitting content", () => {
  const { document, page, flow } = fixture();
  assert.ok(flow.rect);
  flow.rect.height = 60;
  let scene = lowerPage(document, page, fonts);
  assert.ok(checkPageNode(scene, fonts).some(d => d.code === "process-layout" && d.severity === "error"));
  assert.equal(scene.items.filter(item => item.kind === "text").length, 6);
  assert.ok(scene.items.filter(item => item.kind === "text").every(item => item.fontSize === 24));
  flow.rect.height = 936;
  flow.topology!.nodes[2].position = { x: 20, y: 20 };
  flow.topology!.nodes[3].position = { x: 20, y: 20 };
  scene = lowerPage(document, page, fonts);
  const errors = checkPageNode(scene, fonts);
  assert.ok(errors.some(d => d.elementId === "n2" && /overlaps/.test(d.message)));
  assert.ok(errors.some(d => d.elementId === "reserve" && /backwards/.test(d.message)));
});

test("schema rejects ambiguous process contracts instead of silently ignoring them", () => {
  const mutations: ((f: ReturnType<typeof fixture>) => void)[] = [
    ({ flow }) => delete flow.topology,
    ({ flow }) => delete flow.topology!.edges[1].id,
    ({ flow }) => flow.topology!.edges[1].id = "n0",
    ({ flow }) => flow.topology!.edges[2].label = "Yes",
    ({ flow }) => flow.topology!.edges[2].label = " ",
    ({ flow }) => flow.topology!.edges.push({ id: "cycle", from: "n2", to: "n0" }),
    ({ flow }) => flow.topology!.edges.push({ id: "join", from: "n2", to: "n3" }),
    ({ flow }) => flow.topology!.nodes[0].visible = false,
    ({ flow }) => flow.appearance.type = "architecture",
    ({ flow }) => flow.customVisual = { format: "vector", description: "Conflict", elements: [], viewBox: { x: 0, y: 0, width: 100, height: 100 } },
    ({ flow }) => { delete flow.processFlow; flow.topology!.nodes[0].position = { x: 0, y: 0 }; },
  ];
  for (const mutation of mutations) {
    const f = fixture(); mutation(f);
    assert.equal(validateComposition(f.document).ok, false, String(mutation));
  }
});
