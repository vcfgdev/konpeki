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
const capture = (name) => browser("screenshot", join(output, name));
try {
  browser("open", base);
  browser("set", "viewport", "1280", "900", "2");
  evaluate("{const buttons=[...document.querySelectorAll('button')];if(!document.querySelector('button[aria-label=\"Export PNG\"] svg'))throw Error('PNG action or icon missing');if(!buttons.find(button=>button.textContent.trim()==='Present')?.querySelector('svg'))throw Error('Present icon missing');if(buttons.some(button=>['Download','Undo'].includes(button.textContent.trim())))throw Error('Removed document action returned')}");
  click("Collapse left panel");
  evaluate("{const actions=document.querySelector('.action-island');if(!document.querySelector('.workspace').classList.contains('left-collapsed')||getComputedStyle(actions).visibility!=='hidden')throw Error('Collapsed actions remain visible')}");
  click("Expand left panel");
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
  console.log("PASS: PNG action and collapse behavior, four ratios, native font and vector PNG content, exact PNG dimensions, editing, resize undo, presentation fitting, empty page, preset, reload and overflow refusal");
} finally { browser("close"); }
