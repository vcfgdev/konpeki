// Disposable file session; injected failures never touch a person's composition.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { createServer } from "vite";
import { fileSessionPlugin } from "../bin/session-plugin.ts";
import { initialDraft, addComponent } from "../composition/document.ts";
import { assertComposition } from "../composition/validate.ts";

const before = process.argv.includes("--before");
const artifacts = resolve(process.argv[2] ?? ".amp/in/artifacts/feedback");
await mkdir(artifacts, { recursive: true });
const scratch = await mkdtemp(join(tmpdir(), "konpeki-feedback-"));
const path = join(scratch, "composition.json");
const draft = addComponent(initialDraft(true), "text-block");
draft.title = "Feedback review";
draft.slides[0].components[0].content = "A long heading that no longer fits inside this text component.";
await writeFile(path, JSON.stringify(draft));
let failNotes = false;
let failSave = false;
let failLoad = false;
let holdLoads = false;
const heldLoads = [];
const server = await createServer({ server: { host: "127.0.0.1", port: 0 }, plugins: [{
  name: "feedback-test-failures",
  enforce: "pre",
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if ((failNotes && request.url === "/__konpeki/session/notes" && request.method === "POST") ||
          (failSave && request.url === "/__konpeki/session" && request.method === "PUT") ||
          (failLoad && request.url === "/__konpeki/session" && request.method === "GET")) {
        response.writeHead(503, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "The local file service is unavailable." }));
      } else if (holdLoads && request.url === "/__konpeki/session" && request.method === "GET") {
        heldLoads.push(next);
      } else next();
    });
  },
}, fileSessionPlugin({ compositionPath: path, token: "feedback-test" })] });
const exec = promisify(execFile);
const b = async (...args) => (await exec("agent-browser", ["--session", "feedback-check", ...args])).stdout.trim();
const evaluate = async source => JSON.parse(await b("eval", source));
const wait = expression => b("wait", "--fn", expression);
const click = name => b("find", "role", "button", "click", "--name", name, "--exact");
const field = (name, value) => b("find", "label", name, "fill", String(value));
const commit = async (name, value) => { await field(name, value); await b("press", "Enter"); };
const capture = async (name, selector) => {
  await b("eval", "document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))");
  await b("eval", "Promise.all(document.getAnimations().filter(a => a.effect.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})))");
  await b("screenshot", ...(selector ? [selector] : []), join(artifacts, `${name}.png`));
};
// Observe real state changes; pause at mid-exit to inspect retained content and reversal.
const watchExit = selector => evaluate(`(() => {
  window.feedbackExit = null;
  const notice = document.querySelector(${JSON.stringify(selector)});
  let text = notice.textContent;
  const observer = new MutationObserver(() => {
    if (notice.classList.contains('visible')) { text = notice.textContent; return; }
    observer.disconnect();
    const animations = notice.getAnimations();
    const opacity = animations.find(a => a.transitionProperty === 'opacity');
    animations.forEach(a => { a.pause(); a.currentTime = 60; });
    window.feedbackExit = {
      duration: opacity?.effect.getTiming().duration,
      opacity: Number(getComputedStyle(notice).opacity),
      retained: notice.textContent === text && text.length > 0,
      inert: notice.inert, hidden: notice.getAttribute('aria-hidden'),
    };
  });
  observer.observe(notice, { attributes: true, attributeFilter: ['class'] });
  return true;
})()`);
const checkExit = async () => {
  await wait("window.feedbackExit !== null");
  const state = await evaluate("window.feedbackExit");
  assert.equal(state.duration, 120);
  assert.ok(state.opacity > 0 && state.opacity < 1, "Exit must fade instead of snapping away");
  assert.equal(state.retained, true);
  assert.equal(state.inert, true);
  assert.equal(state.hidden, "true");
  return state.opacity;
};
const finishNoticeMotion = () => b("eval", "document.querySelectorAll('.feedback-notice').forEach(n=>n.getAnimations().forEach(a=>a.finish()))");
const checkRecoveryLayout = async () => {
  assert.equal(await evaluate(`(() => {
    const notice = document.querySelector('.recovery').getBoundingClientRect();
    const actions = document.querySelector('.recovery-actions');
    return notice.width <= 420 && notice.left >= 20 && notice.right <= innerWidth - 20 &&
      getComputedStyle(actions).justifyContent === 'flex-end' &&
      Math.abs(actions.lastElementChild.getBoundingClientRect().right - actions.getBoundingClientRect().right) < 1 &&
      [...actions.children].every(button => {
        const style = getComputedStyle(button);
        return style.borderWidth === '1px' && style.borderStyle === 'solid' &&
          ['rgb(229, 229, 229)', 'rgb(212, 212, 212)'].includes(style.borderColor);
      });
  })()`), true);
};
const y = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().y`);
const documentOnDisk = async () => JSON.parse(await readFile(path, "utf8"));
async function diskMatches(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate(await documentOnDisk())) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail("The expected document was not saved");
}
const metrics = {};
try {
  await server.listen();
  await b("open", `http://127.0.0.1:${server.httpServer.address().port}/?session=feedback-test`);
  await b("set", "viewport", "1556", "1030", "2");
  await wait("!!document.querySelector('#revision-note:not(:disabled)')");
  await click("Select Text block");
  await wait("!document.querySelector('.toast.visible')");
  await capture("normal");
  if (!before) {
    // Pointer interaction inside the rename field must not trigger stage deselection.
    await b("dblclick", ".stage-meta h2");
    await field("Page name", "Renamed with Enter");
    await b("click", 'input[aria-label="Page name"]');
    assert.equal(await evaluate('document.activeElement?.getAttribute("aria-label")'), "Page name");
    await b("press", "Enter");
    await diskMatches(document => document.slides[0].name === "Renamed with Enter");
    await b("dblclick", ".stage-meta h2");
    await field("Page name", "Renamed with outside click");
    await click("Settings");
    await diskMatches(document => document.slides[0].name === "Renamed with outside click");
    assert.equal(await evaluate('!!document.querySelector("input[aria-label=\\"Page name\\"]")'), false);
    await click("Select Text block");
  }
  const fontSelector = '.text-typography-fields input[type="number"]';
  metrics.fontBeforeY = await y(fontSelector);
  await commit("Font size", 500);
  metrics.invalidFont = await evaluate(`({value:document.querySelector('${fontSelector}').value,invalid:document.querySelector('${fontSelector}').getAttribute('aria-invalid')})`);
  metrics.fontAfterY = await y(fontSelector);
  await capture("invalid-font");
  if (!before) {
    assert.deepEqual(metrics.invalidFont, { value: "500", invalid: "true" });
    assert.deepEqual(await evaluate(`(() => { const input = document.querySelector('${fontSelector}'); const style = getComputedStyle(input); return { focused: input.matches(':focus-visible'), outline: style.outlineColor, offset: style.outlineOffset, shadow: style.boxShadow }; })()`), {
      focused: true, outline: "rgb(177, 61, 61)", offset: "-1px", shadow: "none",
    });
    assert.equal(metrics.fontBeforeY, metrics.fontAfterY);
    assert.equal((await documentOnDisk()).slides[0].components[0].textStyle?.size ?? 36, 36);
    await b("press", "Escape");
    assert.equal(await evaluate(`document.querySelector('${fontSelector}').value`), "36");
    for (const invalid of [7, 241, ""]) {
      if (invalid === "") {
        // Clear with keystrokes: CDP fill('') does not emit input in this browser build.
        await b("focus", fontSelector);
        await b("press", "Control+a");
        await b("press", "Backspace");
      } else await b("fill", fontSelector, String(invalid));
      assert.equal(await evaluate(`document.querySelector('${fontSelector}').value`), String(invalid));
      await b("press", "Enter");
      assert.equal(await evaluate(`document.querySelector('${fontSelector}').getAttribute('aria-invalid')`), "true", `Rejected font size ${JSON.stringify(invalid)}`);
      await b("press", "Escape");
    }
    for (const valid of [8, 240, 36]) {
      await commit("Font size", valid);
      await diskMatches(document => document.slides[0].components[0].textStyle.size === valid);
    }
    await field("Line height", 1.7);
    await b("press", "Tab");
    await diskMatches(document => document.slides[0].components[0].textStyle.lineHeight === 1.7);
    await commit("Line height", 1.4);
    await commit("Font size", 42);
    await wait("!document.querySelector('.file-status.saving') && !document.querySelector('.recovery.visible')");
    await click("Select Text block");
    await b("press", "Control+z");
    await wait(`document.querySelector('${fontSelector}').value==='36'`);
    // Real pointerdown must commit before deselection unmounts the inspector.
    for (const [selector, size] of [["#canvas-stage", 42], [".canvas", 47]]) {
      await field("Font size", size);
      const point = await evaluate(`(() => {
        const target = document.querySelector('${selector}');
        const rect = target.getBoundingClientRect();
        const x = Math.round(${selector === ".canvas" ? "rect.right - 8" : "rect.left + 8"});
        const y = Math.round(rect.bottom - 8);
        return { x, y, blank: document.elementFromPoint(x, y) === target };
      })()`);
      assert.equal(point.blank, true, "Pointer must hit the blank surface, not a child control");
      await b("mouse", "move", String(point.x), String(point.y));
      await b("mouse", "down", "left");
      await b("mouse", "up", "left");
      await wait("!document.querySelector('[data-component].selected')");
      await diskMatches(document => document.slides[0].components[0].textStyle.size === size);
      await click("Select Text block");
      assert.equal(await evaluate(`document.querySelector('${fontSelector}').value`), String(size));
    }
    await commit("Font size", 36);
  }
  await commit("Width", 9999);
  metrics.invalidWidth = await evaluate('document.querySelector("input[name=width]").value');
  if (!before) assert.equal(metrics.invalidWidth, "9999");
  await commit("Width", 560);
  metrics.textBeforeY = await y('textarea[name="text-content"]');
  await commit("Height", 72);
  await wait("!!document.querySelector('.field-error, .overflow-trigger:not(:disabled)')");
  metrics.textAfterY = await y('textarea[name="text-content"]');
  if (!before) {
    assert.equal(metrics.textAfterY, metrics.textBeforeY);
    await capture("overflow-closed");
    await b("click", ".overflow-trigger");
  }
  await capture("overflow");
  if (!before) {
    await b("click", ".overflow-popover button");
    assert.equal(await evaluate("!!document.querySelector('[data-component].selected')"), true);
    await commit("Height", 420);
    await wait("!!document.querySelector('.overflow-trigger:disabled')");
  } else await commit("Height", 420);
  await click("Notes");
  await wait("!document.querySelector('#revision-note').disabled");
  await field("Request a change", "Keep this note draft if saving fails.");
  metrics.notesBeforeY = await y(".revision-note-count");
  failNotes = true;
  await click("Add note");
  await wait("!!document.querySelector('.revision-note-error, .toast.error.visible')");
  metrics.notesAfterY = await y(".revision-note-count");
  metrics.noteDraft = await evaluate("document.querySelector('#revision-note').value");
  await capture("note-failure");
  if (!before) {
    assert.doesNotMatch(await evaluate("document.querySelector('.toast').textContent"), /Try again/);
    assert.deepEqual(await evaluate("[...document.querySelectorAll('.toast button')].map(button => button.getAttribute('aria-label'))"), ["Dismiss notification"]);
    assert.equal(await evaluate("[...document.querySelectorAll('.toast button')].every(button => getComputedStyle(button).borderWidth === '0px')"), true);
    await capture("note-notification", ".toast");
    await b("hover", ".toast button:first-of-type");
    await wait("getComputedStyle(document.querySelector('.toast button')).backgroundColor === 'rgb(242, 242, 242)'");
    await capture("note-notification-hover", ".toast");
    assert.equal(metrics.notesBeforeY, metrics.notesAfterY);
    assert.equal(metrics.noteDraft, "Keep this note draft if saving fails.");
    // Longer than the former three-second error timeout.
    await new Promise(resolve => setTimeout(resolve, 3600));
    assert.equal(await evaluate("!!document.querySelector('.toast.error.visible')"), true);
    await watchExit(".toast");
    await click("Dismiss notification");
    const exitOpacity = await checkExit();
    await b("eval", `(() => {
      window.feedbackReentry = null;
      const notice = document.querySelector('.toast');
      const observer = new MutationObserver(() => {
        if (!notice.classList.contains('visible')) return;
        observer.disconnect();
        const opacity = notice.getAnimations().find(a => a.transitionProperty === 'opacity');
        window.feedbackReentry = { from: Number(opacity?.effect.getKeyframes()[0].opacity), inert: notice.inert };
      });
      observer.observe(notice, { attributes: true, attributeFilter: ['class'] });
    })()`);
    await click("Add note");
    await wait("window.feedbackReentry !== null");
    const reentry = await evaluate("window.feedbackReentry");
    assert.ok(Math.abs(reentry.from - exitOpacity) < 0.01, "New notice must reverse from the current opacity, not restart");
    assert.equal(reentry.inert, false);
    await finishNoticeMotion();
    await click("Dismiss notification");
    await wait("!document.querySelector('.toast.visible')");
    assert.equal(await evaluate("document.querySelector('#revision-note').value"), "Keep this note draft if saving fails.");
    await field("Request a change", "Save this revised draft through Add note.");
    failNotes = false;
    await click("Add note");
    await wait("document.querySelectorAll('.revision-note-list li').length===1");
    assert.equal(await evaluate("document.querySelector('#revision-note').value"), "");
    assert.equal(await evaluate("document.querySelector('.revision-note-list li p').textContent"), "Save this revised draft through Add note.");
    assert.equal(await evaluate("!!document.querySelector('.toast.error.visible')"), false);
  }
  failNotes = false;
  failSave = true;
  await field("Composition title", "Unsaved browser edit");
  await wait(before ? "!!document.querySelector('.toast.error.visible')" : "!!document.querySelector('.recovery.visible')");
  await click("Collapse left panel");
  await click("Collapse right panel");
  await capture("save-failure-collapsed");
  if (!before) {
    await checkRecoveryLayout();
    await capture("save-notice", ".recovery");
    await b("hover", ".recovery-actions button:last-child");
    await wait("getComputedStyle(document.querySelector('.recovery-actions button:last-child')).backgroundColor === 'rgb(242, 242, 242)'");
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.recovery-actions button:last-child')).borderColor"), "rgb(212, 212, 212)");
    await capture("save-notice-hover", ".recovery");
    await b("press", "Tab");
    await b("press", "Shift+Tab");
    await b("focus", ".recovery-actions button:last-child");
    assert.equal(await evaluate("document.querySelector('.recovery-actions button:last-child').matches(':focus-visible') && getComputedStyle(document.querySelector('.recovery-actions button:last-child')).outlineStyle === 'solid'"), true);
    await capture("save-notice-focus", ".recovery");
    assert.equal((await documentOnDisk()).title, "Feedback review");
    assert.match(await evaluate("document.querySelector('.recovery').textContent"), /not saved/i);
    await watchExit(".recovery");
    failSave = false;
    await click("Retry save");
    await checkExit();
    await finishNoticeMotion();
    await wait("!document.querySelector('.recovery.visible')");
    assert.equal((await documentOnDisk()).title, "Unsaved browser edit");

    // A real on-disk revision change must never overwrite dirty browser work.
    await click("Expand left panel");
    failSave = true;
    await field("Composition title", "Browser version to preserve");
    await wait("!!document.querySelector('.recovery.visible')");
    const remote = await documentOnDisk();
    remote.title = "Agent version";
    await writeFile(path, JSON.stringify(remote));
    await wait("!!document.querySelector('.file-status.conflict')");
    failSave = false;
    await capture("conflict");
    await checkRecoveryLayout();
    await capture("conflict-notice", ".recovery");
    await b("set", "viewport", "390", "844", "2");
    await checkRecoveryLayout();
    await capture("conflict-narrow");
    await b("set", "viewport", "1556", "1030", "2");
    await b("eval", `window.savedBlobText=''; window.originalBlobURL=URL.createObjectURL; URL.createObjectURL=blob=>{blob.text().then(text=>window.savedBlobText=text);return window.originalBlobURL(blob)}`);
    // Observe before triggering a fresh neutral notice; startup may already have expired.
    await watchExit(".toast");
    await click("Download JSON");
    await wait("window.savedBlobText.length>0");
    assert.equal(JSON.parse(await evaluate("window.savedBlobText")).title, "Browser version to preserve");
    await checkExit();
    await finishNoticeMotion();
    await click("Load file version");
    await b("dialog", "dismiss");
    assert.equal(await evaluate("document.querySelector('input[name=composition-title]').value"), "Browser version to preserve");
    assert.equal((await documentOnDisk()).title, "Agent version");
    holdLoads = true;
    // Hold a poll that started before the explicit reload as well as the reload.
    for (let i = 0; !heldLoads.length && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 50));
    assert.ok(heldLoads.length > 0);
    await click("Load file version");
    await b("dialog", "accept");
    await wait("document.querySelector('.workspace').inert && !!document.querySelector('.file-status.loading')");
    const oldPolls = heldLoads.splice(0, heldLoads.length - 1);
    assert.ok(oldPolls.length > 0);
    oldPolls.forEach(release => release());
    await b("press", "Control+z");
    assert.equal(await evaluate("document.querySelector('input[name=composition-title]').value"), "Browser version to preserve");
    assert.equal(await evaluate("(() => { const title = document.querySelector('input[name=composition-title]'); title.focus(); return document.activeElement === title; })()"), false);
    assert.equal(await evaluate("document.querySelector('.recovery-actions button:last-child').disabled"), true);
    await b("eval", "document.querySelector('.recovery-actions button:last-child').click()");
    await new Promise(resolve => setTimeout(resolve, 1200));
    assert.equal(heldLoads.length, 1, "Reload must serialize requests and pause polling");
    assert.equal(await evaluate("document.querySelector('.workspace').inert && !!document.querySelector('.file-status.loading')"), true);
    assert.equal((await documentOnDisk()).title, "Agent version");
    await capture("reload-paused");
    await capture("reload-paused-notice", ".recovery");
    holdLoads = false;
    heldLoads.shift()();
    await wait("!document.querySelector('.recovery.visible') && document.querySelector('input[name=composition-title]').value==='Agent version'");
    assert.equal(await evaluate("document.querySelector('.workspace').inert"), false);

    // Initial connection failure offers file recovery, never a browser-storage reset.
    failLoad = true;
    await b("reload");
    await wait("!!document.querySelector('.recovery.visible')");
    assert.doesNotMatch(await evaluate("document.querySelector('.recovery').textContent"), /Reset/);
    assert.equal(await evaluate("document.querySelector('.workspace').inert"), true, "Fallback must not accept edits before a successful open");
    await capture("initial-open-failure", ".recovery");
    failLoad = false;
    holdLoads = true;
    await click("Retry open");
    await wait("!!document.querySelector('.file-status.loading')");
    assert.equal(await evaluate("document.querySelector('.workspace').inert && document.querySelector('.recovery-actions button').disabled"), true);
    await b("eval", "document.querySelector('.recovery-actions button').click()");
    await new Promise(resolve => setTimeout(resolve, 1200));
    assert.equal(heldLoads.length, 1);
    holdLoads = false;
    heldLoads.shift()();
    await wait("document.querySelector('input[name=composition-title]').value==='Agent version'");
    assert.equal(await evaluate("document.querySelector('.workspace').inert"), false);
    await click("Select Text block");
    for (const width of [1024, 390]) {
      await b("set", "viewport", String(width), "844", "2");
      await wait("document.querySelector('.right-panel .panel-toggle').getAttribute('aria-expanded') === 'false'");
      await click("Expand right panel");
      await commit("Font size", 500);
      assert.equal(await evaluate("document.documentElement.scrollWidth"), width);
      assert.equal(await evaluate("(()=>{const r=document.querySelector('.parameter-error').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()"), true);
      await capture(`invalid-font-${width}`);
      await b("press", "Escape");
      await click("Collapse right panel");
    }
    await b("set", "viewport", "1556", "1030", "2");
    const vectors = addComponent(await documentOnDisk(), "diagram");
    const diagram = vectors.slides[0].components.at(-1);
    diagram.preferredRect.width = 100;
    diagram.preferredRect.height = 50;
    diagram.customVisual = {
      format: "vector", viewBox: { x: 0, y: 0, width: 100, height: 100 },
      description: "Overflow warning test",
      elements: [{ id: "overflow-label", kind: "text", attributes: { x: 90, y: 50, "font-size": 24, fill: "theme:ink" }, text: "Too wide" }],
    };
    assertComposition(vectors);
    await writeFile(path, JSON.stringify(vectors));
    await wait("!!document.querySelector('[data-vector-element=overflow-label]')");
    await wait("!!document.querySelector('.overflow-trigger:not(:disabled)')");
    await b("focus", ".overflow-trigger");
    await b("press", "Enter");
    await wait("!!document.querySelector('.overflow-popover:popover-open')");
    await capture("vector-overflow");
    await b("press", "Escape");
    assert.equal(await evaluate("!!document.querySelector('.overflow-popover:popover-open')"), false);
    await b("click", ".overflow-trigger");
    await b("click", ".overflow-popover button");
    assert.equal(await evaluate("document.querySelector('.custom-visual-summary select').value"), "overflow-label");
    await commit("Width", 110);
    await commit("Height", 60);
    await diskMatches(document => document.slides[0].components.at(-1).preferredRect.height === 60);
    assert.equal((await documentOnDisk()).slides[0].components.at(-1).preferredRect.width, 110);
    await b("fill", 'input[name="vector-fill"]', "theme:invalid");
    await wait("!!document.querySelector('.recovery.visible')");
    assert.equal((await documentOnDisk()).slides[0].components.at(-1).customVisual.elements[0].attributes.fill, "theme:ink");
    await click("Undo edit");
    await wait("!document.querySelector('.recovery.visible')");
    await b("set", "media", "light", "reduced-motion");
    await b("fill", 'input[name="vector-fill"]', "theme:invalid");
    await wait("!!document.querySelector('.recovery.visible')");
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.recovery')).opacity"), "1");
    await click("Undo edit");
    await wait("!document.querySelector('.recovery.visible')");
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.recovery')).visibility"), "hidden");
    assert.equal(await evaluate("document.querySelector('.recovery').getAnimations().length"), 0);
    await b("set", "media", "light", "no-preference");
    metrics.overflow = "PASS: native and SVG targets; keyboard popover; invalid vector value pauses save and Undo restores validity";
    metrics.recovery = "PASS: note error is dismiss-only, draft preserved and resubmitted through Add note; conflict download/cancel/reload; editing locked during delayed opens; repeated retry and stale polls cannot interrupt reload";
    metrics.inputs = "PASS: lower/upper bounds, empty input, blur and blank-stage/page pointer commit, page-rename caret/Enter/outside click, undo, Escape and 390/1024px layouts";
    metrics.feedbackStyle = "PASS: single red input focus outline; dismiss stays borderless; subtly bordered recovery actions retain hover/focus and right alignment within 420px and narrow viewport";
    metrics.motion = "PASS: manual, automatic and recovery exits retain content for 120ms; mid-exit replacement reverses continuously; hidden notices inert; reduced motion immediate";
  }
  await writeFile(join(artifacts, "measurements.json"), JSON.stringify(metrics, null, 2));
  console.log(`${before ? "BEFORE recorded" : "PASS"}: ${JSON.stringify(metrics)}`);
} finally {
  await b("close").catch(() => {});
  await server.close();
  await rm(scratch, { recursive: true, force: true });
}
