// End-to-end checks for the lowered scene canvas. The fixture intentionally has
// no authored transform attributes: all fitting must come from scene lowering.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { addComponent, initialDraft, initialGridDraft, parseCompositionJSON } from "../composition/document.ts";
import { refineGrid, toComposition } from "../composition/grid.ts";
import { assertComposition } from "../composition/validate.ts";
import { loadNodeFontContext } from "../composition/fonts.ts";
import { lowerPage } from "../composition/lower.ts";

const [base = "http://localhost:4318", output = "/tmp/konpeki-grid-editing"] = process.argv.slice(2);
mkdirSync(output, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), "grid-editing-"));
const b = (...args) => execFileSync("agent-browser", ["--session", "grid-editing", ...args], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim();
const evaluate = code => JSON.parse(b("eval", code));
const settle = () => b("eval", "document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))");
const stored = () => {
  b("wait", "350");
  b("wait", "--fn", "JSON.parse(localStorage.getItem('konpeki-composer/v1'))?.document?.title === document.querySelector('.board-heading h1')?.textContent");
  return evaluate("JSON.parse(localStorage.getItem('konpeki-composer/v1')).document");
};
const capture = name => { settle(); b("screenshot", resolve(output, `${name}.png`)); };

function importDocument(document) {
  assertComposition(document);
  const path = join(scratch, "scene.json");
  writeFileSync(path, JSON.stringify(document));
  b("upload", "input[type=file]", path);
  b("wait", "--fn", `document.querySelector('.board-heading h1')?.textContent === ${JSON.stringify(document.title)}`);
  b("wait", "--fn", "document.querySelector('.scene-artwork svg:not([aria-busy])') !== null");
  settle();
}

function drag(selector, dx, dy, during = () => {}) {
  const point = evaluate(`(() => { const target=document.querySelector(${JSON.stringify(selector)}),r=target.getBoundingClientRect(),c=document.querySelector('.scene-canvas').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,scale:c.width/document.querySelector('.scene-artwork svg').viewBox.baseVal.width}; })()`);
  const start = { x: Math.round(point.x), y: Math.round(point.y) };
  b("mouse", "move", String(start.x), String(start.y)); b("mouse", "down", "left");
  for (const fraction of [.5, 1]) {
    const x = Math.round(start.x + dx * point.scale * fraction), y = Math.round(start.y + dy * point.scale * fraction);
    b("mouse", "move", String(x), String(y));
    settle(); during(fraction, { x: (x - start.x) / point.scale, y: (y - start.y) / point.scale });
  }
  b("mouse", "up", "left");
  settle();
}

try {
  b("open", base); b("set", "viewport", "1600", "1000", "2"); b("wait", ".scene-canvas");
  // A fresh v2 draft is intentionally blank; import content before querying it.
  const document = toComposition(addComponent(addComponent(initialGridDraft(), "text-block"), "image"));
  delete document.slides[0].grid.revision; // Exercise old documents before upgrading.
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
  assert.ok(Math.abs(stored().slides[0].components.find(item=>item.id===text.id).area.column - 8.12) < 1e-10, "168px drag persists without rounding back to a whole column");
  b("dblclick", hit); b("wait", ".scene-text-editor");
  b("dblclick", ".scene-text-editor");
  assert.equal(evaluate("document.querySelector('.revision-notes')===null"), true, "selecting words does not open comments");
  b("fill", ".scene-text-editor", "Committed temporary editor text");
  capture("inline-text-correction"); b("press", "Tab");
  assert.equal(stored().slides[0].components.find(item=>item.id===text.id).content, "Committed temporary editor text");
  b("dblclick", hit); b("fill", ".scene-text-editor", "Discard this text"); b("press", "Escape");
  assert.equal(stored().slides[0].components.find(item=>item.id===text.id).content, "Committed temporary editor text", "Escape cancels the text draft");

  // Vector artwork requests open page comments, not a second design editor.
  b("eval", "document.querySelector('[data-vector-element=label] path').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))");
  assert.equal(evaluate("document.activeElement?.id"), "revision-note");
  assert.equal(evaluate("document.querySelector('.line-handles, .vector-attributes, .scene-text-editor') === null"), true);
  capture("scene-interactions");

  b("eval", "(async()=>{const {exportComposition}=await import('/src/lib/export-scene.ts');window.png=await exportComposition(JSON.parse(localStorage.getItem('konpeki-composer/v1')).document,'png',0,2)})()");
  const encoded = evaluate("new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(window.png)})");
  const png = Buffer.from(encoded.split(",")[1], "base64");
  assert.equal(png.readUInt32BE(16), 3840); assert.equal(png.readUInt32BE(20), 2160);
  writeFileSync(join(output, "scene-exact-2x.png"), png);

  const paper = evaluate("document.querySelector('.scene-artwork svg rect').getAttribute('fill')");
  const night = stored(); night.theme = { ...night.theme, mode: "night" };
  importDocument(night);
  assert.notEqual(evaluate("document.querySelector('.scene-artwork svg rect').getAttribute('fill')"), paper, "authored theme rerenders scene colors");
  capture("scene-night");

  // All pages coexist, with repeated component IDs but different clip geometry.
  const deck = structuredClone(document);
  const second = structuredClone(deck.slides[0]);
  second.id = "different-clips"; second.name = "Different clips";
  second.components[0].area = { column: 1, span: 3, row: 40, rows: 12 };
  deck.slides.push(second);
  importDocument(deck);
  b("wait", "--fn", "document.querySelectorAll('.scene-artwork svg').length===2");
  assert.equal(evaluate(`(() => {
    const ids = [...document.querySelectorAll('.scene-artwork [id]')].map(node => node.id);
    return ids.length === new Set(ids).size;
  })()`), true, "all page SVG IDs must be unique");
  assert.equal(evaluate(`[...document.querySelectorAll('.scene-artwork svg')].every(svg =>
    [...svg.querySelectorAll('[clip-path]')].every(node =>
      svg.contains(document.getElementById(node.getAttribute('clip-path').slice(5, -1)))))`), true, "clips resolve inside their own page");
  const secondHit = `[data-page="different-clips"] ${hit}`;
  b("click", secondHit); b("press", "ArrowDown");
  assert.equal(stored().slides[1].components[0].area.row, 41);
  assert.deepEqual(stored().slides[0], deck.slides[0], "same ID on another page is untouched");
  b("press", "Delete");
  assert.equal(stored().slides[1].components.length, 1);
  assert.equal(stored().slides[0].components.length, 2);
  b("press", "Control+z"); b("press", "Control+z");
  assert.deepEqual(stored().slides, deck.slides, "undo restores the correct page");
  capture("all-pages-corrections");

  // Print pages retain their dimensions on a scrollable canvas.
  const print = toComposition(addComponent(initialGridDraft(), "text-block"));
  print.title = "A4 viewport regression";
  print.slides[0].grid = { preset: "a4", revision: 2 };
  print.slides[0].components[0].area = { column: 1, span: 12, row: 1, rows: 12 };
  importDocument(print);
  const fit = selector => {
    const rect = evaluate(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().toJSON()`);
    assert.ok(Math.abs(rect.width / rect.height - 210 / 297) < .001, "preserve paper proportions");
    assert.ok(rect.left >= 0 && rect.right <= 1600, "A4 page fits canvas width");
    assert.ok(rect.top >= 0 && rect.bottom <= 1000 && rect.height > 750, "portrait page nearly fills the viewport height without clipping");
  };
  fit(".scene-canvas");
  capture("a4-editor");
  const mixed = structuredClone(deck);
  mixed.slides.push({ ...structuredClone(print.slides[0]), id: "portrait" });
  importDocument(mixed);
  const sizes = evaluate("[...document.querySelectorAll('.scene-canvas')].map(p=>{const r=p.getBoundingClientRect();return r.width/r.height})");
  assert.ok(Math.abs(sizes[0] - 16/9) < .001 && Math.abs(sizes[2] - 210/297) < .001);
  b("eval", "document.querySelector('.workspace').scrollTo(0,0)"); capture("mixed-page-sizes");
  b("eval", "document.querySelector('[data-page=portrait]').scrollIntoView({block:'nearest',inline:'center'})");
  fit("[data-page=portrait] .scene-canvas");
  capture("mixed-portrait-fit");
  const printSize = evaluate(`(async () => {
    const { exportComposition } = await import('/src/lib/export-scene.ts');
    const blob = await exportComposition(${JSON.stringify(print)}, 'png', 0, 2);
    const bitmap = await createImageBitmap(blob);
    return [bitmap.width, bitmap.height];
  })()`);
  assert.deepEqual(printSize, [1588, 2246], "browser and CLI share the rounded A4 raster size");

  importDocument(document);
  const geometry = () => evaluate("[...document.querySelectorAll('.component-hit')].map(node=>[node.dataset.component,node.style.left,node.style.top,node.style.width,node.style.height])");
  const beforeUpgrade = geometry();
  const refined = { ...document, slides: document.slides.map(refineGrid) };
  importDocument(refined);
  assert.equal(stored().slides[0].grid.revision, 2);
  assert.equal(stored().slides[0].components[0].area.column, 13);
  assert.equal(stored().slides[0].components[0].area.span, 8);
  assert.deepEqual(geometry(), beforeUpgrade, "importing a refined document preserves pixel hit boxes");
  assert.equal(evaluate("[...document.querySelectorAll('button')].some(node=>node.textContent==='Use finer grid')"), false);
  b("press", "Control+z");
  assert.equal(stored().slides[0].grid.revision, undefined, "undo restores the original grid");
  assert.deepEqual(geometry(), beforeUpgrade);
  b("press", "Control+Shift+z");
  assert.equal(stored().slides[0].grid.revision, 2);
  assert.deepEqual(geometry(), beforeUpgrade);
  capture("fine-grid-corrections");
  b("focus", hit); b("press", "ArrowRight");
  assert.equal(stored().slides[0].components[0].area.column, 13.16);
  const newLeft = Number.parseFloat(geometry().find(item=>item[0]===text.id)[1]);
  const oldLeft = Number.parseFloat(beforeUpgrade.find(item=>item[0]===text.id)[1]);
  assert.ok(Math.abs((newLeft-oldLeft)*1920/100-12)<.001, "horizontal nudge matches the 12px vertical baseline");
  b("press", "Control+z");
  assert.equal(stored().slides[0].components[0].area.column, 13, "wait for the undone placement to persist");

  const beforeSquare = stored();
  drag(hit, 13, 13);
  assert.deepEqual(stored().slides[0].components[0].area, { column: 13.16, span: 8, row: 9, rows: 18 }, "equal diagonal input moves 12px on each axis");
  capture("square-step-drag");
  b("press", "Control+z"); assert.deepEqual(stored(), beforeSquare);
  drag(".resize-se", 13, 13);
  assert.deepEqual(stored().slides[0].components[0].area, { column: 13, span: 8.16, row: 8, rows: 19 }, "pointer resize uses square steps too");
  b("press", "Control+z"); assert.deepEqual(stored(), beforeSquare);
  b("focus", ".resize-se"); b("press", "ArrowRight"); b("press", "ArrowDown");
  assert.deepEqual(stored().slides[0].components[0].area, { column: 13, span: 8.16, row: 8, rows: 19 }, "keyboard resize matches pointer steps");
  b("press", "Control+z"); b("press", "Control+z"); assert.deepEqual(stored(), beforeSquare);
  b("reload"); b("wait", ".scene-artwork svg:not([aria-busy])"); settle();
  assert.equal(stored().slides[0].grid.revision, 2, "reload retains grid revision");
  assert.deepEqual(geometry(), beforeUpgrade);

  const centered = toComposition(addComponent(initialGridDraft(), "text-block"));
  centered.title = "Centered placement editing regression";
  const block = centered.slides[0].components[0];
  block.area = { column: "center", span: 8, row: "center", rows: 10 };
  block.content = "Konpeki"; block.textStyle = { step: "title" };
  block.appearance.alignment = "center"; block.appearance.verticalAlignment = "center";
  importDocument(centered);
  const centeredHit = `.component-hit[data-component='${block.id}']`;
  b("click", centeredHit);
  b("wait", "--fn", "getComputedStyle(document.querySelector('.component-hit.selected')).backgroundColor === 'rgba(0, 0, 0, 0)'");
  assert.equal(evaluate("document.querySelector('select, input[name=span]') === null"), true, "placement controls are not design forms");
  assert.deepEqual(stored().slides[0].components[0].area, block.area);
  b("focus", centeredHit); b("press", "ArrowDown");
  assert.deepEqual(stored().slides[0].components[0].area, { column: "center", span: 8, row: 36, rows: 10 });
  capture("centered-text-correction");

  const cover = JSON.parse(readFileSync(new URL("../slides/github-cover/composition.json", import.meta.url), "utf8"));
  importDocument(cover);
  assert.equal(stored().slides[0].grid.revision, 2);
  capture("fine-grid-cover");
  const fonts = await loadNodeFontContext(new URL("../fonts/", import.meta.url));
  const assertGroupHits = current => {
    settle();
    const expected = lowerPage(current, current.slides[0], fonts);
    for (const component of expected.components) {
      const top = evaluate(`parseFloat(document.querySelector('.component-hit[data-component="${component.id}"]').style.top) * ${expected.height} / 100`);
      assert.ok(Math.abs(top - component.box.y) < .001, `${component.id}: hit target follows scene, including group offset`);
    }
  };
  assertGroupHits(cover);
  const positions = () => evaluate(`Object.fromEntries(['brand-mark','brand','promise','audience','visual-family'].map(id => {
    const hit = document.querySelector('.component-hit[data-component="'+id+'"]');
    const item = document.querySelector('.scene-artwork [data-component="'+id+'"]');
    const line = item.querySelector('[data-baseline]');
    const canvas = document.querySelector('.scene-canvas').getBoundingClientRect(), scale=canvas.height/630;
    const y = line ? +line.dataset.baseline : item.querySelector('path,rect').transform.baseVal.consolidate().matrix.f;
    return [id, { box: (hit.getBoundingClientRect().top-canvas.top)/scale,
      artwork: (new DOMPoint(0,y).matrixTransform(item.getScreenCTM()).y-canvas.top)/scale }];
  }))`);
  const beforeGesture = positions();
  const assertMovement = (changes, message) => {
    const current = positions();
    for (const id of Object.keys(beforeGesture)) for (const field of ["box", "artwork"])
      assert.ok(Math.abs(current[id][field] - beforeGesture[id][field] - (changes[id] ?? 0)) < .05,
        `${message}: ${id}/${field} moved ${current[id][field] - beforeGesture[id][field]}px, expected ${changes[id] ?? 0}px`);
  };
  const audienceHit = ".component-hit[data-component=audience]";
  drag(audienceHit, 0, 48, (fraction, delta) => {
    assertMovement({ audience: delta.y }, "edge member tracks pointer; siblings stay still until drop");
    assert.equal(evaluate("document.querySelectorAll('.group-area-outline').length"), 1);
    if (fraction === 1) {
      // A toast state update rerenders App without changing the document.
      b("eval", "(()=>{window.dragArtwork=document.querySelector('.scene-artwork svg');document.querySelector('.toast').dispatchEvent(new MouseEvent('mouseover',{bubbles:true}))})()");
      settle();
      assert.equal(evaluate("window.dragArtwork===document.querySelector('.scene-artwork svg')"), true, "unrelated UI updates preserve the live SVG");
      assertMovement({ audience: delta.y }, "artwork and handles stay together after a UI update");
      b("eval", "document.querySelector('.toast').dispatchEvent(new MouseEvent('mouseout',{bubbles:true}))");
      b("wait", "3500");
      assertMovement({ audience: delta.y }, "toast dismissal cannot reset the preview");
      capture("group-offset-held");
    }
  });
  assert.equal(stored().slides[0].components.find(item => item.id === "audience").area.row, 53);
  assertMovement({ audience: 24, "brand-mark": -24, brand: -24, promise: -24 }, "group settles once on drop");
  assert.equal(evaluate("document.querySelector('.group-area-outline') === null"), true);
  assertGroupHits(stored()); capture("group-offset-settled");
  b("press", "Control+z"); settle(); assertMovement({}, "one undo restores the whole gesture");

  b("focus", audienceHit);
  for (const distance of [8, 16]) {
    b("keydown", "ArrowDown"); settle();
    assertMovement({ audience: distance }, "held key repeats use the original group offset");
  }
  b("keyup", "ArrowDown"); settle();
  assertMovement({ audience: 8, "brand-mark": -8, brand: -8, promise: -8 }, "key release settles the group");
  assert.equal(stored().slides[0].components.find(item => item.id === "audience").area.row, 49);
  b("press", "Control+z"); settle(); assertMovement({}, "held keys form one undo step");
  b("keydown", "ArrowUp"); settle(); assertMovement({ audience: -8 }, "upward nudge stays held");
  b("focus", ".review-launcher"); b("keyup", "ArrowUp"); settle();
  assertMovement({ audience: -4, "brand-mark": 4, brand: 4, promise: 4 }, "blur releases held keys");
  b("focus", audienceHit); b("press", "Control+z"); settle(); assertMovement({}, "blur preserves undo");

  for (const cancel of ["pointercancel", "lostpointercapture"]) {
    b("eval", "document.addEventListener('pointerdown', event => { window.testPointerId = event.pointerId; }, {once:true, capture:true})");
    drag(audienceHit, 0, 48, (fraction, delta) => {
      if (fraction === .5) {
        assertMovement({ audience: delta.y }, "first move precedes cancellation");
        b("eval", cancel === "pointercancel"
          ? `document.querySelector('${audienceHit}').dispatchEvent(new PointerEvent('pointercancel', {bubbles:true, pointerId:window.testPointerId}))`
          : `document.querySelector('${audienceHit}').releasePointerCapture(window.testPointerId)`);
        // Native capture release is processed before the next pointer event.
        if (cancel === "lostpointercapture") return;
        settle();
      }
      assertMovement({ audience: 12, "brand-mark": -12, brand: -12, promise: -12 }, `${cancel} releases the offset and stops further moves`);
      assert.equal(evaluate("document.querySelector('.group-area-outline') === null"), true);
    });
    assert.equal(stored().slides[0].components.find(item => item.id === "audience").area.row, 50);
    b("press", "Control+z"); settle(); assertMovement({}, `${cancel} preserves undo`);
  }

  b("click", ".component-hit[data-component=brand-mark]");
  drag(".resize-se", 0, 16, () => assertMovement({}, "resize keeps all origins fixed until drop"));
  assert.equal(stored().slides[0].components.find(item => item.id === "brand-mark").area.rows, 10);
  assertGroupHits(stored());
  b("press", "Control+z"); settle(); assertMovement({}, "resize undo restores the stack");
  b("focus", ".resize-se"); b("keydown", "ArrowDown"); settle();
  assertMovement({}, "keyboard resize also holds the offset");
  b("keyup", "ArrowDown"); assertGroupHits(stored());
  b("press", "Control+z"); settle(); assertMovement({}, "keyboard resize undo restores the stack");

  const brandHit = ".component-hit[data-component=brand]";
  b("focus", brandHit); b("press", "ArrowDown");
  assert.equal(stored().slides[0].components.find(item => item.id === "brand").area.row, 24, "group nudge changes authored row by exactly one");
  drag(brandHit, 0, 16);
  const movedCover = stored();
  assert.equal(movedCover.slides[0].components.find(item => item.id === "brand").area.row, 26, "multi-move drag does not accumulate the group offset");
  assertGroupHits(movedCover);
  b("press", "Control+z"); b("press", "Control+z");
  assertGroupHits(stored());
  b("click", brandHit);
  capture("centered-cover-editor");

  assert.equal(stored().slides[0].components.find(item => item.id === "brand-mark").customVisual.alignment, "start");
  for (const [alignment, x] of [["center", 286], ["end", 524], ["start", 48]]) {
    const aligned = stored();
    aligned.slides[0].components.find(item => item.id === "brand-mark").customVisual.alignment = alignment;
    importDocument(aligned);
    assert.equal(stored().slides[0].components.find(item => item.id === "brand-mark").customVisual.alignment, alignment);
    settle();
    assert.equal(evaluate("document.querySelector('[data-vector-element=mark-silhouette] path').transform.baseVal.consolidate().matrix.e"), x,
      "artwork uses the selected fit alignment, not a new authored area");
    assertGroupHits(stored());
    if (alignment === "end") capture("right-aligned-artwork");
  }
  b("focus", ".component-hit[data-component=brand-mark]"); b("press", "Control+z");
  assert.equal(stored().slides[0].components.find(item => item.id === "brand-mark").customVisual.alignment, "end");
  b("press", "Control+Shift+z");
  assert.equal(stored().slides[0].components.find(item => item.id === "brand-mark").customVisual.alignment, "start");
  capture("left-aligned-artwork");

  const replacement = stored();
  replacement.title = "Source replaced during drag";
  const replacementBrand = replacement.slides[0].components.find(item => item.id === "brand");
  replacementBrand.content = "Newer source";
  replacementBrand.area.row += 1;
  drag(brandHit, 0, 48, fraction => { if (fraction === .5) importDocument(replacement); });
  assert.deepEqual(stored(), replacement, "a stale drag cannot overwrite imported geometry or text");
  assert.equal(evaluate("[...document.querySelectorAll('.component-hit')].every(hit=>!hit.style.translate)"), true);
  assertGroupHits(replacement);

  const legacy = initialDraft(true);
  assert.equal(parseCompositionJSON(JSON.stringify(legacy)).ok, false, "v1 documents are rejected rather than edited");
  assert.equal(parseCompositionJSON(JSON.stringify({ ...document, schema: "v2" })).ok, false, "schema aliases are rejected");
  console.log("PASS lowered scene metadata, paint-order hits, keyboard/drag/undo, text corrections, vector-to-comment interaction, authored theme rendering, exact 2x PNG, centered placement, refined source import, held group offsets through drag/resize/key repeats, release/cancel/blur, authored artwork alignment/undo, and v2-only validation");
} finally {
  try { b("close"); } finally { rmSync(scratch, { recursive: true, force: true }); }
}
