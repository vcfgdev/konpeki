import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const [base = "http://localhost:4318", output = "/tmp/konpeki-page-zoom"] = process.argv.slice(2);
mkdirSync(output, { recursive: true });
const b = (...args) => execFileSync("agent-browser", ["--session", "page-zoom", ...args], { encoding: "utf8" }).trim();
const evaluate = code => JSON.parse(b("eval", code));
const settle = () => b("eval", "new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
const scale = () => evaluate("Number(document.querySelector('.page-board-content').style.zoom)");
const stored = () => evaluate("JSON.parse(localStorage.getItem('konpeki-composer/examples/v1/introducing-konpeki')).document");
const capture = name => { settle(); b("screenshot", resolve(output, `${name}.png`)); };
const near = (actual, expected, message, tolerance = .01) => assert.ok(Math.abs(actual - expected) < tolerance, `${message}: ${actual} vs ${expected}`);
function wheel(deltaY, options = {}) {
  return evaluate(`(() => {
    const event = new WheelEvent('wheel', ${JSON.stringify({ bubbles: true, cancelable: true, ctrlKey: true, clientX: 650, clientY: 380, deltaY, ...options })});
    document.querySelector('.page-board-content').dispatchEvent(event);
    return event.defaultPrevented;
  })()`);
}
function gesture(type, scale = 1) {
  return evaluate(`(() => {
    const event = new Event(${JSON.stringify(type)}, {bubbles:true,cancelable:true});
    Object.assign(event, {scale:${scale},clientX:650,clientY:380});
    document.querySelector('.page-board-content').dispatchEvent(event);
    return event.defaultPrevented;
  })()`);
}
const anchor = () => evaluate(`(() => {
  const board=document.querySelector('.page-board-content'), r=board.getBoundingClientRect(), z=Number(board.style.zoom);
  return [(650-r.left)/z,(380-r.top)/z];
})()`);
let cdp;
try {
  b("open", `${base}/?example=introducing-konpeki`); b("set", "viewport", "1440", "1000", "2");
  b("wait", "--fn", "document.querySelectorAll('.scene-artwork svg').length===7 && document.querySelector('.board-heading p').textContent.includes('Saved')");
  const original = stored();
  const launcher = evaluate("document.querySelector('.review-launcher').getBoundingClientRect().toJSON()");
  const pageWidth = evaluate("document.querySelector('.scene-canvas').getBoundingClientRect().width");

  // Native Chromium input: Ctrl+wheel is also the trackpad-pinch wheel contract.
  const endpoint = new URL(b("get", "cdp-url"));
  const targets = await fetch(`http://${endpoint.host}/json/list`).then(r => r.json());
  cdp = new WebSocket(targets.find(target => target.type === "page" && target.url.startsWith(base)).webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { cdp.addEventListener("open", resolve, { once: true }); cdp.addEventListener("error", reject, { once: true }); });
  let id = 0;
  const command = (method, params) => new Promise((resolve, reject) => {
    const request = ++id;
    const timer = setTimeout(() => { cdp.removeEventListener("message", receive); reject(new Error(`CDP timed out: ${method}`)); }, 10000);
    function receive(event) {
      const response = JSON.parse(event.data);
      if (response.id !== request) return;
      clearTimeout(timer); cdp.removeEventListener("message", receive);
      if (response.error) reject(new Error(JSON.stringify(response.error))); else resolve(response.result);
    }
    cdp.addEventListener("message", receive);
    cdp.send(JSON.stringify({ id: request, method, params }));
  });
  const before = anchor();
  // Chromium divides injected wheel deltas by the emulated device scale (2).
  await command("Input.dispatchMouseEvent", { type: "mouseWheel", x: 650, y: 380, deltaX: 0, deltaY: -Math.log(2) / .002 * 2, modifiers: 2 });
  b("wait", "--fn", "Number(document.querySelector('.page-board-content').style.zoom)>1.99"); settle();
  near(scale(), 2, "native Ctrl+wheel doubles canvas size");
  anchor().forEach((value, index) => near(value, before[index], "pointer anchor stays fixed", .5));
  near(evaluate("document.querySelector('.scene-canvas').getBoundingClientRect().width"), pageWidth * 2, "pages actually scale");
  assert.equal(evaluate("visualViewport.scale"), 1, "browser viewport itself does not zoom");
  assert.deepEqual(evaluate("document.querySelector('.review-launcher').getBoundingClientRect().toJSON()"), launcher);
  capture("zoomed-in");

  const position = () => evaluate("[document.querySelector('.workspace').scrollLeft,document.querySelector('.workspace').scrollTop]");
  const initialScroll = position();
  b("mouse", "move", "650", "380"); b("mouse", "wheel", "157", "113"); b("wait", "150");
  const scrolled = position();
  near(scrolled[0] - initialScroll[0], 113, "horizontal wheel pans");
  near(scrolled[1] - initialScroll[1], 157, "vertical wheel scrolls");
  near(scale(), 2, "ordinary scroll never zooms");
  assert.equal(wheel(40, { ctrlKey: false }), false, "ordinary wheel remains uncanceled");
  const scrolledAnchor = anchor();
  assert.equal(wheel(-Math.log(.75) / .002, { ctrlKey: false, metaKey: true }), true);
  near(scale(), 1.5, "Command+wheel zooms out");
  anchor().forEach((value, index) => near(value, scrolledAnchor[index], "zoom-out anchor after scrolling", .5));

  // Line/page deltas must not behave like pixel deltas; limits must recover.
  wheel(-1, { deltaMode: 1 }); near(scale(), 1.5 * Math.exp(.032), "line-mode wheel normalization");
  wheel(1, { deltaMode: 1 }); near(scale(), 1.5, "inverse wheel restores scale");
  wheel(-.1, { deltaMode: 2 }); near(scale(), 1.5 * Math.exp(.2), "page-mode wheel normalization");
  wheel(-100000); near(scale(), 4, "maximum zoom");
  wheel(100000); near(scale(), .25, "minimum zoom");
  capture("zoomed-out");
  wheel(-Math.log(4) / .002); near(scale(), 1, "can leave zoom limit");
  assert.deepEqual(stored(), original, "navigation never changes source or adds history");

  // Safari's scale is relative to gesturestart, not to the previous event.
  assert.equal(gesture("gesturestart"), true);
  gesture("gesturechange", 1.4); near(scale(), 1.4, "first Safari scale");
  wheel(-100); near(scale(), 1.4, "dual wheel events do not double-zoom");
  gesture("gesturechange", 1.8); near(scale(), 1.8, "Safari scale is not compounded");
  gesture("gestureend");
  wheel(-Math.log(2 / 1.8) / .002); near(scale(), 2, "wheel resumes after gesture ends");

  // Coordinate conversion for corrections must include the board zoom.
  const hit = '[data-page="cover"] .component-hit[data-component="cover-title"]';
  b("scrollintoview", hit); settle();
  const target = evaluate(`(() => {const r=document.querySelector(${JSON.stringify(hit)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,scale:document.querySelector('.scene-canvas').getBoundingClientRect().width/1920}})()`);
  b("mouse", "move", String(Math.round(target.x)), String(Math.round(target.y))); b("mouse", "down", "left");
  b("mouse", "move", String(Math.round(target.x)), String(Math.round(target.y + 24 * target.scale))); b("mouse", "up", "left"); b("wait", "350");
  assert.equal(stored().slides[0].components.find(item => item.id === "cover-title").area.row, 19, "24 authored pixels moves two baseline rows at 2x");
  b("press", "Control+z"); b("wait", "350"); assert.deepEqual(stored(), original, "zoomed drag undo is exact");
  b("dblclick", hit); b("fill", ".scene-text-editor", "Inline correction at 2×"); capture("zoomed-text");
  b("press", "Escape");
  b("click", "button[aria-label=Comment]"); b("click", hit); b("fill", "#revision-note", "A comment at this zoom.");
  near(evaluate("document.querySelector('.revision-notes').getBoundingClientRect().width"), 360, "comment composer stays unscaled");
  const followsTarget = `(()=>{const a=document.querySelector('${hit}').getBoundingClientRect(),p=document.querySelector('.comment-composer').getBoundingClientRect();return p.left>=16&&p.right<=innerWidth-16&&p.top>=16&&p.bottom<document.querySelector('.review-launcher').getBoundingClientRect().top&&[p.top-a.bottom,a.top-p.bottom,p.left-a.right,a.left-p.right].some(gap=>Math.abs(gap-12)<1)})()`;
  b("wait", "--fn", followsTarget);
  wheel(-Math.log(1.25) / .002); settle();
  b("wait", "--fn", followsTarget);
  near(evaluate("document.querySelector('.comment-composer').getBoundingClientRect().width"), 360, "zooming with the composer open does not scale it");
  assert.equal(evaluate("document.querySelector('#revision-note').value"), "A comment at this zoom.", "zoom preserves the focused draft");
  capture("zoomed-anchored-comment");
  wheel(Math.log(1.25) / .002); settle();
  capture("zoomed-comment"); b("press", "Escape");
  assert.deepEqual(stored(), original, "text cancel and draft comments preserve source");
  b("set", "viewport", "390", "844", "2"); settle();
  wheel(Math.log(2) / .002, { clientX: 195, clientY: 350 }); near(scale(), 1, "zoom survives responsive resize");
  b("eval", "document.querySelector('.workspace').scrollTo(0,0)");
  assert.equal(evaluate("document.querySelector('.workspace').scrollWidth <= document.querySelector('.workspace').clientWidth"), true, "return to fit removes horizontal overflow");
  capture("narrow-fit");
  assert.equal(b("errors"), "", "no browser errors");
  console.log("PASS: native Ctrl+wheel zoom, pointer anchoring, two-axis wheel scrolling, Command+wheel, delta modes, limits, Safari event sequence, zoomed drag/undo/text/comments, unchanged source, fixed controls and narrow fit.");
} finally {
  cdp?.close(); b("close");
}
