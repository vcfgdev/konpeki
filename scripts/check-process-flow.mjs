// Real canvas gestures, saved JSON revisions, and SVG/PNG/PDF agreement.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadNodeFontContext } from "../composition/fonts.ts";
import { lowerPage } from "../composition/lower.ts";
import { checkPageNode } from "../composition/check-node.ts";
import { assertComposition } from "../composition/validate.ts";
import { renderSVG } from "../composition/svg.ts";
import { renderPDF } from "../composition/pdf.ts";
import { Resvg } from "@resvg/resvg-js";

const [base = "http://localhost:4318", output = "/tmp/konpeki-process-flow"] = process.argv.slice(2);
mkdirSync(output, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), "konpeki-process-"));
const b = (...args) => execFileSync("agent-browser", ["--session", "kp-flow", ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trim();
const evaluate = code => JSON.parse(b("eval", code));
const settle = () => b("wait", "350");
const stored = () => { settle(); return evaluate("JSON.parse(localStorage.getItem('konpeki-composer/v1')).document"); };
const flowOf = document => document.slides[0].components.find(component => component.id === "flow");
const positionOf = document => flowOf(document).topology.nodes.find(node => node.id === "backorder").position;
const selectFlow = () => b("click", ".component-hit[data-component='flow']", "--force");
function importDocument(document) {
  assertComposition(document);
  const path = join(scratch, "input.json");
  writeFileSync(path, JSON.stringify(document));
  b("upload", "input[type=file]", path); settle();
  b("wait", "--fn", "document.querySelector('.scene-artwork [data-component=flow]') !== null");
}
const fonts = await loadNodeFontContext(new URL("../fonts/", import.meta.url));
async function exports(document, name) {
  const scene = lowerPage(document, document.slides[0], fonts);
  assert.deepEqual(checkPageNode(scene, fonts), [], `${name} must pass scene checks`);
  const svg = renderSVG(scene, fonts), path = resolve(output, name);
  writeFileSync(`${path}.json`, JSON.stringify(document, null, 2));
  writeFileSync(`${path}.svg`, svg);
  writeFileSync(`${path}.png`, new Resvg(svg, { fitTo: { mode: "zoom", value: 2 }, font: { loadSystemFonts: false } }).render().asPng());
  writeFileSync(`${path}.pdf`, await renderPDF([scene], fonts));
  const extracted = execFileSync("pdftotext", [`${path}.pdf`, "-"], { encoding: "utf8" }).replace(/\s+/g, " ");
  for (const slot of document.slides[0].contentSlots) assert.ok(extracted.includes(slot.label), `PDF must retain ${slot.label}`);
  execFileSync("pdftoppm", ["-singlefile", "-r", "192", "-png", `${path}.pdf`, join(scratch, name)]);
  const diff = spawnSync("compare", ["-metric", "RMSE", `${path}.png`, join(scratch, `${name}.png`), "null:"], { encoding: "utf8" });
  const rmse = Number(/\(([\d.]+)\)/.exec(diff.stderr)?.[1]);
  assert.ok(rmse < .025, `${name}: PDF/PNG raster RMSE ${rmse}`);
  console.log(`${name}: no diagnostics, PDF text retained, PDF/PNG RMSE ${rmse}`);
}
try {
  b("open", base); b("set", "viewport", "1600", "1000", "2"); b("wait", ".scene-canvas");
  const document = JSON.parse(readFileSync(new URL("../skills/konpeki/assets/blank.json", import.meta.url), "utf8"));
  document.title = "Semantic process flow";
  const page = document.slides[0]; page.name = "Order handling";
  const steps = [["receive", "Receive order"], ["stock", "Stock available?"], ["reserve", "Reserve stock"], ["backorder", "Offer backorder"], ["confirm", "Confirm delivery"]];
  page.contentSlots = steps.map(([id, label]) => ({ id: `${id}-slot`, label, required: true, role: "process-step", instruction: "Illustrative example" }));
  page.components = [{ id: "title", kind: "text-block", slotIds: ["headline"], content: "Check stock before promising delivery", appearance: { role: "title", verticalAlignment: "start" }, area: { column: 1, span: 24, row: 1, rows: 8 } },
    { id: "flow", kind: "diagram", slotIds: page.contentSlots.map(slot => slot.id), appearance: { type: "process" }, area: { column: 1, span: 24, row: 12, rows: 60 }, processFlow: { direction: "right" },
      topology: { kind: "explicit", nodes: steps.map(([id]) => ({ id, slotId: `${id}-slot` })), edges: [
        { id: "check", from: "receive", to: "stock" }, { id: "yes", from: "stock", to: "reserve", label: "Yes" },
        { id: "no", from: "stock", to: "backorder", label: "No" }, { id: "confirm-order", from: "reserve", to: "confirm" },
      ] } }];
  page.contentSlots.push({ id: "headline", label: "Check stock before promising delivery", required: true, role: "takeaway", instruction: "Title" });
  page.paintOrder = ["title", "flow"]; page.readingOrder = page.paintOrder.map(id => ({ kind: "component", id }));
  importDocument(document); selectFlow();
  assert.equal(evaluate("document.querySelectorAll('[data-process-node]').length"), 5);
  const selector = '[data-process-node="backorder"]';
  b("focus", selector); b("press", "ArrowDown");
  const nudged = positionOf(stored()); assert.ok(nudged);
  b("press", "Control+z"); assert.equal(positionOf(stored()), undefined);
  b("press", "Control+Shift+z"); assert.deepEqual(positionOf(stored()), nudged);
  b("focus", selector); b("press", "Delete"); assert.equal(positionOf(stored()), undefined);
  assert.equal(stored().slides[0].components.length, 2, "Delete resets node, never deletes the component");
  const point = evaluate(`(() => {const r=document.querySelector('${selector}').getBoundingClientRect(),c=document.querySelector('.scene-canvas').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,scale:c.width/1920};})()`);
  const startX = Math.round(point.x), startY = Math.round(point.y);
  const endX = Math.round(point.x + 18 * point.scale), endY = Math.round(point.y + 30 * point.scale);
  b("mouse", "move", String(startX), String(startY)); b("mouse", "down", "left");
  b("mouse", "move", String(endX), String(endY)); settle(); b("mouse", "up", "left");
  const moved = stored(), pinned = positionOf(moved); assert.ok(pinned);
  assert.ok(Math.abs(pinned.x - nudged.x - (endX - startX) / point.scale) <= 1);
  assert.ok(Math.abs(pinned.y - nudged.y + 12 - (endY - startY) / point.scale) <= 1, "drag delta vs 12px keyboard nudge");
  b("reload"); settle(); selectFlow(); assert.deepEqual(positionOf(stored()), pinned);
  b("screenshot", resolve(output, "canvas-pinned.png"));

  // Agent revision of the latest saved human document, not the original input.
  const revised = structuredClone(moved), revisedPage = revised.slides[0], flow = flowOf(revised);
  revisedPage.contentSlots.find(slot => slot.id === "reserve-slot").label = "Reserve stock before confirming the delivery date";
  revisedPage.contentSlots.push({ id: "audit-slot", label: "Record request", role: "process-step", required: true, instruction: "Illustrative audit step" });
  flow.slotIds.push("audit-slot"); flow.topology.nodes.push({ id: "audit", slotId: "audit-slot" });
  flow.topology.edges.find(edge => edge.id === "check").to = "audit";
  flow.topology.edges.push({ id: "audit-check", from: "audit", to: "stock" });
  // The pinned backorder stays where the person put it; the longer graph may
  // report a conflict. This is preferable to silently discarding the override.
  importDocument(revised); selectFlow(); assert.deepEqual(positionOf(stored()), pinned);
  b("find", "role", "button", "click", "--name", "Reset step positions", "--exact");
  const reset = stored(); assert.equal(positionOf(reset), undefined);
  await exports(reset, "process-revised");
  b("screenshot", resolve(output, "canvas-revised.png"));

  const vertical = structuredClone(document); flowOf(vertical).processFlow.direction = "down";
  importDocument(vertical); selectFlow(); await exports(vertical, "process-down");
  b("screenshot", resolve(output, "canvas-down.png"));
  const night = structuredClone(document); night.theme.mode = "night";
  importDocument(night); await exports(night, "process-night");
  b("screenshot", resolve(output, "canvas-night.png"));
  const crowded = structuredClone(document); flowOf(crowded).area.rows = 5;
  importDocument(crowded); selectFlow();
  assert.ok(checkPageNode(lowerPage(crowded, crowded.slides[0], fonts), fonts).some(d => d.code === "process-layout"));
  b("screenshot", resolve(output, "canvas-overflow.png"));
  importDocument(document); await exports(document, "process-default");
  console.log("PASS: drag, nudge, undo/redo, reset, reload, agent revision preserves pinned coordinates, both directions, night and overflow states.");
} finally {
  b("close"); rmSync(scratch, { recursive: true, force: true });
}
