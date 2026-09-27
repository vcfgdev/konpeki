// Browser-local checks plus an optional disposable file session readiness JSON
// emitted by `konpeki preview <test-file> --json`. Never use a person's file.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { addComponent, initialDraft, initialGridDraft } from "../composition/document.ts";
import { toComposition } from "../composition/grid.ts";
import { assertComposition } from "../composition/validate.ts";
import { readCompositionFile, saveCompositionFile } from "../bin/session-store.ts";

const [base = "http://localhost:4318", output = "/tmp/konpeki-grid-editing", readyPath] = process.argv.slice(2);
mkdirSync(output, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), "grid-editing-"));
const b = (...args) => execFileSync("agent-browser", ["--session", "grid-editing", ...args], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim();
const evaluate = code => JSON.parse(b("eval", code));
const click = name => b("find", "role", "button", "click", "--name", name, "--exact");
const stored = () => {
  b("wait", "--fn", "document.querySelector('.browser-menu-intro [role=status]').textContent === 'Your editable composition is saved only in this browser.'");
  return evaluate("JSON.parse(localStorage.getItem('konpeki-composer/v1')).document");
};
const settle = () => b("eval", "document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))");
const capture = name => { settle(); b("screenshot", resolve(output, `${name}.png`)); };
const number = (name, value) => { b("fill", `[name='${name}']`, String(value)); b("press", "Enter"); };
function importDocument(document) {
  assertComposition(document);
  const path = join(scratch, "import.json");
  writeFileSync(path, JSON.stringify(document));
  b("upload", "input[type=file]", path);
  b("wait", "--fn", `document.querySelector('.document-title input').value === ${JSON.stringify(document.title)}`);
  settle();
}
function drag(selector, dx, dy) {
  const point = evaluate(`(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,scale:document.querySelector('#canvas-stage .canvas').getBoundingClientRect().width/1920}; })()`);
  b("mouse", "move", String(Math.round(point.x)), String(Math.round(point.y))); b("mouse", "down", "left");
  b("mouse", "move", String(Math.round(point.x + dx * point.scale)), String(Math.round(point.y + dy * point.scale))); b("mouse", "up", "left");
  settle();
}
async function fileSaved(path, expected) {
  for (let n = 0; n < 40; n++) {
    const file = await readCompositionFile(path);
    if (Object.entries(expected).every(([key, value]) => file.document.slides[0].components[0].area[key] === value)) return file;
    await new Promise(r => setTimeout(r, 250));
  }
  throw Error("Browser grid edit did not reach the file");
}
try {
  b("open", base); b("set", "viewport", "1600", "1000", "2"); b("wait", ".canvas");
  assert.equal(evaluate("document.querySelector('.component-grid') !== null"), true, "fresh browser document uses CSS Grid");
  click("Text block");
  b("wait", "[name=column]");
  const document = toComposition(addComponent(addComponent(initialGridDraft(), "text-block"), "image"));
  document.title = "Grid editing regression";
  const [text, art] = document.slides[0].components;
  text.area = { column: 2, span: 3, row: 9, rows: 12 };
  text.content = "Padding stays on the baseline.";
  text.padding = 2;
  art.area = { column: 7, span: 4, row: 9, rows: 18 };
  art.padding = 2;
  art.customVisual = { format: "vector", description: "Named vector type under padding and nested transforms", viewBox: { x: 0, y: 0, width: 400, height: 200 }, elements: [
    { id: "panel", kind: "rect", attributes: { x: 0, y: 0, width: 400, height: 200, fill: "theme:wash" } },
    { id: "group", kind: "g", attributes: { transform: "translate(10 10) scale(2)", "font-size": "scale:heading" } },
    { id: "label", parentId: "group", kind: "text", text: "Heading", attributes: { x: 0, y: 35 } },
    { id: "default", kind: "text", text: "Caption default", attributes: { x: 20, y: 170 } },
  ] };
  importDocument(document);
  const surface = `#canvas-stage [data-component='${text.id}'] .component-surface`;
  b("click", surface);
  assert.equal(evaluate("document.querySelector('[name=x]') === null"), true);
  const lineHeight = () => evaluate(`(() => {const canvas=document.querySelector('#canvas-stage .canvas'),t=document.querySelector(${JSON.stringify(surface)}).querySelector('.text-block-content');return Math.round(parseFloat(getComputedStyle(t).lineHeight)/canvas.getBoundingClientRect().width*1920)})()`);
  assert.equal(evaluate("document.querySelector('[name=Leading]').value"), "preset");
  assert.equal(lineHeight(), 36, "body uses the preset line height");
  assert.equal(evaluate("!!document.querySelector('[name=Leading] option[value=\"2\"]')"), false, "24px leading cannot fit 28px body text");
  b("select", "[name=Leading]", "4");
  assert.equal(stored().slides[0].components[0].textStyle.leading, 4);
  assert.equal(lineHeight(), 48, "explicit override uses baseline units");
  capture("grid-leading-explicit");
  b("select", "[name=Leading]", "preset");
  assert.equal(stored().slides[0].components[0].textStyle.leading, undefined);
  assert.equal(lineHeight(), 36);
  b("select", "[name='Type step']", "title");
  assert.equal(lineHeight(), 68, "type-step changes use the corresponding preset leading");
  b("select", "[name='Type step']", "role");
  assert.equal(lineHeight(), 36);
  assert.equal(evaluate(`(() => {const c=document.querySelector('#canvas-stage .canvas'),s=document.querySelector(${JSON.stringify(surface)});return Math.round(parseFloat(getComputedStyle(s).paddingLeft)/c.getBoundingClientRect().width*1920)})()`), 24);
  const sizes = evaluate(`(() => {const canvas=document.querySelector('#canvas-stage .canvas'), scale=canvas.getBoundingClientRect().width/1920;return ['label','default'].map(id=>{const t=canvas.querySelector('[data-vector-element='+id+']'),m=t.getScreenCTM();return Math.round(parseFloat(getComputedStyle(t).fontSize)*Math.hypot(m.c,m.d)/scale)})})()`);
  assert.deepEqual(sizes, [44, 24], "vector type must survive padding, inherited steps and nested scale");
  // Fractional pointer deltas must snap, not persist fractional pixel geometry.
  drag(surface, 162, 31);
  let expected = { column: 3, span: 3, row: 12, rows: 12 };
  assert.deepEqual(stored().slides[0].components[0].area, expected);
  drag(`#canvas-stage [data-component='${text.id}'] .resize-se`, 147, 23);
  expected = { column: 3, span: 4, row: 12, rows: 14 };
  assert.deepEqual(stored().slides[0].components[0].area, expected);
  b("focus", surface); b("press", "ArrowDown");
  expected.row++;
  assert.deepEqual(stored().slides[0].components[0].area, expected);
  capture("grid-inspector");
  b("focus", surface); b("press", "Control+z"); expected.row--;
  assert.deepEqual(stored().slides[0].components[0].area, expected);
  b("press", "Control+Shift+z"); expected.row++;
  assert.deepEqual(stored().slides[0].components[0].area, expected);
  b("eval", "{window.exports={};const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.exports[blob.type]=blob;return create(blob)}}");
  b("eval", "document.querySelector('.browser-menu > summary').click()");
  b("wait", ".browser-menu-popover:not([inert])"); click("Export");
  const exported = evaluate("window.exports['application/json'].text().then(JSON.parse)");
  assert.deepEqual(exported, stored());
  assertComposition(exported);
  assert.equal("preferredRect" in exported.slides[0].components[0], false);
  assert.equal("canvas" in exported.slides[0], false);
  b("reload"); b("wait", ".canvas"); settle();
  assert.deepEqual(stored(), exported);
  importDocument({ ...exported, title: "Reimported grid editing regression" });
  assert.deepEqual(stored().slides[0].components[0].area, expected);
  b("eval", "{window.png=null;const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{if(blob.type==='image/png')window.png=blob;return create(blob)}}");
  click("Export PNG"); b("wait", "--fn", "window.png !== null");
  const encoded = evaluate("new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(window.png)})");
  const png = Buffer.from(encoded.split(",")[1], "base64");
  assert.equal(png.readUInt32BE(16), 1920); assert.equal(png.readUInt32BE(20), 1080);
  writeFileSync(join(output, "grid-export.png"), png);
  const pixels = evaluate(`(async()=>{const bitmap=await createImageBitmap(window.png),c=new OffscreenCanvas(1920,1080),ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);return [[396,228,552,120],[996,192,528,168]].map(([x,y,w,h])=>{const a=ctx.getImageData(x,y,w,h).data;let n=0;for(let i=0;i<a.length;i+=4)if(a[i]<230||a[i+1]<230||a[i+2]<230)n++;return n})})()`);
  assert.ok(pixels.every(count => count > 100), "PNG contains native and vector content");
  const ink = () => evaluate("getComputedStyle(document.querySelector('#canvas-stage [data-vector-element=label]')).fill");
  const paperInk = ink();
  b("click", ".component-dock button:first-child"); click("Night"); settle();
  assert.notEqual(ink(), paperInk, "vector labels inherit theme ink rather than SVG's black default");
  capture("grid-night"); click("Paper");
  // Padding can hide overflow even when the unpadded outer area would fit.
  b("click", surface); number("rows", 5);
  b("wait", "--fn", "document.querySelector('.overflow-trigger').textContent.trim() !== '0'");
  capture("padding-overflow");
  console.log("PASS grid drag/resize/keyboard, undo/redo, named vector type, padding warning, storage, JSON and PNG round trips");

  importDocument(toComposition(initialGridDraft()));
  b("select", "[name=page-format]", "Portrait post");
  assert.equal(stored().slides[0].grid.preset, "portrait");
  b("select", "[name=page-format]", "Link preview / OG");
  assert.equal(stored().slides[0].grid.preset, "link");
  importDocument(document);
  assert.equal(evaluate("document.querySelector('option[value=\"Link preview / OG\"]').disabled"), true);
  const v1 = addComponent(initialDraft(true), "text-block"); v1.title = "Legacy free placement";
  importDocument(v1); click("Select Text block"); number("x", 137);
  assert.equal(stored().schema, "konpeki-composition/v1");
  assert.equal(stored().slides[0].components[0].preferredRect.x, 137);
  assert.equal("area" in stored().slides[0].components[0], false);
  capture("legacy-inspector");
  console.log("PASS blank v2 presets, blocked incompatible preset and v1 free-placement editing");

  if (readyPath) {
    const ready = JSON.parse(readFileSync(readyPath, "utf8"));
    const original = await readCompositionFile(ready.compositionPath);
    assert.equal(original.document.title, "Disposable grid session", "refuse to replace a non-test document");
    await saveCompositionFile(ready.compositionPath, original.revision, document);
    b("open", ready.url);
    b("wait", "--fn", `document.querySelector('.document-title input')?.value === ${JSON.stringify(document.title)}`);
    b("wait", '[title="Saved to file"]'); settle(); b("click", surface);
    drag(surface, 162, 31);
    const humanArea = { column: 3, span: 3, row: 12, rows: 12 };
    const current = await fileSaved(ready.compositionPath, humanArea);
    const revised = structuredClone(current.document);
    revised.slides[0].components[0].content = "Agent kept the human grid area.";
    await saveCompositionFile(ready.compositionPath, current.revision, revised);
    b("wait", "--text", "Agent kept the human grid area.");
    assert.deepEqual((await readCompositionFile(ready.compositionPath)).document, revised);
    capture("file-agent-round-trip");
    console.log("PASS browser drag saved integer area to file; revision-checked agent update retained placement and refreshed canvas");
  }
} finally {
  b("close"); rmSync(scratch, { recursive: true, force: true });
}
