import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const base = process.argv[2] ?? "http://localhost:4318";
function browser(...args) { return execFileSync("agent-browser", ["--session", "native-text", ...args], { encoding: "utf8" }).trim(); }
function click(name) { browser("find", "role", "button", "click", "--name", name, "--exact"); }
function evaluate(code) { return browser("eval", code); }
try {
  browser("open", `${base}/?example=introducing-konpeki`);
  browser("set", "viewport", "1556", "1030", "2");
  click("Select Text block 1"); browser("press", "Enter");
  browser("fill", ".inline-intent-editor", "Human revision");
  browser("press", "Escape");
  evaluate(`if(document.querySelector('[data-component="brand"] .text-block-content').textContent !== 'Human revision') throw Error('Direct edit failed')`);
  click("Undo");
  evaluate(`if(document.querySelector('[data-component="brand"] .text-block-content').textContent !== 'Konpeki') throw Error('Undo failed')`);
  click("Redo");
  browser("fill", '[name="content-intent"]', "Agent instruction only"); evaluate("document.activeElement.blur()");
  evaluate(`if(document.querySelector('[data-component="brand"] .text-block-content').textContent !== 'Human revision') throw Error('Intent changed content')`);
  click("Add page"); click("Text block");
  browser("fill", '[name="text-content"]', "Manual text\nSecond line"); evaluate("document.activeElement.blur()");
  evaluate("window.downloadBlob=null; const create=URL.createObjectURL.bind(URL); URL.createObjectURL=b=>{window.downloadBlob=b;return create(b)}");
  click("Download");
  const json = JSON.parse(evaluate("window.downloadBlob.text()"));
  const document = JSON.parse(json);
  const block = document.slides.at(-1).components[0];
  if (block.content !== "Manual text\nSecond line" || block.customVisual) throw Error("Manual text not native");
  block.content = "Agent revision of manual text";
  const file = join(mkdtempSync(join(tmpdir(), "native-text-")), "returned.json");
  writeFileSync(file, JSON.stringify(document));
  browser("open", base);
  browser("upload", 'input[type="file"]', file);
  browser("wait", "--text", "Page 07");
  click("Page 07"); click("Select Text block"); browser("press", "Enter");
  browser("fill", ".inline-intent-editor", "Human after agent"); browser("press", "Escape");
  browser("wait", "--fn", `localStorage.getItem('konpeki-composer/v1').includes('Human after agent')`);
  browser("reload"); browser("wait", "--text", "Page 07"); click("Page 07"); click("Present");
  evaluate(`if(document.querySelector('.presentation .text-block-content').textContent !== 'Human after agent') throw Error('Roundtrip failed')`);
  console.log("PASS: native manual/agent/human text edits, separate intent, undo/redo, Download/Open, autosave/reload/present");
} finally { browser("close"); }
