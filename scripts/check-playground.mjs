// Requires the development server and the external agent-browser CLI.
// Uses a disposable browser session and isolated localStorage keys.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const url = new URL(
  "?example=introducing-konpeki",
  process.argv[2] ?? "http://localhost:4318",
).href;
const artifacts = resolve(process.argv[3] ?? ".amp/in/artifacts/playground");
const scratch = mkdtempSync(join(tmpdir(), "konpeki-playground-"));
const session = "playground-check";
const ordinaryKey = "konpeki-composer/v1";
const exampleKey = "konpeki-composer/examples/v1/introducing-konpeki";
mkdirSync(artifacts, { recursive: true });

function browser(...args) {
  return execFileSync("agent-browser", ["--session", session, ...args], {
    encoding: "utf8",
  }).trim();
}
function evaluate(source) {
  return browser("eval", source);
}
function click(name) {
  browser("find", "role", "button", "click", "--name", name, "--exact");
}
function check(source, message) {
  evaluate(`if (!(${source})) throw Error(${JSON.stringify(message)})`);
}
function capture(name) {
  evaluate(
    "document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))",
  );
  browser("screenshot", join(artifacts, `${name}.png`));
}
function acceptConfirmation() {
  browser("dialog", "accept");
}

try {
  browser("open", url);
  browser("set", "viewport", "1440", "900", "2");
  evaluate(`localStorage.removeItem(${JSON.stringify(exampleKey)}); localStorage.setItem(${JSON.stringify(ordinaryKey)}, "ordinary-draft-sentinel"); location.reload()`);
  browser("wait", "--fn", 'document.querySelector("[name=composition-title]")?.value === "Introducing Konpeki"');
  check("devicePixelRatio === 2", "screenshots must render at 2x");
  check("!document.querySelector('.build-button')", "standalone mode must not show Build");
  check("![...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Notes')", "standalone mode must not show notes");
  check(
    `document.querySelector('[aria-label="Export PNG"]') && document.querySelector('[aria-label="Present"]')`,
    "PNG and Present must remain available",
  );
  capture("example-editor");

  for (let reset = 0; reset < 2; reset++) {
    browser("wait", "--fn", "document.querySelector('.browser-menu [role=status]').textContent.includes('saved only in this browser')");
    browser("click", ".browser-menu > summary");
    click("Reset example");
    acceptConfirmation();
    browser("wait", "--fn", `JSON.parse(localStorage.getItem(${JSON.stringify(exampleKey)}))?.document.title === "Introducing Konpeki"`);
  }

  browser("fill", '[name="composition-title"]', "Edited example copy");
  browser("press", "Tab");
  browser("wait", "--fn", `JSON.parse(localStorage.getItem(${JSON.stringify(exampleKey)})).document.title === "Edited example copy"`);
  assert.equal(evaluate(`localStorage.getItem(${JSON.stringify(ordinaryKey)})`), '"ordinary-draft-sentinel"');
  browser("reload");
  browser("wait", "--fn", 'document.querySelector("[name=composition-title]").value === "Edited example copy"');

  evaluate(`window.__downloadedJSON = undefined;
    window.__originalAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download.endsWith(".json")) {
        fetch(this.href).then(response => response.text()).then(text => { window.__downloadedJSON = text; });
        return;
      }
      return window.__originalAnchorClick.call(this);
    }`);
  browser("click", ".browser-menu > summary");
  check("document.querySelector('.browser-menu-popover').checkVisibility()", "browser menu did not open");
  browser("wait", "--fn", "document.querySelector('.browser-menu [role=status]').textContent.includes('saved only in this browser')");
  check("document.querySelector('.browser-menu-popover').textContent.includes('saved only in this browser') && document.querySelector('.browser-menu-popover').textContent.includes('Nothing syncs automatically')", "local-only storage limits are unclear");
  capture("browser-menu");

  const validCopy = evaluate(`localStorage.getItem(${JSON.stringify(exampleKey)})`);
  browser("click", '[name="composition-title"]');
  browser("press", "Control+a");
  browser("press", "Backspace");
  browser("press", "Tab");
  check("document.querySelector('.browser-menu [role=status]').textContent.includes('Autosave paused: /title')", "invalid title must explain why autosave is paused");
  check("!document.querySelector('.browser-menu [role=status]').textContent.includes('saved only')", "invalid edits must not be described as saved");
  evaluate("new Promise(resolve => setTimeout(resolve, 350))");
  assert.equal(evaluate(`localStorage.getItem(${JSON.stringify(exampleKey)})`), validCopy, "invalid edits must preserve the last valid save");
  capture("validation-paused");
  browser("fill", '[name="composition-title"]', "Edited example copy");
  browser("press", "Tab");
  browser("wait", "--fn", "document.querySelector('.browser-menu [role=status]').textContent.includes('saved only in this browser')");
  assert.equal(evaluate(`localStorage.getItem(${JSON.stringify(exampleKey)})`), validCopy, "correcting validation must resume saving without reset");
  click("Download JSON");
  browser("wait", "--fn", 'typeof window.__downloadedJSON === "string"');
  const downloaded = JSON.parse(evaluate("window.__downloadedJSON"));
  const document = JSON.parse(downloaded);
  assert.equal(document.title, "Edited example copy");
  assert.equal(document.schema, "konpeki-composition/v1");
  const roundtrip = join(scratch, "downloaded-composition.json");
  writeFileSync(roundtrip, downloaded);

  browser("fill", '[name="composition-title"]', "Changed after download");
  browser("press", "Tab");
  browser("click", ".browser-menu > summary");
  click("Import JSON");
  browser("upload", 'input[type="file"]', roundtrip);
  browser("wait", "--fn", 'document.querySelector("[name=composition-title]").value === "Edited example copy"');
  browser("press", "Control+z");
  browser("wait", "--fn", 'document.querySelector("[name=composition-title]").value === "Changed after download"');
  browser("press", "Control+Shift+z");
  browser("wait", "--fn", 'document.querySelector("[name=composition-title]").value === "Edited example copy"');

  for (const action of ["Start blank", "Reset example"]) {
    browser("wait", "--fn", `JSON.parse(localStorage.getItem(${JSON.stringify(exampleKey)})).document.title === "Edited example copy"`);
    const saved = evaluate(`localStorage.getItem(${JSON.stringify(exampleKey)})`);
    browser("click", ".browser-menu > summary");
    click(action);
    browser("dialog", "dismiss");
    check('document.querySelector("[name=composition-title]").value === "Edited example copy"', "cancel must preserve the document");
    assert.equal(evaluate(`localStorage.getItem(${JSON.stringify(exampleKey)})`), saved, "cancel must preserve storage");
    browser("press", "Control+z");
    browser("wait", "--fn", 'document.querySelector("[name=composition-title]").value === "Changed after download"');
    browser("press", "Control+Shift+z");
    browser("wait", "--fn", 'document.querySelector("[name=composition-title]").value === "Edited example copy"');
  }

  browser("click", ".browser-menu > summary");
  click("Start blank");
  acceptConfirmation();
  browser("wait", "--fn", 'document.querySelector("[name=composition-title]").value === "Untitled composition" && document.querySelectorAll("#canvas-stage [data-component]").length === 0');
  capture("blank-composition");
  browser("press", "Control+z");
  browser("wait", "--fn", 'document.querySelector("[name=composition-title]").value === "Edited example copy"');

  browser("click", ".browser-menu > summary");
  click("Reset example");
  acceptConfirmation();
  browser("wait", "--fn", 'document.querySelector("[name=composition-title]").value === "Introducing Konpeki"');
  browser("wait", "--fn", `JSON.parse(localStorage.getItem(${JSON.stringify(exampleKey)})).document.title === "Introducing Konpeki"`);
  assert.equal(evaluate(`localStorage.getItem(${JSON.stringify(ordinaryKey)})`), '"ordinary-draft-sentinel"');

  const beforeQuota = evaluate(`localStorage.getItem(${JSON.stringify(exampleKey)})`);
  evaluate(`window.__setItem = Storage.prototype.setItem;
    window.__removeItem = Storage.prototype.removeItem;
    Storage.prototype.setItem = function () { throw new DOMException("full", "QuotaExceededError"); };
    Storage.prototype.removeItem = function () { throw new DOMException("denied", "SecurityError"); }`);
  browser("fill", '[name="composition-title"]', "Recoverable quota work");
  browser("press", "Tab");
  browser("wait", "--text", "Unable to save this browser-local draft");
  browser("click", ".browser-menu > summary");
  check("document.querySelector('.browser-menu [role=status]').textContent.includes('Changes are not being saved')", "quota failure must not claim a successful save");
  evaluate("window.__downloadedJSON = undefined");
  click("Download JSON");
  browser("wait", "--fn", 'typeof window.__downloadedJSON === "string"');
  assert.equal(JSON.parse(JSON.parse(evaluate("window.__downloadedJSON"))).title, "Recoverable quota work", "unsaved work must remain downloadable");
  browser("click", ".browser-menu > summary");
  browser("click", ".browser-menu-actions button:last-child");
  acceptConfirmation();
  browser("wait", "--text", "Storage remains unavailable");
  check('document.querySelector("[name=composition-title]").value === "Recoverable quota work"', "a failed reset must preserve current work");
  assert.equal(evaluate(`localStorage.getItem(${JSON.stringify(exampleKey)})`), beforeQuota, "failed saves and resets must preserve stored bytes");
  browser("click", ".browser-menu > summary");
  capture("storage-unavailable");
  evaluate("Storage.prototype.setItem = window.__setItem; Storage.prototype.removeItem = window.__removeItem");
  browser("click", ".browser-menu-actions button:last-child");
  acceptConfirmation();
  browser("wait", "--fn", "!document.querySelector('.recovery') && document.querySelector('.browser-menu [role=status]').textContent.includes('saved only in this browser')");
  check(`JSON.parse(localStorage.getItem(${JSON.stringify(exampleKey)}))?.document.title === "Introducing Konpeki"`, "successful recovery must persist the restored example");

  evaluate(`localStorage.setItem(${JSON.stringify(exampleKey)}, "{broken"); location.reload()`);
  browser("wait", "--text", "This example's saved working copy could not be read");
  browser("click", ".browser-menu > summary");
  check("document.querySelector('.browser-menu-popover').textContent.includes('Changes are not being saved')", "blocked storage must not claim to save changes");
  browser("fill", '[name="composition-title"]', "Recoverable unsaved work");
  browser("press", "Tab");
  assert.equal(evaluate(`localStorage.getItem(${JSON.stringify(exampleKey)})`), '"{broken"');
  capture("storage-recovery");
  console.log("Playground OK: isolated save/reload, validation pause/resume, JSON round-trip/undo, blank/reset accept/cancel, quota/reset failure recovery, local-only copy, and no standalone Build/notes.");
} finally {
  try {
    browser("close");
  } catch {}
  rmSync(scratch, { recursive: true, force: true });
}
