// Requires the development server and the external agent-browser CLI.
// Uses its own browser session; never touches a person's browser storage.
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseEditableSvg } from "../composition/vector.ts";
import { assertComposition } from "../composition/validate.ts";

const url = process.argv[2] ?? "http://localhost:4318";
const artifacts = resolve(process.argv[3] ?? ".amp/in/artifacts");
const scratch = mkdtempSync(join(tmpdir(), "konpeki-check-"));
mkdirSync(artifacts, { recursive: true });
function browser(...args) {
  return execFileSync("agent-browser", ["--session", "canvas-check", ...args], { encoding: "utf8" }).trim();
}
function evaluate(source) { return browser("eval", source); }
function click(name) { browser("find", "role", "button", "click", "--name", name, "--exact"); }
function check(source, message) { evaluate(`if (!(${source})) throw Error(${JSON.stringify(message)})`); }
function openDocument(file) {
  const json = readFileSync(file, "utf8");
  evaluate(`(() => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([${JSON.stringify(json)}], "composition.json", { type: "application/json" }));
    document.querySelector(".workspace").dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
  })()`);
  const expected = JSON.stringify(assertComposition(JSON.parse(json)));
  browser("wait", "--fn", `localStorage.getItem("konpeki-composer/v1") === JSON.stringify({version: 2, document: ${expected}})`);
}
function capture(name) {
  evaluate("document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))");
  browser("screenshot", join(artifacts, `${name}.png`));
}
function checkDoubleClickEditing(cases) {
  for (const [index, [kind]] of cases.entries()) {
    click(`Page ${String(index + 2).padStart(2, "0")}`);
    const before = JSON.parse(JSON.parse(evaluate('localStorage.getItem("konpeki-composer/v1")'))).document;
    browser("dblclick", "#canvas-stage .component-surface");
    const field = kind === "Text block" ? "content" : "intent";
    check(`document.activeElement.matches('.inline-intent-editor') && document.activeElement.getAttribute('aria-label').endsWith(${JSON.stringify(field === "content" ? "text" : "intent")})`, `${kind} double-click opened wrong editor`);
    browser("fill", ".inline-intent-editor", `Edited ${kind}`);
    browser("press", "Escape");
    browser("wait", "--fn", `JSON.parse(localStorage.getItem("konpeki-composer/v1")).document.slides[${index + 1}].components[0][${JSON.stringify(field)}] === ${JSON.stringify(`Edited ${kind}`)}`);
    before.slides[index + 1].components[0][field] = `Edited ${kind}`;
    assert.deepEqual(JSON.parse(JSON.parse(evaluate('localStorage.getItem("konpeki-composer/v1")'))).document, before, `${kind} inline edit changed unrelated content or artwork`);
  }
}
function chartPreviewColors() {
  return JSON.parse(evaluate(`(() => {
    const preview = value => document.querySelector('.chart-type-field [data-value="' + value + '"]');
    const line = getComputedStyle(preview('line'), '::before');
    const pie = getComputedStyle(preview('pie'), '::before');
    const bar = getComputedStyle(preview('grouped-bar').querySelector('i:nth-child(2)'));
    const scatter = getComputedStyle(preview('scatter').querySelector('circle'));
    const sankey = getComputedStyle(preview('sankey').querySelector('rect'));
    if (line.borderTopWidth !== '2px' || line.borderTopColor === 'rgba(0, 0, 0, 0)' || pie.backgroundImage === 'none' || bar.backgroundColor === 'rgba(0, 0, 0, 0)') throw Error('Chart preview palette missing');
    if (scatter.fill !== bar.backgroundColor || sankey.fill !== bar.backgroundColor) throw Error('Scatter and Sankey must retain the chart accent color');
    return { line: line.borderTopColor, pie: pie.backgroundImage, bar: bar.backgroundColor, scatter: scatter.fill, sankey: sankey.fill };
  })()`));
}
try {
  browser("open", url);
  evaluate('localStorage.removeItem("konpeki-composer/v1")');
  browser("reload");
  browser("wait", "--text", "Page 01");
  browser("set", "viewport", "1440", "900", "2");
  check(`[...document.querySelectorAll('button,input,textarea,select')].filter(element => element.checkVisibility()).every(element => {
    const rect = element.getBoundingClientRect();
    return rect.width >= 40 && rect.height >= 40;
  })`, "visible controls must have at least 40 by 40 pixel targets");
  check(`(() => {
    const icon = document.querySelector('.component-dock button[title="Add or select Diagram"] svg');
    const target = icon.querySelectorAll('rect')[1];
    return icon.querySelector('path').isPointInStroke(new DOMPoint(target.x.baseVal.value + target.width.baseVal.value / 2, target.y.baseVal.value));
  })()`, "Diagram arrow must touch the top center of its destination square");
  browser("set", "viewport", "1000", "700", "2");
  browser("wait", "--fn", "document.querySelector('.right-panel').classList.contains('collapsed')");
  evaluate("Promise.all(document.querySelector('.stage').getAnimations().map(animation => animation.finished))");
  check("document.querySelector('.slide-wrap').getBoundingClientRect().width >= 600", "canvas became too small at 1000px");
  browser("set", "viewport", "800", "700", "2");
  browser("wait", "--fn", "document.querySelector('.left-panel').classList.contains('collapsed')");
  evaluate("Promise.all(document.querySelector('.stage').getAnimations().map(animation => animation.finished))");
  check("document.querySelector('.slide-wrap').getBoundingClientRect().width >= 700", "canvas became too small at 800px");
  browser("set", "viewport", "390", "700", "2");
  check(`document.documentElement.scrollWidth === 390 && (() => {
    const dock = document.querySelector('.component-dock').getBoundingClientRect();
    return dock.left >= 0 && dock.right <= innerWidth;
  })()`, "compact layout overflows horizontally");
  browser("set", "viewport", "1440", "900", "2");
  browser("wait", "--fn", "!document.querySelector('.left-panel').classList.contains('collapsed') && !document.querySelector('.right-panel').classList.contains('collapsed')");
  evaluate("Promise.all(document.querySelector('.left-sidebar').getAnimations().map(animation => animation.finished))");
  click("Add page");
  check('document.querySelectorAll(".slide-thumbnail").length === 2', "Add page must create the second page");
  check('document.querySelectorAll("#canvas-stage [data-component]").length === 0', "new slide is not empty");
  capture("empty-slide");
  const cases = [
    ["Text block", "One canvas for people and agents"],
    ["Diagram", "Draft → Review → Present"],
    ["Chart", "Illustrative workflow comparison"],
    ["Image", "Requested product illustration (draft)"],
    ["Table", "Stage | Owner\nDraft | Human\nRevise | Agent\nApprove | Human"],
  ];
  for (const [index, [kind, intent]] of cases.entries()) {
    if (index) click("Add page");
    click(kind);
    browser("fill", '[name="content-intent"]', intent);
    for (const [key, value] of Object.entries({ x: 160, y: 150, width: 1600, height: 780 })) {
      browser("fill", `[name="${key}"]`, String(value));
    }
    evaluate("document.activeElement.blur()");
    check('document.querySelectorAll("#canvas-stage [data-component]").length === 1', `${kind} creation failed`);
    if (kind === "Text block") {
      check('!document.querySelector(".inspector-content [aria-label=Role]")', "text role picker must be removed");
    }
    if (kind === "Diagram" || kind === "Chart") {
      check('!document.querySelector(".inspector-content [aria-label=Density]")', `${kind} density picker must be removed`);
      check('!document.querySelector(".inspector-content [aria-label=Emphasis]")', `${kind} emphasis picker must be removed`);
      check(`!document.querySelector('.inspector-content [aria-label="Color Scheme"]')`, `${kind} color scheme picker must be removed`);
    }
    if (["Text block", "Diagram", "Chart"].includes(kind)) capture(`simplified-${kind.toLowerCase().replaceAll(" ", "-")}`);
    if (kind === "Diagram") {
      check('document.querySelector(".diagram-type-field").open === false', "diagram catalog should start collapsed");
      check('document.querySelector(".diagram-type-field > summary").textContent === "Template"', "diagram section must be Template");
      check('document.querySelector(".diagram-type-options button.selected").textContent.trim() === "YOLO"', "new diagram must select YOLO tile");
      check('![...document.querySelectorAll(".inspector-content small")].some(el => /Describe the goal|Auto lets the agent/.test(el.textContent))', "removed help text returned");
      check('document.querySelector("[name=content-intent]").closest("label").textContent.includes("What should this explain?")', "diagram goal label missing");
      capture("diagram-intent-first");
      browser("click", ".diagram-type-field > summary");
      check('getComputedStyle(document.querySelector(".diagram-type-options")).overflowY === "visible" && getComputedStyle(document.querySelector(".diagram-type-options")).maxHeight === "none"', "templates must not create a nested scroll area");
      evaluate('[...document.querySelectorAll(".diagram-type-options button")].at(-1).scrollIntoView({block: "center"})');
      check('getComputedStyle(document.querySelector(".inspector-content")).overflowY === "auto" && document.querySelector(".inspector-content").scrollTop > 0', "inspector must own template scrolling");
      click("Sequence");
      check('document.querySelector(".diagram-type-options button.selected").textContent.trim() === "Sequence"', "starting point was not updated");
      check('document.querySelector("[name=content-intent]").value === "Draft → Review → Present"', "preset selection overwrote intent");
      evaluate('document.querySelector(".diagram-type-field > summary").scrollIntoView({block: "center"})');
      capture("diagram-starting-points");
      click("YOLO");
      check('document.querySelectorAll(".diagram-type-options button.selected").length === 1 && document.querySelector(".diagram-type-options button[aria-pressed=true]").textContent.trim() === "YOLO"', "return to YOLO failed");
      evaluate('document.querySelector(".diagram-type-field > summary").scrollIntoView({block: "center"})');
      capture("diagram-auto");
      click("Sequence");
      check('document.querySelectorAll(".diagram-type-options button.selected").length === 1 && document.querySelector(".diagram-type-options button[aria-pressed=true]").textContent.trim() === "Sequence"', "explicit choice not binding");
      evaluate('document.querySelector(".diagram-type-field > summary").scrollIntoView({block: "center"})');
      browser("click", ".diagram-type-field > summary");
    }
    if (kind === "Chart") {
      check('document.querySelector(".chart-type-field > summary").textContent === "Template" && !document.querySelector(".chart-type-field").open', "chart Template section must start collapsed");
      check('document.querySelectorAll(".chart-type-options button").length === 9 && document.querySelector(".chart-type-options button.selected").textContent.trim() === "YOLO"', "new chart must select only the YOLO tile alongside eight templates");
      check('![...document.querySelectorAll(".inspector-content small")].some(el => /Describe the goal|Auto lets the agent/.test(el.textContent))', "removed chart help text returned");
      browser("click", ".chart-type-field > summary");
      check(`[...document.querySelectorAll('.chart-type-options button')].every(button => {
        const icon = button.firstElementChild.getBoundingClientRect();
        const label = button.lastElementChild.getBoundingClientRect();
        return icon.bottom <= label.top && Math.abs((icon.left + icon.right) - (label.left + label.right)) < 2;
      })`, "chart templates must center their icons above labels like diagram templates");
      check('getComputedStyle(document.querySelector(".chart-type-options")).overflowY === "visible" && getComputedStyle(document.querySelector(".chart-type-options")).maxHeight === "none"', "chart templates must not create nested scrolling");
      chartPreviewColors();
      capture("draft-chart-auto");
      browser("focus", '.chart-type-options button:has([data-value="pie"])');
      browser("press", "Enter");
      check('document.querySelectorAll(".chart-type-options button[aria-pressed=true]").length === 1 && document.querySelector(".chart-type-options button.selected").textContent.trim() === "Pie" && document.querySelector(".chart-type-field > summary").textContent === "Template"', "keyboard template selection must exclusively select Pie without changing the section heading");
      click("YOLO");
      browser("wait", "--fn", 'JSON.parse(localStorage.getItem("konpeki-composer/v1")).document.slides[3].components[0].appearance.selection === "auto" && JSON.parse(localStorage.getItem("konpeki-composer/v1")).document.slides[3].components[0].appearance.template === "pie"');
      check('JSON.parse(localStorage.getItem("konpeki-composer/v1")).document.slides[3].components[0].appearance.template === "pie" && document.querySelector("[name=content-intent]").value === "Illustrative workflow comparison" && document.querySelectorAll(".chart-type-options button.selected").length === 1 && document.querySelector(".chart-type-options button.selected").textContent.trim() === "YOLO"', "YOLO must preserve the chart form and intent, and clear the explicit highlight");
      browser("click", ".chart-type-field > summary");
    }
  }
  // Reopen the persisted document through the app's drop handler.
  browser("focus", "#canvas-stage .component-surface");
  browser("press", "Meta+d");
  check('document.querySelectorAll("#canvas-stage [data-component]").length === 2', "Cmd+D must duplicate");
  browser("press", "Control+z");
  const dragStart = JSON.parse(evaluate('(() => {const r=document.querySelector("#canvas-stage .component-surface").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()'));
  browser("mouse", "move", String(Math.round(dragStart.x)), String(Math.round(dragStart.y)));
  // agent-browser mouse commands omit held keyboard modifiers; supply Alt on the next real pointerdown.
  evaluate('document.addEventListener("pointerdown", event => Object.defineProperty(event, "altKey", {value: true}), {capture: true, once: true})');
  browser("mouse", "down", "left");
  browser("mouse", "move", String(Math.round(dragStart.x + 35)), String(Math.round(dragStart.y + 30)));
  browser("mouse", "move", String(Math.round(dragStart.x + 65)), String(Math.round(dragStart.y + 60)));
  browser("mouse", "up", "left");
  check('document.querySelectorAll("#canvas-stage [data-component]").length === 2', "Option-drag must duplicate once");
  browser("press", "Control+z");
  check('document.querySelectorAll("#canvas-stage [data-component]").length === 1', "Option-drag must undo in one step");
  check('![...document.querySelectorAll("button")].some(button => button.textContent.trim() === "Download")', "Download button must be removed");
  click("Collapse left panel");
  browser("wait", "--fn", 'getComputedStyle(document.querySelector(".action-island")).visibility === "hidden"');
  check('document.querySelector(".action-island").inert', "collapsed sidebar must disable actions");
  click("Expand left panel");
  check('!document.querySelector(".action-island").inert', "expanded sidebar must restore actions");
  browser("wait", "--fn", 'JSON.parse(localStorage.getItem("konpeki-composer/v1"))?.document.slides.length === 6');
  const json = JSON.parse(evaluate('JSON.stringify(JSON.parse(localStorage.getItem("konpeki-composer/v1")).document)'));
  const saved = JSON.parse(json);
  assert.equal(saved.slides[2].components[0].appearance.selection, "explicit");
  if (saved.slides.length !== 6) throw Error("Wrong slide count after creation");
  const file = join(scratch, "roundtrip.json");
  writeFileSync(file, json);
  openDocument(file);
  checkDoubleClickEditing(cases);
  openDocument(file);
  browser("reload");
  browser("wait", "--text", "Page 01");
  const stored = JSON.parse(JSON.parse(evaluate('localStorage.getItem("konpeki-composer/v1")'))).document;
  assert.deepEqual(stored, saved, "Save/load changed the composition");
  for (const [index, [kind]] of cases.entries()) {
    click(`Page ${String(index + 2).padStart(2, "0")}`);
    click("Present");
    check('document.querySelectorAll(".presentation [data-component]").length === 1', `${kind} presentation missing`);
    check('!document.querySelector(".presentation .resize-handle")', "Presentation leaked edit handles");
    browser("set", "viewport", "1920", "1080", "2");
    capture(`present-${kind.toLowerCase().replaceAll(" ", "-")}`);
    browser("set", "viewport", "1024", "768", "2");
    capture(`review-${kind.toLowerCase().replaceAll(" ", "-")}`);
    browser("press", "Escape");
  }
  browser("set", "viewport", "1440", "900", "2");
  capture("roundtrip-editor");
  // An agent completes each semantic component without introducing another runtime.
  const artwork = [
    '<text id="headline" x="50" y="110" font-size="52">One canvas, one editable document</text><text x="50" y="195" font-size="28">Human drafts → Agent output → Manual revisions</text>',
    '<g id="stages"><rect x="50" y="100" width="270" height="150" fill="#e1f1f8"/><rect x="450" y="100" width="270" height="150" fill="#e1f1f8"/><rect x="850" y="100" width="270" height="150" fill="#e1f1f8"/><text x="100" y="185" font-size="36">Draft</text><text x="500" y="185" font-size="36">Review</text><text x="900" y="185" font-size="36">Present</text></g><path id="arrows" d="M330 175H435L418 160M435 175L418 190M730 175H835L818 160M835 175L818 190" fill="none" stroke="#007bbb" stroke-width="5"/>',
    '<text x="50" y="70" font-size="36">Illustrative counts, not product measurements</text><path d="M100 120V430H1080" fill="none" stroke="#52666f" stroke-width="3"/><rect x="220" y="230" width="200" height="200" fill="#007bbb"/><rect x="640" y="130" width="200" height="300" fill="#007bbb"/><text x="295" y="210" font-size="30">20</text><text x="715" y="110" font-size="30">30</text><text x="280" y="480" font-size="30">Draft</text><text x="680" y="480" font-size="30">Revised</text>',
    '<text x="50" y="70" font-size="36">Editable product illustration</text><g id="window"><rect x="100" y="110" width="950" height="400" rx="20" fill="#e1f1f8"/><rect x="150" y="170" width="180" height="290" fill="#007bbb"/><rect x="370" y="170" width="630" height="290" fill="#ffffff"/><path d="M420 240H920M420 300H820M420 360H880" stroke="#52666f" stroke-width="14"/></g>',
    '<text x="100" y="100" font-size="38">Stage</text><text x="640" y="100" font-size="38">Owner</text><path d="M80 125H1100M80 240H1100M80 355H1100M80 470H1100" stroke="#52666f" stroke-width="2"/><text x="100" y="205" font-size="32">Draft</text><text x="640" y="205" font-size="32">Human</text><text x="100" y="320" font-size="32">Revise</text><text x="640" y="320" font-size="32">Agent</text><text x="100" y="435" font-size="32">Approve</text><text x="640" y="435" font-size="32">Human</text>',
  ];
  for (const [index, source] of artwork.entries()) {
    saved.slides[index + 1].components[0].customVisual = {
      format: "vector", description: `Completed ${cases[index][0]} test artwork`,
      ...parseEditableSvg(`<svg viewBox="0 0 1200 600" fill="#13242c" font-family="IBM Plex Sans">${source}</svg>`),
    };
  }
  const completed = join(scratch, "completed.json");
  writeFileSync(completed, JSON.stringify(saved));
  openDocument(completed);
  checkDoubleClickEditing(cases);
  openDocument(completed);
  console.log("PASS: double-click edits text content or component intent for all five draft and finished vector kinds without altering artwork.");
  // Omitted selection remains an explicit form requirement for imported artwork.
  const importedArtwork = structuredClone(saved);
  for (const slide of importedArtwork.slides) for (const component of slide.components) {
    if (component.kind === "diagram" || component.kind === "chart") delete component.appearance.selection;
  }
  const importedFile = join(scratch, "imported-artwork.json");
  writeFileSync(importedFile, JSON.stringify(importedArtwork));
  openDocument(importedFile);
  for (const [pageIndex, kind, label, key, value] of [
    [2, "Diagram", "Flowchart", "type", "flowchart"],
    [3, "Chart", "Line", "template", "line"],
  ]) {
    click(`Page ${String(pageIndex + 1).padStart(2, "0")}`);
    click(`Select ${kind}`);
    check('document.querySelector(".diagram-type-options button.selected").textContent.trim() !== "YOLO"', "imported artwork choice must be explicit and visible");
    browser("click", ".diagram-type-field > summary");
    for (const selection of ["explicit", "auto", "explicit"]) {
      click(selection === "auto" ? "YOLO" : label);
      browser("wait", "--fn", `JSON.parse(localStorage.getItem("konpeki-composer/v1")).document.slides[${pageIndex}].components[0].appearance.selection === ${JSON.stringify(selection)} && JSON.parse(localStorage.getItem("konpeki-composer/v1")).document.slides[${pageIndex}].components[0].appearance[${JSON.stringify(key)}] === ${JSON.stringify(value)}`);
      const actual = JSON.parse(JSON.parse(evaluate('localStorage.getItem("konpeki-composer/v1")'))).document.slides[pageIndex].components[0];
      const expected = structuredClone(importedArtwork.slides[pageIndex].components[0]);
      expected.appearance[key] = value;
      expected.appearance.selection = selection;
      assert.deepEqual(actual, expected, `${kind} requirement change altered artwork, intent, topology or geometry`);
      evaluate('document.querySelector(".diagram-type-field > summary").scrollIntoView({block: "center"})');
      capture(`finished-${kind.toLowerCase()}-${selection}`);
      if (kind === "Chart") chartPreviewColors();
    }
    const persisted = JSON.parse(evaluate('JSON.stringify(JSON.parse(localStorage.getItem("konpeki-composer/v1")).document)'));
    const roundtripFile = join(scratch, "finished-roundtrip.json");
    writeFileSync(roundtripFile, persisted);
    openDocument(roundtripFile);
    browser("reload");
    browser("wait", "--text", "Page 01");
    const restored = JSON.parse(JSON.parse(evaluate('localStorage.getItem("konpeki-composer/v1")'))).document;
    assert.deepEqual(restored, JSON.parse(persisted), `${kind} finished-artwork roundtrip changed`);
  }
  const sankey = structuredClone(saved);
  const sankeyChart = sankey.slides[3].components[0];
  sankeyChart.appearance.template = "sankey";
  sankeyChart.topology = { kind: "explicit", nodes: sankeyChart.slotIds.map(id => ({ id, slotId: id })), edges: [] };
  const sankeyFile = join(scratch, "sankey-topology.json");
  writeFileSync(sankeyFile, JSON.stringify(sankey));
  openDocument(sankeyFile);
  click("Page 04");
  click("Select Chart");
  browser("click", ".chart-type-field > summary");
  check('document.querySelectorAll(".chart-type-options [role=group] button").length === 8 && [...document.querySelectorAll(".chart-type-options [role=group] button")].every(button => button.textContent.trim() === "Sankey" ? !button.disabled : button.disabled)', "Sankey topology guard missing");
  click("Sankey");
  click("YOLO");
  browser("wait", "--fn", 'JSON.parse(localStorage.getItem("konpeki-composer/v1")).document.slides[3].components[0].appearance.selection === "auto"');
  assert.deepEqual(JSON.parse(JSON.parse(evaluate('localStorage.getItem("konpeki-composer/v1")'))).document.slides[3].components[0], sankeyChart);
  capture("finished-sankey-topology");
  for (const finished of [false, true]) {
    const themed = structuredClone(saved);
    if (!finished) delete themed.slides[3].components[0].customVisual;
    const file = join(scratch, "themed-chart.json");
    writeFileSync(file, JSON.stringify(themed));
    openDocument(file);
    click("Page 04");
    click("Select Chart");
    browser("click", ".chart-type-field > summary");
    const before = chartPreviewColors();
    themed.theme = { id: "orange-coral", mode: "paper" };
    writeFileSync(file, JSON.stringify(themed));
    openDocument(file);
    click("Page 04");
    click("Select Chart");
    browser("click", ".chart-type-field > summary");
    assert.notDeepEqual(chartPreviewColors(), before, "chart thumbnails did not respond to theme change");
    capture(`${finished ? "finished" : "draft"}-chart-themed`);
  }
  console.log("PASS: finished diagram/chart form selection, Auto, imported artwork preservation and persistence/reload; Sankey topology remains protected.");
  console.log("PASS: bar, line, pie, scatter and Sankey thumbnails retain palette colors for draft/finished charts and respond to theme changes.");
  openDocument(completed);
  for (const [index, [kind]] of cases.entries()) {
    click(`Page ${String(index + 2).padStart(2, "0")}`);
    click("Present");
    check('document.querySelector(".presentation [data-vector-element]") !== null', `${kind} vector output missing`);
    browser("set", "viewport", "1920", "1080", "2");
    capture(`completed-${kind.toLowerCase().replaceAll(" ", "-")}`);
    browser("set", "viewport", "1024", "768", "2");
    capture(`completed-review-${kind.toLowerCase().replaceAll(" ", "-")}`);
    browser("press", "Escape");
  }
  browser("set", "viewport", "1440", "900", "2");
  click("Page 03");
  click("Select Diagram");
  capture("edit-elements-action");
  click("Edit elements");
  check('document.querySelector(".custom-vector-art.editing") !== null', "Edit elements did not enter vector mode");
  capture("edit-elements-active");
  click("Done editing");
  check('document.querySelector(".custom-vector-art.editing") === null', "Done editing did not exit vector mode");
  click("Edit elements");
  browser("dblclick", "#canvas-stage [data-vector-element=stages] text:first-of-type");
  check('document.activeElement.matches(".vector-element-editor textarea") && document.activeElement.value === "Draft"', "nested text double-click must edit the child, not its group");
  browser("select", ".custom-visual-summary select", "arrows");
  // This disconnected path's bounding-box center is over the Review label.
  // Target the path itself rather than double-clicking that unrelated text.
  evaluate('document.querySelector("#canvas-stage [data-vector-element=arrows]").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))');
  check('document.activeElement.matches(".vector-attributes input") && document.querySelector(".custom-vector-art.editing") && !document.querySelector(".inline-intent-editor")', "path double-click must focus attributes without opening intent");
  check('!document.querySelector(".vector-handles")', "paths must not promise endpoint dragging");
  capture("double-click-path-controls");
  browser("fill", '[name="vector-stroke"]', "#bb4400");
  evaluate("document.activeElement.blur()");
  check('document.querySelector("#canvas-stage [data-vector-element=arrows]").getAttribute("stroke") === "#bb4400"', "path attribute edit lost");
  click("Send backward");
  check('document.querySelector("#canvas-stage [data-vector-element=vector-root]").firstElementChild.dataset.vectorElement === "arrows"', "sibling ordering lost");
  browser("press", "Control+z");
  browser("press", "Control+Shift+z");
  browser("select", ".custom-visual-summary select", "stages");
  click("Delete element");
  check('!document.querySelector("#canvas-stage [data-vector-element=stages]")', "group deletion failed");
  browser("press", "Control+z");
  check('document.querySelectorAll("#canvas-stage [data-vector-element=stages] > *").length === 6', "group undo lost children");
  const arrowPoint = JSON.parse(evaluate('(() => { const element = document.querySelector("#canvas-stage [data-vector-element=arrows]"); const point = new DOMPoint(380, 175).matrixTransform(element.getScreenCTM()); return { x: point.x, y: point.y }; })()'));
  browser("mouse", "move", String(Math.round(arrowPoint.x)), String(Math.round(arrowPoint.y)));
  browser("mouse", "down", "left");
  browser("mouse", "up", "left");
  browser("press", "Delete");
  check('!document.querySelector("#canvas-stage [data-vector-element=arrows]") && document.querySelectorAll("#canvas-stage [data-component]").length === 1', "keyboard Delete removed owner or failed to delete interior");
  browser("press", "Control+z");
  browser("select", ".custom-visual-summary select", "stages");
  evaluate('document.querySelector(".inspector-content").scrollTop = 550');
  capture("group-editor");
  click("Page 02");
  click("Select Text block");
  browser("press", "Enter");
  check('document.querySelector(".custom-vector-art.editing") !== null', "Enter must still enter vector mode");
  browser("dblclick", "#canvas-stage [data-vector-element=headline]");
  check('document.activeElement.matches(".vector-element-editor textarea") && !document.querySelector(".inline-intent-editor")', "text double-click must focus direct text editing");
  capture("double-click-text-editor");
  evaluate("document.activeElement.blur()");
  click("Collapse right panel");
  browser("dblclick", "#canvas-stage [data-vector-element=headline]");
  check('document.activeElement.matches(".vector-element-editor textarea") && !document.querySelector(".right-panel.collapsed")', "repeated double-click must reopen the inspector and refocus text");
  browser("find", "label", "Text", "fill", "One editable canvas for everyone");
  evaluate("document.activeElement.blur()");
  check('document.querySelector("#canvas-stage [data-vector-element=headline]").textContent === "One editable canvas for everyone"', "text editing failed");
  browser("press", "Control+z");
  browser("press", "Control+Shift+z");
  check('document.querySelector("#canvas-stage [data-vector-element=headline]").textContent === "One editable canvas for everyone"', "text redo failed");
  click("Done editing");
  browser("dblclick", "#canvas-stage [data-vector-element=headline]");
  check('document.activeElement.matches(".inline-intent-editor") && document.activeElement.getAttribute("aria-label").endsWith("text")', "outside vector mode, text blocks must retain owner text editing");
  browser("press", "Escape");
  click("Page 03");
  browser("dblclick", "#canvas-stage [data-vector-element=stages] text:first-of-type");
  check('document.activeElement.matches(".inline-intent-editor") && document.activeElement.getAttribute("aria-label").endsWith("intent")', "outside vector mode, individual element double-click must edit owner intent");
  browser("press", "Escape");
  console.log("PASS: element double-click focuses path attributes or nested editable text, reopens the inspector, and preserves outside-mode intent editing.");
  for (const fit of ["contain", "cover", "stretch"]) {
    const component = saved.slides[2].components[0];
    component.preferredRect = { x: 160, y: 150, width: 800, height: 780 };
    component.customVisual = {
      format: "vector", description: "Transformed line drag regression", fit,
      ...parseEditableSvg('<svg viewBox="0 0 1200 600"><line id="line" x1="500" y1="220" x2="800" y2="300" transform="translate(50 20)" stroke="#007bbb" stroke-width="10"/></svg>'),
    };
    writeFileSync(completed, JSON.stringify(saved));
    openDocument(completed);
    click("Page 03");
    click("Select Diagram");
    browser("select", ".custom-visual-summary select", "line");
    const points = JSON.parse(evaluate('(() => { const e=document.querySelector("#canvas-stage [data-vector-element=line]"); const m=e.getScreenCTM(); return [new DOMPoint(500,220).matrixTransform(m), new DOMPoint(600,300).matrixTransform(m)].map(p=>({x:p.x,y:p.y})); })()'));
    browser("mouse", "move", String(Math.round(points[0].x)), String(Math.round(points[0].y)));
    browser("mouse", "down", "left");
    browser("mouse", "move", String(Math.round(points[1].x)), String(Math.round(points[1].y)));
    browser("mouse", "up", "left");
    check('Math.abs(Number(document.querySelector("#canvas-stage [data-vector-element=line]").getAttribute("x1"))-600) <= 2 && Math.abs(Number(document.querySelector("#canvas-stage [data-vector-element=line]").getAttribute("y1"))-300) <= 2', `${fit} transformed endpoint drag used wrong coordinates`);
  }
  console.log("PASS: transformed line endpoint dragging in contain, cover and stretch fit modes.");
  console.log("PASS: vector path attributes, sibling ordering, group deletion, keyboard subtree deletion, text edits, undo and redo.");
  console.log("PASS: empty slide; all five kinds created, edited, persisted, reopened, reloaded and presented at 1920×1080 and 1024×768.");
  console.log("PASS: agent-completed editable vector interiors rendered in all five owning component kinds at both sizes.");
} finally {
  browser("close");
}
