import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { initialDraft, addComponent } from "../composition/document.ts";
import { resizePage } from "../src/lib/page-size.ts";
import { validateComposition } from "../composition/validate.ts";

const base = process.argv[2] ?? "http://localhost:4318";
const output = process.argv[3] ?? "/tmp/konpeki-pages";
mkdirSync(output, { recursive: true });
const browser = (...args) => execFileSync("agent-browser", ["--session", "page-check", ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trim();
const evaluate = (code) => browser("eval", code);
const click = (name) => browser("find", "role", "button", "click", "--name", name, "--exact");
const settlePanels = () => evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))).then(() => Promise.all([...document.querySelectorAll('.left-sidebar,.left-panel,.action-island,.right-panel,.right-panel-body,.right-panel>.panel-toolbar,.stage')].flatMap(element => element.getAnimations().map(animation => animation.finished))))");
const capture = (name) => { settlePanels(); browser("screenshot", join(output, name)); };
const checkCompactPanels = () => evaluate(`{
  const left = document.querySelector('.left-sidebar'), right = document.querySelector('.right-panel');
  if (!left.classList.contains('collapsed') && !right.classList.contains('collapsed'))
    throw Error('Compact panels must expand one at a time');
  const a = left.getBoundingClientRect(), b = right.getBoundingClientRect();
  if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)
    throw Error('Compact panel cards overlap');
  if ([a, b].some(r => r.left < 0 || r.right > innerWidth || r.top < 0 || r.bottom > innerHeight))
    throw Error('Compact panel exceeds viewport');
  for (const button of document.querySelectorAll('.panel-toggle, .right-panel .panel-tabs button')) {
    if (button.closest('[inert]')) continue;
    const r = button.getBoundingClientRect(), x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2;
    for (const [px, py] of [[x, y], [r.left + 2, y], [r.right - 2, y], [x, r.top + 2], [x, r.bottom - 2]]) {
      if (!button.contains(document.elementFromPoint(px, py)))
        throw Error('Panel control is covered: ' + (button.getAttribute('aria-label') || button.textContent));
    }
  }
}`);
try {
  browser("open", new URL("?example=introducing-konpeki", base).href);
  browser("set", "viewport", "1556", "1030", "2");
  evaluate("document.fonts.ready");
  settlePanels();
  browser("scroll", "down", "1000", "--selector", ".inspector-content");
  evaluate(`{
    const inspector = document.querySelector('.inspector-content');
    if (!inspector.querySelector('.page-number-picker .choice-picker:nth-child(2)')) throw Error('Numbering color must be present for the full settings check');
    if (inspector.scrollHeight !== inspector.clientHeight || inspector.scrollTop !== 0)
      throw Error('Full page settings should fit a 1556×1030 viewport without redundant scrolling');
    if (inspector.lastElementChild.getBoundingClientRect().bottom > inspector.getBoundingClientRect().bottom - 18)
      throw Error('Page settings must keep their bottom padding');
  }`);
  capture("page-settings-fit.png");
  browser("set", "viewport", "1556", "800", "2");
  settlePanels();
  browser("scroll", "down", "1000", "--selector", ".inspector-content");
  evaluate(`{
    const inspector = document.querySelector('.inspector-content');
    const last = inspector.lastElementChild.getBoundingClientRect();
    if (inspector.scrollHeight <= inspector.clientHeight || inspector.scrollTop <= 0 ||
      Math.abs(inspector.scrollHeight - inspector.clientHeight - inspector.scrollTop) > 1 ||
      Math.abs(inspector.getBoundingClientRect().bottom - last.bottom - 18) > 1)
      throw Error('Short windows must still scroll to all settings with bottom padding');
    if ([document.querySelector('.right-panel'), document.querySelector('.right-panel-body'), document.scrollingElement].some(element => element.scrollTop !== 0))
      throw Error('Only the inspector should scroll');
  }`);
  capture("page-settings-scrolled.png");
  console.log("PASS: full page settings fit without scrolling at 1556×1030; shorter windows scroll only the inspector and retain bottom padding.");
  browser("open", base);
  browser("set", "viewport", "1280", "900", "2");
  evaluate("document.fonts.ready");
  settlePanels();
  evaluate(`{
    const left = document.querySelector('.document-island');
    const right = document.querySelector('.right-panel > .panel-toolbar');
    const a = left.getBoundingClientRect(), b = right.getBoundingClientRect();
    if (a.height !== 58 || b.height !== 58 || a.bottom !== b.bottom ||
      [left, right].some(header => getComputedStyle(header).borderBottomWidth !== '1px' || getComputedStyle(header).borderBottomColor !== 'rgb(229, 229, 229)'))
      throw Error('Expanded panel headers must have aligned, matching dividers');
  }`);
  evaluate("{const buttons=[...document.querySelectorAll('button')];if(!document.querySelector('button[aria-label=\"Export PNG\"] svg'))throw Error('PNG action or icon missing');if(!document.querySelector('button[aria-label=\"Present\"] svg'))throw Error('Present icon missing');if(buttons.some(button=>['Download','Undo'].includes(button.textContent.trim())))throw Error('Removed document action returned')}");
  evaluate(`(async () => {
    const shell = document.querySelector('.left-sidebar');
    const header = document.querySelector('.document-island');
    const panel = document.querySelector('.left-panel');
    const actions = document.querySelector('.action-island');
    const stage = document.querySelector('.stage');
    const toggle = header.querySelector('button');
    const title = header.querySelector('input');
    const originalTitle = title.value;
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    const samples = [];
    toggle.focus();
    toggle.click();
    await frame();
    if (!title.closest('[inert]') || !panel.inert || !document.querySelector('.action-island').inert)
      throw Error('Hidden controls must become inert at the start of collapse');
    title.focus();
    if (document.activeElement !== toggle) throw Error('Hidden title took focus');
    const start = performance.now();
    do {
      const s = shell.getBoundingClientRect(), h = header.getBoundingClientRect(), b = panel.getBoundingClientRect(), a = actions.getBoundingClientRect();
      if (!shell.contains(panel) || !shell.contains(actions) || Math.abs(h.width - s.width + 2) > 0.5 || Math.abs(h.bottom - b.top) > 0.5 || Math.abs(b.bottom - a.top) > 0.5 ||
        [header, panel, actions].some(el => getComputedStyle(el).transform !== 'none'))
        throw Error('Left header, body and footer separated during collapse');
      const bodyOpacity = parseFloat(getComputedStyle(panel).opacity);
      const titleStyle = getComputedStyle(title.closest('.document-title'));
      if (Math.abs(parseFloat(titleStyle.opacity) - bodyOpacity) > 0.02 ||
        (bodyOpacity > 0 && titleStyle.visibility !== 'visible'))
        throw Error('Left title must fade with the body, not disappear first');
      samples.push({ width: s.width, height: s.height, padding: parseFloat(getComputedStyle(stage).paddingLeft) });
      await frame();
    } while (performance.now() - start < 300);
    const moving = samples.filter(s => s.width > 107.5 && s.width < 251.5);
    if (!moving.length || moving.some(s => Math.abs((s.width - 107) / 145 - (s.height - 60) / (innerHeight - 172)) > 0.02 || Math.abs((s.width - 107) / 145 - (s.padding - 96) / 196) > 0.02))
      throw Error('Left card and canvas must contract together: ' + JSON.stringify(samples));
    if (Math.abs(shell.getBoundingClientRect().width - 107) > 0.5 || shell.getBoundingClientRect().height !== 60 || toggle.getAttribute('aria-expanded') !== 'false')
      throw Error('Wrong collapsed header or toggle state');
    if (getComputedStyle(header).borderBottomColor !== 'rgba(0, 0, 0, 0)')
      throw Error('Collapsed left header must hide its divider');
    if (getComputedStyle(title).visibility !== 'hidden' || title.value !== originalTitle)
      throw Error('Collapse must hide, not discard, the title');
    if (getComputedStyle(toggle.querySelector('svg')).transform !== 'none')
      throw Error('Toggle must point horizontally');
    // Reversing mid-expansion must settle without a stale timeout hiding the panel.
    toggle.click(); await frame(); await frame();
    toggle.click(); await frame(); await frame();
    toggle.click(); await frame();
    await Promise.all([shell, panel, actions, stage].flatMap(el => el.getAnimations().map(a => a.finished)));
    if (Math.abs(shell.getBoundingClientRect().width - 252) > 0.5 || shell.getBoundingClientRect().height !== innerHeight - 112 || panel.inert || getComputedStyle(panel).visibility !== 'visible')
      throw Error('Rapid reversal left the panel collapsed');
  })()`);
  browser("press", "Enter");
  settlePanels();
  evaluate("{const actions=document.querySelector('.action-island');if(!document.querySelector('.workspace').classList.contains('left-collapsed')||getComputedStyle(actions).visibility!=='hidden')throw Error('Collapsed actions remain visible')}");
  capture("panel-collapsed.png");
  browser("press", "Enter");
  settlePanels();
  evaluate("if(document.querySelector('.document-title').inert || document.querySelector('.document-island button').getAttribute('aria-expanded') !== 'true')throw Error('Keyboard expansion failed')");
  browser("click", ".browser-menu > summary");
  click("Collapse left panel"); settlePanels();
  evaluate("if(document.querySelector('.browser-menu').open)throw Error('Browser menu must close with its panel')");
  click("Expand left panel"); settlePanels();
  click("Layers");
  evaluate(`(async () => {
    const panel = document.querySelector('.right-panel');
    const body = panel.querySelector('.right-panel-body');
    const tabs = panel.querySelector('.panel-tabs');
    const stage = document.querySelector('.stage');
    const toggle = panel.querySelector('.panel-toggle');
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    const samples = [];
    toggle.focus(); toggle.click(); await frame();
    if (!body.inert || !tabs.inert) throw Error('Right controls must become inert immediately');
    tabs.querySelector('button').focus();
    if (document.activeElement !== toggle) throw Error('Hidden right tab took focus');
    const start = performance.now();
    do {
      const p = panel.getBoundingClientRect(), h = tabs.parentElement.getBoundingClientRect(), b = body.getBoundingClientRect();
      if (Math.abs(h.width - p.width + 2) > 0.5 || Math.abs(h.bottom - b.top) > 0.5 || Math.abs(b.right - p.right + 1) > 0.5 || getComputedStyle(body).transform !== 'none')
        throw Error('Right header and body separated during collapse');
      const bodyOpacity = parseFloat(getComputedStyle(body).opacity);
      const tabStyle = getComputedStyle(tabs);
      if (Math.abs(parseFloat(tabStyle.opacity) - bodyOpacity) > 0.02 ||
        (bodyOpacity > 0 && tabStyle.visibility !== 'visible'))
        throw Error('Right tabs must fade with the body, not disappear first');
      if (tabStyle.clipPath === 'none' || tabs.getBoundingClientRect().right > toggle.getBoundingClientRect().left)
        throw Error('Shrinking tab text must not paint beneath the toggle');
      samples.push({ width: p.width, height: p.height, padding: parseFloat(getComputedStyle(stage).paddingRight) });
      await frame();
    } while (performance.now() - start < 300);
    const moving = samples.filter(s => s.width > 50.5 && s.width < 327.5);
    if (!moving.length || moving.some(s => Math.abs((s.width - 50) / 278 - (s.height - 60) / (innerHeight - 172)) > 0.02 || Math.abs((s.width - 50) / 278 - (s.padding - 96) / 280) > 0.02))
      throw Error('Right card and canvas must contract together: ' + JSON.stringify(samples));
    const bounds = panel.getBoundingClientRect(), button = toggle.getBoundingClientRect();
    if (bounds.width !== 50 || bounds.height !== 60 || Math.abs(button.left - bounds.left - 5) > 0.5 || Math.abs(bounds.right - button.right - 5) > 0.5)
      throw Error('Collapsed right toggle lost its centered target');
    if (getComputedStyle(tabs.parentElement).borderBottomColor !== 'rgba(0, 0, 0, 0)')
      throw Error('Collapsed right header must hide its divider');
    if (getComputedStyle(body).visibility !== 'hidden' || getComputedStyle(tabs).visibility !== 'hidden' || toggle.getAttribute('aria-expanded') !== 'false')
      throw Error('Right panel did not finish collapsing');
    toggle.click(); await frame(); await frame();
    toggle.click(); await frame(); await frame();
    toggle.click(); await frame();
    await Promise.all([panel, body, tabs.parentElement, stage].flatMap(el => el.getAnimations().map(a => a.finished)));
    if (panel.getBoundingClientRect().width !== 328 || panel.getBoundingClientRect().height !== innerHeight - 112 || body.inert || getComputedStyle(body).visibility !== 'visible')
      throw Error('Right panel rapid reversal failed');
  })()`);
  browser("press", "Enter"); settlePanels();
  capture("right-panel-collapsed.png");
  browser("press", "Enter"); settlePanels();
  evaluate("if(document.querySelector('.right-panel-body').inert || !document.querySelector('.layers-panel') || document.querySelector('.right-panel button[aria-pressed=true]').textContent !== 'Layers')throw Error('Keyboard expansion lost the active inspector tab')");
  click("Settings");
  for (const [name, width, height] of [["square", 1080, 1080], ["header", 1600, 600], ["portrait", 1080, 1350], ["presentation", 1920, 1080]]) {
    let doc = initialDraft(true);
    doc.title = "Visual page verification";
    doc.slides[0] = resizePage(doc.slides[0], { width, height });
    doc.slides[0].name = name;
    doc = addComponent(doc, "text-block");
    doc = addComponent(doc, "text-block");
    doc = addComponent(doc, "image");
    const [headline, body, artwork] = doc.slides[0].components;
    headline.content = "Ideas deserve\na clear picture.";
    headline.textStyle = { size: 72, weight: 600, lineHeight: 1.15, color: "accent", font: "heading" };
    headline.preferredRect = { x: 80, y: 80, width: width - 160, height: 180 };
    body.content = "One editable canvas.\nA surface that fits the destination.";
    body.textStyle = { size: 32, weight: 400, lineHeight: 1.4, color: "ink", font: "body" };
    body.preferredRect = { x: 80, y: 320, width: width - 160, height: 140 };
    artwork.preferredRect = { x: width - 200, y: height - 140, width: 120, height: 80 };
    artwork.customVisual = {
      format: "vector",
      viewBox: { x: 0, y: 0, width: 120, height: 80 },
      description: "Magenta rectangle used to verify generated vector export",
      elements: [{ id: "export-vector", kind: "rect", attributes: { x: 0, y: 0, width: 120, height: 80, fill: "#ff00aa" } }],
    };
    doc.slides[0].groups = [{ id: "copy", childIds: [headline.id, body.id] }];
    doc.slides[0].readingOrder = [{ kind: "group", id: "copy" }, { kind: "component", id: artwork.id }];
    doc.slides[0].paintOrder = [body.id, headline.id, artwork.id];
    assert.ok(validateComposition(doc).ok);
    evaluate(`localStorage.setItem('konpeki-composer/v1', ${JSON.stringify(JSON.stringify({ version: 2, document: doc }))})`);
    browser("reload");
    browser("wait", "--text", name);
    const checkOrders = () => evaluate(`{const canvas=document.querySelector('.presentation .canvas')??document.querySelector('.canvas');const nodes=[...canvas.querySelectorAll('[data-component]')];if(JSON.stringify(nodes.map(n=>n.dataset.component))!==${JSON.stringify(JSON.stringify([headline.id, body.id, artwork.id]))})throw Error('DOM must follow grouped reading order');if(nodes.map(n=>getComputedStyle(n).zIndex).join(',')!=='1,0,2')throw Error('Paint order must remain independent')}`);
    checkOrders();
    evaluate(`{const c=document.querySelector('.canvas').getBoundingClientRect(); if(Math.abs(c.width/c.height-${width / height})>0.01) throw Error('Wrong canvas ratio'); const t=document.querySelector('.text-block-content'); if(Math.abs(parseFloat(getComputedStyle(t).fontSize)/c.width-72/${width})>0.0001) throw Error('Wrong font scale');}`);
    click("Select Text block 1"); browser("press", "Enter");
    browser("fill", ".inline-intent-editor", "Ideas deserve\na clear picture."); browser("press", "Escape");
    evaluate("{window.png=null; const original=URL.createObjectURL.bind(URL); URL.createObjectURL=b=>{if(b.type==='image/png')window.png=b;return original(b)}}");
    click("Export PNG"); browser("wait", "--fn", "window.png !== null");
    evaluate(`new Promise(async(resolve,reject)=>{try{const bitmap=await createImageBitmap(window.png);const canvas=new OffscreenCanvas(bitmap.width,bitmap.height);const context=canvas.getContext('2d');context.drawImage(bitmap,0,0);const background=context.getImageData(10,10,1,1).data;const text=context.getImageData(80,80,Math.min(${width}-160,800),180).data;let changed=0;for(let i=0;i<text.length;i+=4)if(Math.abs(text[i]-background[0])+Math.abs(text[i+1]-background[1])+Math.abs(text[i+2]-background[2])>50)changed++;if(changed<100)throw Error('Native text missing from PNG');const vector=context.getImageData(${width}-140,${height}-100,1,1).data;if(vector[0]<240||vector[1]>20||vector[2]<150)throw Error('Generated vector missing from PNG');bitmap.close();resolve(true)}catch(error){reject(error)}})`);
    const encoded = JSON.parse(evaluate("new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(window.png)})"));
    const png = Buffer.from(encoded.split(",")[1], "base64");
    assert.equal(png.readUInt32BE(16), width); assert.equal(png.readUInt32BE(20), height);
    writeFileSync(join(output, `${name}.png`), png);
    click("Page");
    evaluate("if(document.querySelector('[name=page-width], [name=page-height], option[value=Custom]'))throw Error('Customization still exposed')");
    if (name === "square" || name === "header") {
      browser("select", '[name="page-format"]', "Presentation");
      evaluate("{const r=document.querySelector('.canvas').getBoundingClientRect();if(Math.abs(r.width/r.height-1920/1080)>0.01)throw Error('Resize failed')}");
      browser("press", "Control+z");
    }
    evaluate(`{const r=document.querySelector('.canvas').getBoundingClientRect();if(Math.abs(r.width/r.height-${width / height})>0.01)throw Error('Resize undo failed')}`);
    capture(`${name}-editor.png`);
    click("Present");
    checkOrders();
    evaluate(`{const r=document.querySelector('.presentation .canvas').getBoundingClientRect();if(r.top<0||r.bottom>innerHeight||Math.abs(r.width/r.height-${width / height})>0.01)throw Error('Presentation fit')}`);
    capture(`${name}-present.png`); click("Exit");
  }
  click("Add page");
  evaluate("if(document.querySelectorAll('.canvas [data-component]').length)throw Error('New page not empty')");
  browser("select", '[name="page-format"]', "Square post");
  evaluate("{const r=document.querySelector('.canvas').getBoundingClientRect();if(Math.abs(r.width/r.height-1)>0.01)throw Error('Preset not applied')}");
  click("Text block");
  browser("fill", '[name="text-content"]', "New square content"); evaluate("document.activeElement.blur()");
  browser("wait", "--fn", "localStorage.getItem('konpeki-composer/v1')?.includes('New square content')");
  browser("reload"); browser("wait", "--text", "Page 02"); click("Page 02");
  evaluate("if(document.querySelector('.text-block-content').textContent!=='New square content')throw Error('Reload lost content')");
  click("Select Text block");
  browser("fill", 'input[name="y"]', "800"); evaluate("document.activeElement.blur()");
  click("Page");
  evaluate(`{const option=document.querySelector('option[value="Article header"]');if(!option.disabled)throw Error('Overflowing size must be unavailable');const r=document.querySelector('.canvas').getBoundingClientRect();if(Math.abs(r.width/r.height-1)>0.01)throw Error('Page size changed despite overflow')}`);
  browser("set", "viewport", "1024", "768", "2");
  evaluate("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
  capture("resize-unavailable-small.png");
  browser("set", "viewport", "390", "700", "2");
  settlePanels();
  evaluate("if(document.documentElement.scrollWidth !== 390 || document.querySelector('.left-sidebar').getBoundingClientRect().width !== 107)throw Error('Narrow collapsed layout overflows')");
  capture("panel-collapsed-narrow.png");
  for (const width of [390, 360, 600, 601, 900]) {
    browser("set", "viewport", String(width), "700", "2"); settlePanels();
    checkCompactPanels();
    click("Expand right panel"); settlePanels();
    checkCompactPanels();
    click("Layers");
    evaluate("if(!document.querySelector('.layers-panel'))throw Error('Narrow Layers tab is not usable')");
    click("Settings");
    evaluate("if(!document.querySelector('.inspector-content'))throw Error('Narrow Settings tab is not usable')");
    if (width === 390) capture("right-panel-expanded-narrow.png");
    browser("focus", ".document-island .panel-toggle");
    browser("press", "Enter"); settlePanels();
    checkCompactPanels();
    evaluate("if(document.activeElement !== document.querySelector('.document-island .panel-toggle') || document.querySelector('.left-sidebar').classList.contains('collapsed'))throw Error('Keyboard panel switch lost focus or did not open the left panel')");
    if (width === 390) {
      capture("left-panel-expanded-narrow.png");
      browser("scroll", "down", "1000", "--selector", ".slide-list");
      evaluate(`{
        const list = document.querySelector('.slide-list'), add = document.querySelector('.add-slide');
        const r = add.getBoundingClientRect();
        if (r.bottom > list.getBoundingClientRect().bottom || !add.contains(document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2)))
          throw Error('Narrow page list must scroll to its final action without the footer covering it');
      }`);
      capture("left-panel-scrolled-narrow.png");
    }
    click("Expand right panel"); settlePanels();
    checkCompactPanels();
    click("Collapse right panel"); settlePanels();
    checkCompactPanels();
  }
  browser("set", "viewport", "901", "700", "2"); settlePanels();
  click("Expand right panel"); settlePanels();
  evaluate("if(document.querySelector('.left-sidebar').classList.contains('collapsed') || document.querySelector('.right-panel').classList.contains('collapsed'))throw Error('Above the compact breakpoint both panels must remain independently expandable')");
  browser("set", "viewport", "390", "700", "2"); settlePanels();
  browser("set", "media", "light", "reduced-motion");
  click("Expand left panel");
  click("Expand right panel");
  evaluate("if([...document.querySelectorAll('.left-sidebar,.left-panel,.action-island,.right-panel,.right-panel-body,.right-panel>.panel-toolbar,.stage')].some(element => getComputedStyle(element).transitionDuration.split(',').some(duration => parseFloat(duration) !== 0) || element.getAnimations().length))throw Error('Panel motion ignores reduced-motion preference')");
  checkCompactPanels();
  click("Collapse right panel");
  evaluate("if(getComputedStyle(document.querySelector('.right-panel-body')).visibility !== 'hidden' || document.querySelector('.right-panel').getBoundingClientRect().width !== 50)throw Error('Reduced-motion right collapse did not settle immediately')");
  evaluate("if(getComputedStyle(document.querySelector('.left-panel')).visibility !== 'hidden' || document.querySelector('.left-sidebar').getBoundingClientRect().width !== 107)throw Error('Reduced-motion collapse did not settle immediately')");
  console.log("PASS: both panels contract as continuous cards in sync with the canvas, joined headers/bodies/footer at every frame, rapid reversal, inert controls, centered right toggle, keyboard toggle/tab retention, unobstructed one-panel switching at 360/390/600/601/900px and reduced motion; PNG actions, four ratios, native/vector exports, editing, resize undo, presentation, reload and overflow refusal");
} finally { browser("close"); }
