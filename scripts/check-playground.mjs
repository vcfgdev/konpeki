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
  browser("wait", "--fn", "!document.querySelector('.browser-menu').open || (getComputedStyle(document.querySelector('.browser-menu'), '::details-content').opacity === '1' && getComputedStyle(document.querySelector('.browser-menu-popover')).transform === 'none')");
  browser("find", "role", "button", "click", "--name", name, "--exact");
}
function check(source, message) {
  evaluate(`if (!(${source})) throw Error(${JSON.stringify(message)})`);
}
function settlePanels() {
  evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))).then(() => Promise.all([...document.querySelectorAll('.left-sidebar,.right-panel')].flatMap(element => element.getAnimations().map(a => a.finished))))");
}
function capture(name) {
  evaluate(
    "document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))",
  );
  browser("wait", "--fn", "getComputedStyle(document.querySelector('.browser-menu'), '::details-content').opacity === (document.querySelector('.browser-menu').open ? '1' : '0')");
  browser("wait", "--fn", "!document.querySelector('.browser-menu').open || getComputedStyle(document.querySelector('.browser-menu-popover')).transform === 'none'");
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

  evaluate(`(async () => {
    const menu = document.querySelector('.browser-menu'), summary = menu.querySelector('summary');
    const popover = menu.querySelector('.browser-menu-popover'), action = popover.querySelector('button');
    const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const style = () => getComputedStyle(menu, '::details-content');
    const assert = (condition, message) => { if (!condition) throw Error(message); };
    const canvas = document.querySelector('#canvas-stage .canvas');
    const before = canvas.getBoundingClientRect();
    async function sampleMotion(duration) {
      const samples = [], end = performance.now() + duration + 80;
      do {
        await new Promise(resolve => requestAnimationFrame(resolve));
        samples.push({ opacity: Number(style().opacity), transform: getComputedStyle(popover).transform });
        const after = canvas.getBoundingClientRect();
        assert(['x', 'y', 'width', 'height'].every(key => before[key] === after[key]), 'popover motion must not shift the canvas');
      } while (performance.now() < end);
      assert(samples.some(s => s.opacity > 0 && s.opacity < 1 && s.transform !== 'none'), 'Demo Mode must visibly fade and move, not jump');
      assert(style().transitionDuration.split(',')[0] === duration / 1000 + 's', 'incorrect Demo Mode motion duration');
    }
    assert(!menu.open && popover.inert, 'closed Demo Mode controls must be inert');
    summary.click(); await sampleMotion(180);
    assert(menu.open && !popover.inert, 'opening must enable Demo Mode controls');
    assert(style().opacity === '1', 'entrance must finish fully visible');
    action.focus();
    action.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await frame();
    assert(!menu.open && popover.inert && document.activeElement === summary, 'Escape must close logically and restore focus before exit finishes');
    assert(style().contentVisibility === 'visible', 'content must remain rendered during exit');
    action.focus();
    assert(document.activeElement !== action && !menu.open, 'fading controls must not receive focus or reopen native details');
    await frame();
    assert(Number(style().opacity) > 0 && Number(style().opacity) < 1, 'exit must fade before it is interrupted');
    summary.click(); await sampleMotion(180);
    assert(menu.open && !popover.inert, 'reopening during exit must enable controls');
    assert(style().opacity === '1', 'interrupted exit must return to fully visible');
    summary.click(); await sampleMotion(120);
    assert(style().opacity === '0' && style().contentVisibility === 'hidden' && popover.inert, 'exit must finish hidden and inert');
  })()`);
  browser("set", "media", "light", "reduced-motion");
  evaluate(`(async () => {
    const menu = document.querySelector('.browser-menu'), popover = menu.querySelector('.browser-menu-popover');
    for (const open of [true, false]) {
      menu.querySelector('summary').click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const style = getComputedStyle(menu, '::details-content');
      if (menu.open !== open || popover.inert === open || menu.getAnimations({ subtree: true }).length
        || style.opacity !== (open ? '1' : '0') || style.contentVisibility !== (open ? 'visible' : 'hidden'))
        throw Error('Reduced motion must open and close Demo Mode immediately');
    }
  })()`);
  browser("set", "media", "light", "no-reduced-motion");
  console.log("PASS: Demo Mode 180ms entrance / 120ms exit, inert fading controls, Escape focus, interrupted re-entry, no canvas shift, and reduced motion.");

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
  browser("wait", "--fn", "document.querySelector('.browser-menu-popover').checkVisibility()");
  browser("wait", "--fn", "document.querySelector('.browser-menu [role=status]').textContent.includes('saved only in this browser')");
  check("document.querySelector('.browser-menu > summary').textContent.trim() === 'Demo Mode'", "standalone disclosure must be labelled Demo Mode");
  check("document.querySelector('.browser-menu-popover').textContent.includes('saved only in this browser') && document.querySelector('.browser-menu-popover').textContent.includes('No agent connection or file sync')", "local-only storage limits are unclear");
  check("document.querySelectorAll('.browser-menu-intro p').length === 1 && document.querySelector('.browser-menu-intro p > [role=status]')", "Demo Mode intro and live save status must share one paragraph");
  check("[...document.querySelectorAll('.browser-menu-actions button')].every(button => { const style = getComputedStyle(button); return style.borderTopWidth === '1px' && style.borderTopStyle === 'solid' && style.borderTopColor === 'rgb(229, 229, 229)'; })", "all Demo Mode actions must have matching visible borders");
  check("document.querySelector('.browser-agent-handoff').textContent.includes('Export the JSON file, then ask your coding agent to open it with Konpeki.') && document.querySelector('.browser-agent-handoff a').href.endsWith('/SETUP.md')", "agent handoff must explain how to continue with the downloaded file");
  capture("demo-mode");
  browser("press", "Tab");
  check("document.activeElement.textContent.trim() === 'Import'", "keyboard opening must lead to the file actions");
  browser("press", "Escape");
  check("!document.querySelector('.browser-menu').open && document.activeElement.matches('.browser-menu > summary')", "Escape must close Demo Mode and return focus");
  browser("press", "Enter");
  browser("click", '[name="composition-title"]');
  check("!document.querySelector('.browser-menu').open && document.activeElement.name === 'composition-title'", "outside clicks must dismiss without stealing focus");
  browser("click", ".browser-menu > summary");
  browser("press", "Shift+Tab");
  check("!document.querySelector('.browser-menu').open && document.activeElement.getAttribute('aria-label') === 'Present'", "tabbing outside must dismiss the menu");

  for (const [width, height] of [[390, 844], [320, 568], [844, 390]]) {
    browser("set", "viewport", String(width), String(height), "2");
    settlePanels();
    if (evaluate("document.querySelector('.left-sidebar').classList.contains('collapsed')") === "true") click("Expand left panel");
    settlePanels();
    browser("click", ".browser-menu > summary");
    browser("wait", "--fn", "document.querySelector('.browser-menu').open && getComputedStyle(document.querySelector('.browser-menu'), '::details-content').opacity === '1' && getComputedStyle(document.querySelector('.browser-menu-popover')).transform === 'none'");
    evaluate(`{
      const menu = document.querySelector('.browser-menu-popover'), r = menu.getBoundingClientRect();
      if (r.left < 0 || r.right > innerWidth || r.top < parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--panel-top')) || r.bottom > innerHeight || menu.scrollWidth > menu.clientWidth)
        throw Error('Demo Mode overflows the viewport');
      for (const action of menu.querySelectorAll('button, a')) {
        action.scrollIntoView({ block: 'nearest' });
        const b = action.getBoundingClientRect();
        if (b.height < 40 || !action.contains(document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2)))
          throw Error('Demo action is too small or unreachable: ' + action.textContent + ' at ' + innerWidth + 'px; height=' + b.height + ', transform=' + getComputedStyle(menu).transform);
      }
      menu.scrollTop = 0;
      const heading = menu.querySelector('strong'), h = heading.getBoundingClientRect();
      if (!heading.contains(document.elementFromPoint(h.left + 2, (h.top + h.bottom) / 2)))
        throw Error('Panel chrome paints over the Demo Mode heading');
    }`);
    capture(`demo-mode-${width}`);
    browser("press", "Escape");
  }
  browser("set", "viewport", "1440", "900", "2");
  settlePanels();

  const validCopy = evaluate(`localStorage.getItem(${JSON.stringify(exampleKey)})`);
  browser("click", '[name="composition-title"]');
  browser("press", "Control+a");
  browser("press", "Backspace");
  browser("press", "Tab");
  check("document.querySelector('.browser-menu [role=status]').textContent.includes('Autosave paused: /title')", "invalid title must explain why autosave is paused");
  check("!document.querySelector('.browser-menu [role=status]').textContent.includes('saved only')", "invalid edits must not be described as saved");
  evaluate("new Promise(resolve => setTimeout(resolve, 350))");
  assert.equal(evaluate(`localStorage.getItem(${JSON.stringify(exampleKey)})`), validCopy, "invalid edits must preserve the last valid save");
  browser("click", ".browser-menu > summary");
  capture("validation-paused");
  browser("fill", '[name="composition-title"]', "Edited example copy");
  browser("press", "Tab");
  browser("wait", "--fn", "document.querySelector('.browser-menu [role=status]').textContent.includes('saved only in this browser')");
  assert.equal(evaluate(`localStorage.getItem(${JSON.stringify(exampleKey)})`), validCopy, "correcting validation must resume saving without reset");
  browser("click", ".browser-menu > summary");
  click("Export");
  check("!document.querySelector('.browser-menu').open && document.activeElement.matches('.browser-menu > summary')", "download must close the menu and restore focus");
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
  click("Import");
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
  click("Export");
  browser("wait", "--fn", 'typeof window.__downloadedJSON === "string"');
  assert.equal(JSON.parse(JSON.parse(evaluate("window.__downloadedJSON"))).title, "Recoverable quota work", "unsaved work must remain downloadable");
  browser("click", ".browser-menu > summary");
  click("Reset example");
  acceptConfirmation();
  browser("wait", "--text", "Storage remains unavailable");
  check('document.querySelector("[name=composition-title]").value === "Recoverable quota work"', "a failed reset must preserve current work");
  assert.equal(evaluate(`localStorage.getItem(${JSON.stringify(exampleKey)})`), beforeQuota, "failed saves and resets must preserve stored bytes");
  browser("click", ".browser-menu > summary");
  capture("storage-unavailable");
  evaluate("Storage.prototype.setItem = window.__setItem; Storage.prototype.removeItem = window.__removeItem");
  browser("click", ".browser-menu > summary");
  click("Retry save");
  browser("wait", "--fn", "!document.querySelector('.recovery.visible') && document.querySelector('.browser-menu [role=status]').textContent.includes('saved only in this browser')");
  check(`JSON.parse(localStorage.getItem(${JSON.stringify(exampleKey)}))?.document.title === "Recoverable quota work"`, "Retry save must preserve dirty work, not reset it");

  evaluate(`localStorage.setItem(${JSON.stringify(exampleKey)}, "{broken"); location.reload()`);
  browser("wait", "--text", "This example's saved working copy could not be read");
  browser("click", ".browser-menu > summary");
  check("document.querySelector('.browser-menu-popover').textContent.includes('Changes are not being saved')", "blocked storage must not claim to save changes");
  browser("fill", '[name="composition-title"]', "Recoverable unsaved work");
  browser("press", "Tab");
  assert.equal(evaluate(`localStorage.getItem(${JSON.stringify(exampleKey)})`), '"{broken"');
  browser("click", ".browser-menu > summary");
  capture("storage-recovery");
  check("!document.querySelector('.recovery').textContent.includes('Retry save')", "corrupt bytes must remain protected until explicit reset");
  browser("click", ".browser-menu > summary");
  browser("click", ".recovery-actions button:last-child");
  acceptConfirmation();
  browser("wait", "--fn", `JSON.parse(localStorage.getItem(${JSON.stringify(exampleKey)}))?.document.title === "Introducing Konpeki"`);
  evaluate(`window.__setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function () { throw new DOMException("full", "QuotaExceededError"); }`);
  browser("fill", '[name="composition-title"]', "Keep work after corruption reset");
  browser("press", "Tab");
  browser("wait", "--text", "Unable to save this browser-local draft");
  check("document.querySelector('.recovery').textContent.includes('Retry save')", "a successful reset must unblock later save retries");
  evaluate("Storage.prototype.setItem = window.__setItem");
  click("Retry save");
  browser("wait", "--fn", `!document.querySelector('.recovery.visible') && JSON.parse(localStorage.getItem(${JSON.stringify(exampleKey)}))?.document.title === "Keep work after corruption reset"`);
  console.log("Playground OK: Demo Mode keyboard/outside dismissal and focus, reachable 40px actions at 320/390/844px, isolated save/reload, validation pause/resume, JSON round-trip/undo, blank/reset accept/cancel, quota/reset failure recovery, dirty Retry save including after corruption reset, local-only copy, and no standalone Build/notes.");
} finally {
  try {
    browser("close");
  } catch {}
  rmSync(scratch, { recursive: true, force: true });
}
