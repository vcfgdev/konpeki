// End-to-end checks for the lowered scene canvas. The fixture intentionally has
// no authored transform attributes: all fitting must come from scene lowering.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { addComponent, initialDraft, initialGridDraft, parseCompositionJSON } from "../composition/document.ts";
import { toComposition } from "../composition/grid.ts";
import { assertComposition } from "../composition/validate.ts";

const [base = "http://localhost:4318", output = "/tmp/konpeki-grid-editing"] = process.argv.slice(2);
mkdirSync(output, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), "grid-editing-"));
const b = (...args) => execFileSync("agent-browser", ["--session", "grid-editing", ...args], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim();
const evaluate = code => JSON.parse(b("eval", code));
const settle = () => b("eval", "document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))");
const stored = () => {
  b("wait", "350");
  b("wait", "--fn", "JSON.parse(localStorage.getItem('konpeki-composer/v1'))?.document?.title === document.querySelector('.document-title input')?.value");
  return evaluate("JSON.parse(localStorage.getItem('konpeki-composer/v1')).document");
};
const click = name => b("find", "role", "button", "click", "--name", name, "--exact");
const capture = name => { settle(); b("screenshot", resolve(output, `${name}.png`)); };

function importDocument(document) {
  assertComposition(document);
  const path = join(scratch, "scene.json");
  writeFileSync(path, JSON.stringify(document));
  b("upload", "input[type=file]", path);
  b("wait", "--fn", `document.querySelector('.document-title input')?.value === ${JSON.stringify(document.title)}`);
  b("wait", "--fn", "document.querySelector('.scene-artwork svg:not([aria-busy])') !== null");
  settle();
}

function drag(selector, dx, dy) {
  const point = evaluate(`(() => { const target=document.querySelector(${JSON.stringify(selector)}),r=target.getBoundingClientRect(),c=document.querySelector('.scene-canvas').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,scale:c.width/1920}; })()`);
  b("mouse", "move", String(Math.round(point.x)), String(Math.round(point.y))); b("mouse", "down", "left");
  b("mouse", "move", String(Math.round(point.x + dx * point.scale)), String(Math.round(point.y + dy * point.scale))); b("mouse", "up", "left");
  settle();
}

try {
  b("open", base); b("set", "viewport", "1600", "1000", "2"); b("wait", ".scene-canvas");
  // A fresh v2 draft is intentionally blank; import content before querying it.
  const document = toComposition(addComponent(addComponent(initialGridDraft(), "text-block"), "image"));
  document.title = "Lowered scene editing regression";
  const [text, vector] = document.slides[0].components;
  text.area = { column: 2, span: 4, row: 8, rows: 10 }; text.content = "Editable baseline text"; text.padding = 1;
  vector.area = { column: 7, span: 4, row: 8, rows: 18 }; vector.padding = 1;
  vector.customVisual = { format: "vector", description: "Line and editable label", viewBox: { x: 0, y: 0, width: 400, height: 200 }, elements: [
    { id: "panel", kind: "rect", attributes: { x: 0, y: 0, width: 400, height: 200, fill: "theme:wash" } },
    { id: "route", kind: "line", attributes: { x1: 35, y1: 45, x2: 350, y2: 145, stroke: "theme:accent", "stroke-width": 6 } },
    { id: "label", kind: "text", text: "Editable vector label", attributes: { x: 35, y: 105, fill: "theme:ink", "font-size": "scale:heading" } },
  ] };
  // Components are deliberately not in paint order. The overlapping text must
  // be the frontmost hit target because paintOrder, not array order, owns stack.
  text.area = { ...vector.area };
  document.slides[0].paintOrder = [vector.id, text.id];
  importDocument(document);

  assert.deepEqual(evaluate("[...document.querySelectorAll('.component-hit')].map(node=>node.dataset.component)"), [vector.id, text.id]);
  assert.ok(evaluate("document.querySelectorAll('[data-scene-item]').length") >= 4, "lowered SVG exposes scene metadata");
  assert.ok(evaluate("[...document.querySelectorAll('[data-line-start]')].every(node=>node.hasAttribute('data-baseline')&&node.hasAttribute('data-line-end'))"), "text outlines retain baseline metadata");
  assert.equal(evaluate("document.querySelector('.scene-artwork svg text') === null"), true, "scene text is shaped to paths");

  const hit = `.component-hit[data-component='${text.id}']`;
  b("focus", hit); b("press", "ArrowDown");
  assert.equal(stored().slides[0].components.find(item=>item.id===text.id).area.row, 9, "arrow key nudges one baseline");
  b("press", "Control+z"); assert.equal(stored().slides[0].components.find(item=>item.id===text.id).area.row, 8);
  b("press", "Control+Shift+z"); assert.equal(stored().slides[0].components.find(item=>item.id===text.id).area.row, 9);
  drag(hit, 170, 24);
  assert.ok(Number.isInteger(stored().slides[0].components.find(item=>item.id===text.id).area.column), "drag persists snapped integer grid area");
  b("dblclick", hit); b("wait", ".scene-text-editor"); b("fill", ".scene-text-editor", "Committed temporary editor text"); b("press", "Tab");
  assert.equal(stored().slides[0].components.find(item=>item.id===text.id).content, "Committed temporary editor text");

  // Select the vector from Layers because the test components overlap, enter
  // element editing, then verify line handles against screen-space scene points.
  click("Layers"); b("eval", "[...document.querySelectorAll('.layer-select')].find(button=>button.textContent.includes('Image')).click()"); click("Edit elements");
  b("click", `[data-vector-element='route']`); b("wait", ".line-handles circle");
  const endpointError = evaluate(`(() => { const line=document.querySelector('[data-vector-element=route] line'), handle=document.querySelector('.line-handles circle'), svg=document.querySelector('.scene-artwork svg'); const value=new DOMPoint(+line.getAttribute('x1'),+line.getAttribute('y1')).matrixTransform(line.getScreenCTM()); const h=handle.getBoundingClientRect(); return Math.hypot(value.x-(h.x+h.width/2),value.y-(h.y+h.height/2)); })()`);
  assert.ok(endpointError < 1.5, `fitted line handle follows CSS-resized scene (${endpointError}px error)`);
  capture("line-handles-scaled");
  b("eval", "document.querySelector('[data-vector-element=label] path').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))");
  assert.equal(evaluate("document.activeElement?.value === 'Editable vector label'"), true, "double-click opens vector label editor");
  b("press", "Escape"); capture("scene-interactions");

  b("eval", "{window.png=null;const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{if(blob.type==='image/png')window.png=blob;return create(blob)}}");
  b("eval", "{const menu=document.querySelector('.export-menu');menu.open=true;[...menu.querySelectorAll('button')].find(button=>button.textContent.trim()==='Export PNG').click()}");
  b("wait", "--fn", "window.png !== null");
  const encoded = evaluate("new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(window.png)})");
  const png = Buffer.from(encoded.split(",")[1], "base64");
  assert.equal(png.readUInt32BE(16), 3840); assert.equal(png.readUInt32BE(20), 2160);
  writeFileSync(join(output, "scene-exact-2x.png"), png);

  const paper = evaluate("getComputedStyle(document.querySelector('.scene-artwork svg')).backgroundColor");
  b("click", ".component-dock button:first-child"); click("Night"); settle();
  assert.notEqual(evaluate("document.querySelector('.scene-artwork svg rect').getAttribute('fill')"), paper, "theme switch rerenders scene colors");
  capture("scene-night");

  // The editor remains mounted behind Present. Navigate to a different page so
  // reusing the editor's SVG clip IDs would clip against unrelated rectangles.
  const deck = structuredClone(document);
  const second = structuredClone(deck.slides[0]);
  second.id = "different-clips"; second.name = "Different clips";
  second.components[0].area = { column: 1, span: 3, row: 40, rows: 12 };
  deck.slides.push(second);
  importDocument(deck);
  click("Present"); b("wait", ".presentation .scene-artwork svg");
  click("Next page");
  b("wait", "--fn", "document.querySelector('.presentation .scene-artwork svg')?.getAttribute('aria-label') === 'different-clips'");
  assert.equal(evaluate(`(() => {
    const ids = [...document.querySelectorAll('.scene-artwork [id]')].map(node => node.id);
    return ids.length === new Set(ids).size;
  })()`), true, "editor and presentation SVG IDs must be unique in the document");
  assert.equal(evaluate(`(() => {
    const svg = document.querySelector('.presentation .scene-artwork svg');
    return [...svg.querySelectorAll('[clip-path]')].every(node =>
      svg.contains(document.getElementById(node.getAttribute('clip-path').slice(5, -1))));
  })()`), true, "presentation clips resolve inside its own scene");
  capture("scene-presentation"); click("Exit");

  const legacy = initialDraft(true);
  assert.equal(parseCompositionJSON(JSON.stringify(legacy)).ok, false, "v1 documents are rejected rather than edited");
  assert.equal(parseCompositionJSON(JSON.stringify({ ...document, schema: "v2" })).ok, false, "schema aliases are rejected");
  console.log("PASS lowered scene metadata, paint-order hits, keyboard/drag/undo, temporary and vector text editing, fitted scaled line handles, theme rendering, exact 2x PNG, and v2-only validation");
} finally {
  try { b("close"); } finally { rmSync(scratch, { recursive: true, force: true }); }
}
