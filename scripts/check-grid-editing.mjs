// End-to-end checks for the lowered scene canvas. The fixture intentionally has
// no authored transform attributes: all fitting must come from scene lowering.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { addComponent, initialDraft, initialGridDraft, parseCompositionJSON } from "../composition/document.ts";
import { pixelPage, toComposition } from "../composition/grid.ts";
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

function importDocument(document, validate = true) {
  if (validate) assertComposition(document);
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
  b("open", new URL("legacy.html", base).href); b("set", "viewport", "1600", "1000", "2"); b("wait", ".scene-canvas");
  // A fresh v2 draft is intentionally blank; import content before querying it.
  const legacyDocument = toComposition(addComponent(addComponent(initialGridDraft(), "text-block"), "image"));
  const legacyPage = legacyDocument.pages[0];
  legacyPage.grid = { preset: "presentation" }; delete legacyPage.preset; delete legacyPage.canvas; delete legacyPage.innerPadding;
  legacyDocument.title = "Legacy grid import regression";
  const [legacyText, legacyVector] = legacyDocument.pages[0].components;
  delete legacyText.rect; delete legacyVector.rect;
  legacyText.area = { column: 7, span: 4, row: 8, rows: 18 }; legacyText.content = "Editable baseline text"; legacyText.padding = 1;
  legacyText.textStyle = { step: "body" };
  legacyVector.area = { ...legacyText.area }; legacyVector.padding = 1;
  const expectedPixels = { ...legacyDocument, pages: legacyDocument.pages.map(pixelPage) };
  const { pages, ...legacyEnvelope } = legacyDocument;
  importDocument({ ...legacyEnvelope, slides: pages.map(page => ({ ...page,
    components: page.components.map(component => ({ ...component, intent: "Old instruction must disappear" })) })) });
  assert.deepEqual(stored(), expectedPixels, "legacy slides/grid import saves pages/pixels without intent");
  capture("legacy-import");
  const document = stored(); document.title = "Lowered scene editing regression";
  const [text, vector] = document.pages[0].components;
  text.rect.x += .25; // Existing fractional source geometry must survive corrections.
  text.content = "Editable baseline text"; text.padding = 1;
  vector.customVisual = { format: "vector", description: "Line and editable label", viewBox: { x: 0, y: 0, width: 400, height: 200 }, elements: [
    { id: "panel", kind: "rect", attributes: { x: 0, y: 0, width: 400, height: 200, fill: "theme:wash" } },
    { id: "route", kind: "line", attributes: { x1: 35, y1: 45, x2: 350, y2: 145, stroke: "theme:accent", "stroke-width": 6 } },
    { id: "label", kind: "text", text: "Editable vector label", attributes: { x: 35, y: 105, fill: "theme:ink", "font-size": "scale:heading" } },
  ] };
  // Components are deliberately not in paint order. The overlapping text must
  // be the frontmost hit target because paintOrder, not array order, owns stack.
  document.pages[0].paintOrder = [vector.id, text.id];
  importDocument(document);

  assert.deepEqual(evaluate("[...document.querySelectorAll('.component-hit')].map(node=>node.dataset.component)"), [vector.id, text.id]);
  assert.ok(evaluate("document.querySelectorAll('[data-scene-item]').length") >= 4, "lowered SVG exposes scene metadata");
  assert.ok(evaluate("[...document.querySelectorAll('[data-line-start]')].every(node=>node.hasAttribute('data-baseline')&&node.hasAttribute('data-line-end'))"), "text outlines retain baseline metadata");
  assert.equal(evaluate("document.querySelector('.scene-artwork svg text') === null"), true, "scene text is shaped to paths");

  const hit = `.component-hit[data-component='${text.id}']`;
  b("focus", hit); b("press", "ArrowDown");
  assert.equal(stored().pages[0].components.find(item=>item.id===text.id).rect.y, text.rect.y + 1, "arrow key nudges exactly one page pixel");
  assert.equal(stored().pages[0].components.find(item=>item.id===text.id).rect.x, text.rect.x, "nudge retains fractional source geometry");
  b("press", "Control+z"); assert.deepEqual(stored().pages[0].components.find(item=>item.id===text.id).rect, text.rect);
  b("press", "Control+Shift+z"); assert.equal(stored().pages[0].components.find(item=>item.id===text.id).rect.y, text.rect.y + 1);
  drag(hit, 170, 24);
  assert.deepEqual(stored().pages[0].components.find(item=>item.id===text.id).rect,
    { ...text.rect, x: text.rect.x + 170, y: text.rect.y + 25 }, "free drag persists exact independent pixel deltas");
  const beforeComments = stored();
  b("dblclick", hit); b("wait", "#revision-note");
  assert.equal(evaluate("document.activeElement?.id"), "revision-note", "native text opens a focused comment composer");
  assert.equal(evaluate("document.querySelector('.scene-canvas textarea, .scene-canvas [contenteditable]') === null"), true);
  b("fill", "#revision-note", "Please revise the wording.");
  capture("native-text-comment"); b("press", "Escape");
  b("focus", hit); b("press", "Enter");
  assert.equal(evaluate("document.querySelector('#revision-note').value"), "Please revise the wording.", "Enter reopens the same component's comment draft");
  b("click", "button[aria-label='Add comment']"); b("press", "Escape");
  const nativeNote = evaluate("JSON.parse(localStorage.getItem('konpeki-composer/v1')).review.notes.at(-1)");
  assert.equal(nativeNote.slideId, document.pages[0].id);
  assert.equal(nativeNote.componentId, text.id, "double-click must not bubble into a page comment");

  // Vector and native text share the same comment interaction.
  b("focus", `.component-hit[data-component='${vector.id}']`); b("press", "Enter");
  assert.equal(evaluate("document.activeElement?.id"), "revision-note");
  assert.equal(evaluate("document.querySelector('.line-handles, .vector-attributes, .scene-text-editor') === null"), true);
  assert.equal(evaluate("document.querySelector('#revision-note').value"), "", "different components have separate drafts");
  b("fill", "#revision-note", "Please revise the vector label.");
  capture("scene-interactions");
  b("click", "button[aria-label='Add comment']"); b("press", "Escape");
  assert.equal(evaluate("JSON.parse(localStorage.getItem('konpeki-composer/v1')).review.notes.at(-1).componentId"), vector.id);
  assert.deepEqual(stored(), beforeComments, "commenting never mutates native content, vector text, or geometry");

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
  const second = structuredClone(deck.pages[0]);
  second.id = "different-clips"; second.name = "Different clips";
  second.components[0].rect = { ...second.components[0].rect, x: 72, y: 540, width: 426, height: 144 };
  deck.pages.push(second);
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
  assert.equal(stored().pages[1].components[0].rect.y, 541);
  assert.deepEqual(stored().pages[0], deck.pages[0], "same ID on another page is untouched");
  b("press", "Delete");
  assert.equal(stored().pages[1].components.length, 1);
  assert.equal(stored().pages[0].components.length, 2);
  b("press", "Control+z"); b("press", "Control+z");
  assert.deepEqual(stored().pages, deck.pages, "undo restores the correct page");
  capture("all-pages-corrections");

  // Print pages retain their dimensions on a scrollable canvas.
  const print = toComposition(addComponent(initialGridDraft(), "text-block"));
  print.title = "A4 viewport regression";
  print.pages[0] = pixelPage({ ...print.pages[0], grid: { preset: "a4", revision: 2 },
    components: print.pages[0].components.map(component => ({ ...component, area: { column: 1, span: 12, row: 1, rows: 12 } })) });
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
  mixed.pages.push({ ...structuredClone(print.pages[0]), id: "portrait" });
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

  importDocument(expectedPixels);
  const geometry = () => evaluate("[...document.querySelectorAll('.component-hit')].map(node=>[node.dataset.component,node.style.left,node.style.top,node.style.width,node.style.height])");
  const beforeUpgrade = geometry();
  assert.equal(stored().pages[0].grid, undefined);
  assert.deepEqual(stored().pages[0].components[0].rect, expectedPixels.pages[0].components[0].rect);
  assert.deepEqual(geometry(), beforeUpgrade, "importing a legacy grid document preserves pixel hit boxes");
  assert.equal(evaluate("[...document.querySelectorAll('button')].some(node=>node.textContent==='Use finer grid')"), false);
  b("press", "Control+z");
  assert.equal(stored().title, "Lowered scene editing regression", "pixel migration import remains one undoable source replacement");
  b("press", "Control+Shift+z");
  assert.equal(stored().pages[0].grid, undefined);
  assert.deepEqual(geometry(), beforeUpgrade);
  capture("legacy-grid-import");
  b("focus", hit); b("press", "ArrowRight");
  assert.equal(stored().pages[0].components[0].rect.x, expectedPixels.pages[0].components[0].rect.x + 1);
  const newLeft = Number.parseFloat(geometry().find(item=>item[0]===text.id)[1]);
  const oldLeft = Number.parseFloat(beforeUpgrade.find(item=>item[0]===text.id)[1]);
  assert.ok(Math.abs((newLeft-oldLeft)*1920/100-1)<.001, "horizontal nudge is exactly one page pixel");
  b("press", "Control+z");
  assert.deepEqual(stored().pages[0].components[0].rect, expectedPixels.pages[0].components[0].rect, "undo restores imported placement");

  const beforeSquare = stored();
  b("focus", hit); b("press", "Space");
  b("focus", ".resize-se"); b("press", "ArrowRight"); b("press", "ArrowDown");
  assert.deepEqual(stored().pages[0].components[0].rect, { ...expectedPixels.pages[0].components[0].rect, width: expectedPixels.pages[0].components[0].rect.width + 1, height: expectedPixels.pages[0].components[0].rect.height + 1 }, "keyboard resize uses one-pixel steps");
  b("press", "Control+z"); b("press", "Control+z"); assert.deepEqual(stored(), beforeSquare);
  b("reload"); b("wait", ".scene-artwork svg:not([aria-busy])"); settle();
  assert.equal(stored().pages[0].grid, undefined, "reload retains pixel state");
  assert.deepEqual(geometry(), beforeUpgrade);

  const centered = structuredClone(expectedPixels);
  centered.title = "Centered placement editing regression";
  const block = centered.pages[0].components[0];
  centered.pages[0].components = [block]; centered.pages[0].paintOrder = [block.id];
  centered.pages[0].readingOrder = [{ kind: "component", id: block.id }];
  centered.pages[0].contentSlots = centered.pages[0].contentSlots.filter(slot => block.slotIds.includes(slot.id));
  block.rect = { x: 672, y: 480, width: 576, height: 120 };
  block.content = "Konpeki"; block.textStyle = { step: "title" };
  block.appearance.alignment = "center";
  importDocument(centered);
  const centeredHit = `.component-hit[data-component='${block.id}']`;
  b("click", centeredHit);
  b("wait", "--fn", "getComputedStyle(document.querySelector('.component-hit.selected')).backgroundColor === 'rgba(0, 0, 0, 0)'");
  assert.equal(evaluate("document.querySelector('select, input[name=span]') === null"), true, "placement controls are not design forms");
  assert.deepEqual(stored().pages[0].components[0].rect, block.rect);
  b("focus", centeredHit); b("press", "ArrowDown");
  assert.deepEqual(stored().pages[0].components[0].rect, { ...block.rect, y: block.rect.y + 1 });
  capture("centered-text-correction");

  const cover = JSON.parse(readFileSync(new URL("../composition/fixtures/github-cover/composition.json", import.meta.url), "utf8"));
  importDocument(cover);
  assert.equal(stored().pages[0].preset, "link");
  capture("fine-grid-cover");
  const fonts = await loadNodeFontContext(new URL("../fonts/", import.meta.url));
  const assertGroupHits = current => {
    settle();
    const expected = lowerPage(current, current.pages[0], fonts);
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
  assert.equal(stored().pages[0].components.find(item => item.id === "audience").rect.y, 467);
  assertMovement({ audience: 24, "brand-mark": -24, brand: -24, promise: -24 }, "group settles once on drop");
  assert.equal(evaluate("document.querySelector('.group-area-outline') === null"), true);
  assertGroupHits(stored()); capture("group-offset-settled");
  b("press", "Control+z"); settle(); assertMovement({}, "one undo restores the whole gesture");

  b("focus", audienceHit);
  for (const distance of [1, 2]) {
    b("keydown", "ArrowDown"); settle();
    assertMovement({ audience: distance }, "held key repeats use the original group offset");
  }
  b("keyup", "ArrowDown"); settle();
  assertMovement({ audience: 1, "brand-mark": -1, brand: -1, promise: -1 }, "key release settles the one-pixel correction");
  assert.equal(stored().pages[0].components.find(item => item.id === "audience").rect.y, 421, "two held repeats retain both one-pixel source edits");
  b("press", "Control+z"); settle(); assertMovement({}, "held keys form one undo step");
  b("keydown", "ArrowUp"); settle(); assertMovement({ audience: -1 }, "upward nudge stays held");
  b("focus", ".review-launcher"); b("keyup", "ArrowUp"); settle();
  assertMovement({ audience: -.5, "brand-mark": .5, brand: .5, promise: .5 }, "blur recenters the group after a one-pixel edge move");
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
    assert.equal(stored().pages[0].components.find(item => item.id === "audience").rect.y, 443);
    b("press", "Control+z"); settle(); assertMovement({}, `${cancel} preserves undo`);
  }

  b("click", ".component-hit[data-component=brand-mark]");
  drag(".resize-se", 0, 16, () => assertMovement({}, "resize keeps all origins fixed until drop"));
  assert.equal(stored().pages[0].components.find(item => item.id === "brand-mark").rect.height, 80);
  assertGroupHits(stored());
  b("press", "Control+z"); settle(); assertMovement({}, "resize undo restores the stack");
  b("focus", ".resize-se"); b("keydown", "ArrowDown"); settle();
  assertMovement({}, "keyboard resize also holds the offset");
  b("keyup", "ArrowDown"); assertGroupHits(stored());
  b("press", "Control+z"); settle(); assertMovement({}, "keyboard resize undo restores the stack");

  const brandHit = ".component-hit[data-component=brand]";
  b("focus", brandHit); b("press", "ArrowDown");
  assert.equal(stored().pages[0].components.find(item => item.id === "brand").rect.y, 228, "group nudge changes authored y by exactly one pixel");
  drag(brandHit, 0, 16);
  const movedCover = stored();
  assert.equal(movedCover.pages[0].components.find(item => item.id === "brand").rect.y, 244, "multi-move drag does not accumulate the group offset");
  assertGroupHits(movedCover);
  b("press", "Control+z"); b("press", "Control+z");
  assertGroupHits(stored());
  b("click", brandHit);
  capture("centered-cover-editor");

  assert.equal(stored().pages[0].components.find(item => item.id === "brand-mark").customVisual.alignment, "start");
  for (const [alignment, x] of [["center", 286], ["end", 524], ["start", 48]]) {
    const aligned = stored();
    aligned.pages[0].components.find(item => item.id === "brand-mark").customVisual.alignment = alignment;
    importDocument(aligned);
    assert.equal(stored().pages[0].components.find(item => item.id === "brand-mark").customVisual.alignment, alignment);
    settle();
    assert.equal(evaluate("document.querySelector('[data-vector-element=mark-silhouette] path').transform.baseVal.consolidate().matrix.e"), x,
      "artwork uses the selected fit alignment, not a new authored area");
    assertGroupHits(stored());
    if (alignment === "end") capture("right-aligned-artwork");
  }
  b("focus", ".component-hit[data-component=brand-mark]"); b("press", "Control+z");
  assert.equal(stored().pages[0].components.find(item => item.id === "brand-mark").customVisual.alignment, "end");
  b("press", "Control+Shift+z");
  assert.equal(stored().pages[0].components.find(item => item.id === "brand-mark").customVisual.alignment, "start");
  capture("left-aligned-artwork");

  const replacement = stored();
  replacement.title = "Source replaced during drag";
  const replacementBrand = replacement.pages[0].components.find(item => item.id === "brand");
  replacementBrand.content = "Newer source";
  replacementBrand.rect.y += 1;
  drag(brandHit, 0, 48, fraction => { if (fraction === .5) importDocument(replacement); });
  assert.deepEqual(stored(), replacement, "a stale drag cannot overwrite imported geometry or text");
  assert.equal(evaluate("[...document.querySelectorAll('.component-hit')].every(hit=>!hit.style.translate)"), true);
  assertGroupHits(replacement);

  const prose = toComposition(addComponent(initialGridDraft(), "text-block"));
  prose.title = "Content-sized text revisions";
  const prosePage = prose.pages[0], paragraph = prosePage.components[0];
  prosePage.preset = "a4"; prosePage.canvas = { width: 210 / 25.4 * 96, height: 297 / 25.4 * 96 }; prosePage.contentSlots = [];
  delete paragraph.rect; paragraph.slotIds = []; paragraph.content = "First\nSecond\nThird";
  paragraph.appearance = { role: "body" }; paragraph.textStyle = { step: "body" };
  prosePage.components = [paragraph, { ...structuredClone(paragraph), id: "following", content: "Following paragraph" }];
  prosePage.groups = [{ id: "prose", layout: "stack", rect: { x: 186.67, y: 72, width: 550, height: 920 }, childIds: [paragraph.id, "following"] }];
  prosePage.paintOrder = ["following", paragraph.id];
  prosePage.readingOrder = [{ kind: "group", id: "prose" }];
  importDocument(prose);
  const flowHit = `.component-hit[data-component="${paragraph.id}"]`;
  const flowBox = id => evaluate(`(() => {
    const hit=document.querySelector('.component-hit[data-component="'+${JSON.stringify(id)}+'"]');
    const view=document.querySelector('.scene-artwork svg').viewBox.baseVal;
    return {x:parseFloat(hit.style.left)*view.width/100,y:parseFloat(hit.style.top)*view.height/100,
      width:parseFloat(hit.style.width)*view.width/100,height:parseFloat(hit.style.height)*view.height/100};
  })()`);
  const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < .01, `${actual} ≠ ${expected}`);
  const firstBox = flowBox(paragraph.id), followingBox = flowBox("following");
  closeTo(firstBox.height, 60); closeTo(followingBox.y - firstBox.y, 70);
  b("focus", flowHit); b("press", "ArrowDown"); settle();
  assert.deepEqual(stored().pages[0].components.find(c => c.id === paragraph.id).flow.offset, { x: 0, y: 1 });
  closeTo(flowBox(paragraph.id).y, firstBox.y + 1);
  closeTo(flowBox("following").y, followingBox.y);
  assert.equal(evaluate("document.querySelectorAll('.resize-handle').length"), 0, "flow text has no fixed-height handles");
  const revisedProse = stored();
  revisedProse.pages[0].components.find(c => c.id === paragraph.id).content = "First\nSecond\nThird\nFourth";
  importDocument(revisedProse);
  assert.equal(stored().pages[0].components.find(c => c.id === paragraph.id).content, "First\nSecond\nThird\nFourth");
  closeTo(flowBox(paragraph.id).height, 80); closeTo(flowBox("following").y, followingBox.y + 20);
  b("click", flowHit); b("press", "Delete"); settle();
  assert.equal(stored().pages[0].components.length, 1);
  closeTo(flowBox("following").y, firstBox.y);
  b("press", "Control+z"); settle();
  assert.equal(stored().pages[0].components.length, 2);
  closeTo(flowBox(paragraph.id).height, 80); closeTo(flowBox(paragraph.id).y, firstBox.y + 1);
  drag(flowHit, 8, 12);
  const movedFlow = stored().pages[0].components.find(c => c.id === paragraph.id);
  assert.deepEqual(movedFlow.flow.offset, { x: 8, y: 13 });
  assert.equal(movedFlow.area, undefined);
  closeTo(flowBox(paragraph.id).x, firstBox.x + 8); closeTo(flowBox(paragraph.id).y, firstBox.y + 13);
  b("press", "Control+z"); stored(); settle();
  closeTo(flowBox(paragraph.id).x, firstBox.x);
  b("click", ".review-launcher"); b("click", ".component-hit[data-component=following]"); b("fill", "#revision-note", "Review this flowing paragraph");
  b("click", "button[aria-label='Add comment']"); b("click", ".review-launcher");
  b("wait", ".revision-pin");
  assert.equal(evaluate("document.querySelector('.revision-pin').dataset.component"), "following");
  const pinnedTop = evaluate("document.querySelector('.revision-pin').getBoundingClientRect().top");
  const flowScale = evaluate("document.querySelector('.scene-canvas').getBoundingClientRect().width/document.querySelector('.scene-artwork svg').viewBox.baseVal.width");
  // Load revised source with an existing local review: pins follow measured
  // reflow, rather than retaining the old paragraph's position.
  b("eval", `(() => { const state=JSON.parse(localStorage.getItem('konpeki-composer/v1'));
    state.document.pages[0].components.find(c=>c.id===${JSON.stringify(paragraph.id)}).content=${JSON.stringify("First\nSecond\nThird\nFourth\nFifth")};
    localStorage.setItem('konpeki-composer/v1',JSON.stringify(state)); })()`);
  b("reload"); b("wait", ".revision-pin"); stored(); settle();
  closeTo(flowBox("following").y, followingBox.y + 40);
  assert.ok(Math.abs(evaluate("document.querySelector('.revision-pin').getBoundingClientRect().top") - pinnedTop - 20 * flowScale) < .1);
  capture("flow-text-corrected");

  const free = assertComposition({ schema: "konpeki-composition/v2", title: "Free placement, measured text",
    pages: [{ id: "free", name: "Alignment without a grid", canvas: { width: 1200, height: 800 },
      audience: "Readers", question: "How should text fit?", intendedViewingSize: "custom", components: [
        { id: "auto", kind: "text-block", content: "A measured title\nwith breathing room.",
          rect: { x: 80, y: 160, width: 440 }, padding: 12, textStyle: { size: 28, leading: 36 }, appearance: { role: "body" } },
        { id: "fixed", kind: "text-block", content: "A fixed-height box\nwith no added padding.",
          rect: { x: 80, y: 430, width: 260, height: 96 }, textStyle: { size: 24, leading: 32 }, appearance: { role: "body" } },
      ] }],
  });
  importDocument(free);
  const autoHit = '.component-hit[data-component="auto"]';
  closeTo(flowBox("auto").height, 96); // two 36px lines, 12px padding on each side
  b("click", autoHit); b("press", "ArrowRight"); b("press", "ArrowDown");
  assert.deepEqual(stored().pages[0].components[0].rect, { x: 81, y: 161, width: 440 });
  b("press", "Control+z"); b("press", "Control+z");
  let movedBy;
  drag(autoHit, 300, 270, (fraction, delta) => {
    if (fraction !== 1) return;
    movedBy = delta;
    const guides = evaluate("[...document.querySelectorAll('.guide')].map(g=>({axis:g.classList.contains('guide-x')?'x':'y',value:parseFloat(g.style.left||g.style.top)}))");
    assert.deepEqual(guides, [{ axis: "x", value: 50 }, { axis: "y", value: 53.75 }]);
    assert.deepEqual(stored().pages[0].components[0].rect, free.pages[0].components[0].rect, "guides never commit source during preview");
    capture("pixel-alignment-guides");
  });
  assert.deepEqual(stored().pages[0].components[0].rect,
    { x: 80 + Math.round(movedBy.x), y: 160 + Math.round(movedBy.y), width: 440 });
  assert.equal(evaluate("document.querySelectorAll('.guide').length"), 0, "reference lines disappear on release");
  b("press", "Control+z");
  // agent-browser mouse commands omit held modifiers; decorate the real down.
  b("eval", "document.addEventListener('pointerdown',event=>Object.defineProperty(event,'altKey',{value:true}),{capture:true,once:true})");
  drag(autoHit, 100, 20);
  const duplicated = stored().pages[0].components.find(c => c.id === "auto-copy");
  assert.ok(duplicated, "Alt-drag creates a copy");
  assert.equal(duplicated.rect.height, undefined, "Alt-drag retains measured text height");
  b("press", "Control+z");
  assert.equal(stored().pages[0].components.length, 2);
  const revisedFree = stored();
  revisedFree.pages[0].components[0].content = "A measured title\nwith breathing room.\nA third line.";
  importDocument(revisedFree);
  closeTo(flowBox("auto").height, 132);
  assert.equal(stored().pages[0].components[0].rect.height, undefined);
  b("click", autoHit);
  drag(".resize-se", -250, 0, () => {
    assert.equal(stored().pages[0].components[0].rect.height, undefined, "repeated horizontal resize events must not fix measured height");
  });
  assert.ok(flowBox("auto").height > 132, "a narrower box rewraps and grows");
  b("focus", ".resize-se");
  const measuredHeight = flowBox("auto").height;
  b("press", "ArrowDown");
  closeTo(stored().pages[0].components[0].rect.height, measuredHeight + 1);
  b("press", "Control+z");
  assert.equal(stored().pages[0].components[0].rect.height, undefined, "undo restores automatic height");
  capture("pixel-measured-text");

  for (const [preset, margin, width] of [[undefined, 72, 1200], ["presentation", 72, 1920], ["a4", 56, 210 / 25.4 * 96]]) {
    const margins = structuredClone(free);
    margins.title = `Implicit ${preset ?? "canvas-only"} margins`;
    if (preset) { margins.pages[0].preset = preset; delete margins.pages[0].canvas; }
    importDocument(margins);
    drag(autoHit, margin - 80, 0, fraction => {
      if (fraction !== 1) return;
      const value = evaluate("parseFloat(document.querySelector('.guide-x')?.style.left)");
      closeTo(value * width / 100, margin);
      if (preset === "a4") capture("a4-margin-guide");
    });
    assert.equal(stored().pages[0].innerPadding, undefined, "guide defaults do not become authored margins");
  }

  const alignedText = structuredClone(free);
  alignedText.title = "Identical centering, automatic and fixed height";
  const [automatic, fixed] = alignedText.pages[0].components;
  automatic.appearance.verticalAlignment = "center";
  fixed.content = automatic.content; fixed.appearance = structuredClone(automatic.appearance);
  fixed.padding = automatic.padding; fixed.textStyle = structuredClone(automatic.textStyle);
  fixed.rect = { x: 660, y: 160, width: 440, height: 96 };
  importDocument(alignedText);
  const inkTop = id => evaluate(`document.querySelector('.scene-artwork [data-component="'+${JSON.stringify(id)}+'"]').getBoundingClientRect().top`);
  closeTo(inkTop("auto"), inkTop("fixed"));
  b("click", autoHit); capture("centered-auto-and-fixed-text");

  const thin = structuredClone(free);
  thin.title = "Subpixel correction geometry";
  thin.pages[0].components = [{ id: "hairline", kind: "image", appearance: {}, slotIds: [],
    rect: { x: 100.25, y: 170.5, width: .5, height: 40 }, customVisual: { format: "vector", description: "Thin rule",
      viewBox: { x: 0, y: 0, width: .5, height: 40 }, elements: [{ id: "rule", kind: "rect", attributes: { x: 0, y: 0, width: .5, height: 40, fill: "theme:ink" } }] } }];
  thin.pages[0].paintOrder = ["hairline"]; thin.pages[0].readingOrder = [{ kind: "component", id: "hairline" }];
  importDocument(thin);
  const thinHit = '.component-hit[data-component="hairline"]';
  b("focus", thinHit); b("press", "Space"); b("press", "ArrowRight");
  assert.deepEqual(stored().pages[0].components[0].rect, { x: 101.25, y: 170.5, width: .5, height: 40 });
  b("focus", ".resize-se"); b("press", "ArrowDown");
  assert.deepEqual(stored().pages[0].components[0].rect, { x: 101.25, y: 170.5, width: .5, height: 41 });
  b("press", "Control+z"); b("press", "Control+z");
  assert.deepEqual(stored().pages[0].components[0].rect, thin.pages[0].components[0].rect);

  const legacy = { ...initialDraft(true), schema: "konpeki-composition/v1" };
  assert.equal(parseCompositionJSON(JSON.stringify(legacy)).ok, false, "v1 documents are rejected rather than edited");
  assert.equal(parseCompositionJSON(JSON.stringify({ ...document, schema: "v2" })).ok, false, "schema aliases are rejected");
  console.log("PASS lowered scene metadata, paint-order hits, keyboard/drag/undo, native/vector text comments without content mutation, authored theme rendering, exact 2x PNG, centered placement, refined source import, held group offsets through drag/resize/key repeats, release/cancel/blur, authored artwork alignment/undo, content-sized flow/source-reflow/delete/undo/offsets/comment pins, and v2-only validation");
} finally {
  try { b("close"); } finally { rmSync(scratch, { recursive: true, force: true }); }
}
