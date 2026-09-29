import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const [base = "http://localhost:4318", output = "/tmp/konpeki-page-zoom"] = process.argv.slice(2);
mkdirSync(output, { recursive: true });
const b = (...args) => execFileSync("agent-browser", ["--session", "page-zoom", ...args], { encoding: "utf8" }).trim();
const evaluate = code => JSON.parse(b("eval", code));
const settle = () => { b("wait", "--fn", "!document.querySelector('.page-board-content').hasAttribute('data-zooming')"); b("eval", "new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))"); };
const scale = () => { settle(); return evaluate("Number(document.querySelector('.page-board-content').style.zoom)"); };
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
  b("open", new URL("legacy.html?example=introducing-konpeki", base).href); b("set", "viewport", "1440", "1000", "2");
  b("wait", "--fn", "document.querySelectorAll('.scene-artwork svg').length===7 && !!localStorage.getItem('konpeki-composer/examples/v1/introducing-konpeki')");
  assert.equal(evaluate("!!document.querySelector('.board-heading p')"), false, "the status subtitle is removed");
  assert.equal(evaluate("[...document.querySelectorAll('.stage-meta')].every(header=>{const n=header.querySelector('.page-index').getBoundingClientRect(),t=header.querySelector('h2').getBoundingClientRect();return Math.abs(n.top-t.top)<.1&&Math.abs(n.bottom-t.bottom)<.1&&t.left>n.right})"), true, "page number and title share one baseline and size");
  assert.equal(evaluate("(()=>{const pages=[...document.querySelectorAll('.board-page')].map(p=>p.getBoundingClientRect());return pages.every((p,i)=>p.top===pages[0].top&&(!i||p.left>pages[i-1].right))&&pages[0].width>innerWidth*.8&&pages[0].bottom<innerHeight})()"), true, "one horizontal row, with the first page nearly filling the viewport");
  capture("default-horizontal-row");
  const original = stored();
  const launcher = evaluate("document.querySelector('.review-launcher').getBoundingClientRect().toJSON()");
  const pageWidth = evaluate("document.querySelector('.scene-canvas').getBoundingClientRect().width");
  b("eval", "document.querySelector('.workspace').scrollLeft=document.querySelector('.workspace').scrollWidth");
  near(evaluate("innerWidth-document.querySelector('.board-page:last-child').getBoundingClientRect().right"), 48, "last page keeps the desktop right gutter", 1);
  capture("last-page-padding");
  wheel(Math.log(2) / .004); near(scale(), .5, "half-size row");
  b("eval", "document.querySelector('.workspace').scrollTo(0,0)");
  assert.equal(evaluate("(()=>{const b=document.querySelector('.page-board-content').getBoundingClientRect(),v=document.querySelector('.workspace'),h=document.querySelector('.board-help'),bottom=v.clientHeight-32-h.offsetHeight-24,top=document.querySelector('.board-heading').getBoundingClientRect().bottom+24;return Math.abs(b.top+b.bottom-top-bottom)<1})()"), true, "zoomed-out row is vertically centered between heading and footer");
  capture("centered-half-size");
  b("eval", "document.querySelector('.workspace').scrollLeft=document.querySelector('.workspace').scrollWidth");
  near(evaluate("innerWidth-document.querySelector('.board-page:last-child').getBoundingClientRect().right"), 48, "right gutter does not shrink with zoom", 1);
  wheel(-Math.log(2) / .004); near(scale(), 1, "return from half-size");
  b("eval", "document.querySelector('.workspace').scrollTo(0,0)");
  const burst = evaluate(`(()=>{
    const board=document.querySelector('.page-board-content');
    window.zoomWrites=0;window.zoomObserver=new MutationObserver(records=>window.zoomWrites+=records.length);
    window.zoomObserver.observe(board,{attributes:true,attributeFilter:['style']});
    const start=performance.now();
    for(let i=0;i<60;i++)board.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,deltaY:-1,clientX:650,clientY:380}));
    return {eventBurstMs:performance.now()-start,immediateZoom:Number(board.style.zoom)};
  })()`);
  assert.equal(burst.immediateZoom, 1, "input queues a frame instead of synchronously reconciling every page");
  near(scale(), 1.2712491503, "small trackpad deltas accumulate at the stronger response");
  const writes = evaluate("window.zoomObserver.disconnect();window.zoomWrites");
  assert.ok(writes > 1 && writes < 60, `wheel events coalesce into eased frames: ${writes}`);
  console.log(`Zoom burst: 60 events handled in ${burst.eventBurstMs.toFixed(1)} ms; ${writes} eased updates.`);
  wheel(60); near(scale(), 1, "inverse burst returns to fit");

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
  b("eval", "document.querySelector('.workspace').scrollTo(0,0)");
  // JavaScript receives injected deltas divided by the emulated device scale (2).
  await command("Input.dispatchMouseEvent", { type: "mouseWheel", x: 650, y: 380, deltaX: 0, deltaY: 240 });
  b("wait", "150");
  near(evaluate("document.querySelector('.workspace').scrollLeft"), 120, "plain wheel navigates the fitted row horizontally");
  near(evaluate("document.querySelector('.workspace').scrollTop"), 0, "fitted pages have no vertical overflow");
  b("mouse", "move", "650", "380"); b("mouse", "wheel", "0", "80"); b("wait", "150");
  near(evaluate("document.querySelector('.workspace').scrollLeft"), 200, "native horizontal trackpad panning is preserved");
  near(scale(), 1, "row navigation does not zoom");
  b("eval", "document.querySelector('.workspace').scrollTo(0,0)");
  const before = anchor();
  // Chromium divides injected wheel deltas by the emulated device scale (2).
  await command("Input.dispatchMouseEvent", { type: "mouseWheel", x: 650, y: 380, deltaX: 0, deltaY: -Math.log(2) / .004 * 2, modifiers: 2 });
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
  assert.equal(wheel(-Math.log(.75) / .004, { ctrlKey: false, metaKey: true }), true);
  near(scale(), 1.5, "Command+wheel zooms out");
  anchor().forEach((value, index) => near(value, scrolledAnchor[index], "zoom-out anchor after scrolling", .5));

  // Line/page deltas must not behave like pixel deltas; limits must recover.
  wheel(-1, { deltaMode: 1 }); near(scale(), 1.5 * Math.exp(.064), "line-mode wheel normalization");
  wheel(1, { deltaMode: 1 }); near(scale(), 1.5, "inverse wheel restores scale");
  wheel(-.1, { deltaMode: 2 }); near(scale(), 1.5 * Math.exp(.4), "page-mode wheel normalization");
  wheel(-100000); near(scale(), 4, "maximum zoom");
  wheel(100000); near(scale(), .1, "minimum zoom shows the full sequence");
  assert.equal(evaluate("(()=>{const pages=[...document.querySelectorAll('.board-page')].map(p=>p.getBoundingClientRect());return pages.every(p=>p.left>=0&&p.right<=innerWidth&&p.top>=0&&p.bottom<=innerHeight)})()"), true, "all seven pages fit at overview scale");
  assert.equal(evaluate("(()=>{const b=document.querySelector('.page-board-content').getBoundingClientRect(),v=document.querySelector('.workspace'),h=document.querySelector('.board-help'),bottom=v.clientHeight-32-h.offsetHeight-24,top=document.querySelector('.board-heading').getBoundingClientRect().bottom+24;return Math.abs(b.left+b.right-v.clientWidth)<1&&Math.abs(b.top+b.bottom-top-bottom)<1})()"), true, "overview is centered on both axes in the available canvas");
  capture("zoomed-out");
  wheel(-Math.log(10) / .004); near(scale(), 1, "can leave zoom limit");
  assert.deepEqual(stored(), original, "navigation never changes source or adds history");

  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  const reduced = evaluate(`new Promise(resolve=>{
    document.querySelector('.page-board-content').dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,deltaY:-Math.log(1.25)/.004,clientX:650,clientY:380}));
    requestAnimationFrame(()=>{const board=document.querySelector('.page-board-content');resolve({scale:Number(board.style.zoom),animating:board.hasAttribute('data-zooming')})});
  })`);
  near(reduced.scale, 1.25, "reduced motion reaches its target in one frame");
  assert.equal(reduced.animating, false, "reduced motion has no easing tail");
  wheel(Math.log(1.25) / .004); near(scale(), 1, "reduced-motion zoom-out");
  await command("Emulation.setEmulatedMedia", { features: [] });

  // Safari's scale is relative to gesturestart, not to the previous event.
  assert.equal(gesture("gesturestart"), true);
  gesture("gesturechange", 1.4); near(scale(), 1.4, "first Safari scale");
  wheel(-100); near(scale(), 1.4, "dual wheel events do not double-zoom");
  gesture("gesturechange", 1.8); near(scale(), 1.8, "Safari scale is not compounded");
  gesture("gestureend");
  wheel(-Math.log(2 / 1.8) / .004); near(scale(), 2, "wheel resumes after gesture ends");

  // Coordinate conversion for corrections must include the board zoom.
  const hit = '[data-page="cover"] .component-hit[data-component="cover-title"]';
  b("scrollintoview", hit); settle();
  const target = evaluate(`(() => {const r=document.querySelector(${JSON.stringify(hit)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,scale:document.querySelector('.scene-canvas').getBoundingClientRect().width/1920}})()`);
  b("eval", "document.addEventListener('pointerdown',event=>window.dragPointer=event.pointerId,{once:true,capture:true})");
  b("mouse", "move", String(Math.round(target.x)), String(Math.round(target.y))); b("mouse", "down", "left");
  const dragBurst = evaluate(`(async()=>{
    const hit=document.querySelector('${hit}'), before=hit.getBoundingClientRect(), svgs=[...document.querySelectorAll('.scene-artwork svg')];
    const handle=document.querySelector('[data-page=cover] .resize-se'), handleBefore=handle.getBoundingClientRect();
    let writes=0;const observer=new MutationObserver(records=>writes+=records.length);observer.observe(hit,{attributes:true,attributeFilter:['style']});
    const start=performance.now();
    for(let i=1;i<=60;i++)hit.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:window.dragPointer,buttons:1,
      clientX:${Math.round(target.x)}+13*${target.scale}*i/60,clientY:${Math.round(target.y)}+17*${target.scale}*i/60}));
    const eventBurstMs=performance.now()-start;
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    observer.disconnect();
    const after=hit.getBoundingClientRect(),handleAfter=handle.getBoundingClientRect();
    return {eventBurstMs,writes,dx:(after.left-before.left)/${target.scale},dy:(after.top-before.top)/${target.scale},
      handleDx:(handleAfter.left-handleBefore.left)/${target.scale},handleDy:(handleAfter.top-handleBefore.top)/${target.scale},
      sameSVG:svgs.every((svg,i)=>svg===document.querySelectorAll('.scene-artwork svg')[i])};
  })()`);
  near(dragBurst.dx, 13, "drag follows a free horizontal pixel delta at 2x", .02);
  near(dragBurst.dy, 17, "drag follows an independent vertical pixel delta at 2x", .02);
  near(dragBurst.handleDx, 13, "resize handles follow the preview", .02);
  near(dragBurst.handleDy, 17, "resize handles follow both preview axes", .02);
  assert.equal(dragBurst.writes, 1, "60 pointer events paint one preview frame");
  assert.equal(dragBurst.sameSVG, true, "no page SVG is rebuilt while dragging");
  b("wait", "350"); assert.deepEqual(stored(), original, "preview never persists intermediate geometry");
  capture("zoomed-drag-preview");
  console.log(`Drag burst: 60 events handled in ${dragBurst.eventBurstMs.toFixed(1)} ms; ${dragBurst.writes} preview update, no SVG replacement.`);
  const nativeDropDy = Math.round((Math.round(target.y + 24 * target.scale) - Math.round(target.y)) / target.scale);
  b("mouse", "move", String(Math.round(target.x)), String(Math.round(target.y + 24 * target.scale))); b("mouse", "up", "left"); b("wait", "350");
  assert.equal(stored().pages[0].components.find(item => item.id === "cover-title").rect.y,
    original.pages[0].components.find(item => item.id === "cover-title").rect.y + nativeDropDy, "drop persists the exact authored pixel delta at 2x");
  assert.equal(evaluate("document.querySelector('[data-page=cover] .component-hit.selected').style.translate"), "", "drop removes the temporary transform");
  b("press", "Control+z"); b("wait", "350"); assert.deepEqual(stored(), original, "zoomed drag undo is exact");

  // Release before the queued paint, at a different position than the last move.
  b("mouse", "move", String(Math.round(target.x)), String(Math.round(target.y)));
  b("eval", "document.addEventListener('pointerdown', event=>{window.dragPointerId=event.pointerId},{once:true,capture:true})");
  b("mouse", "down", "left");
  b("eval", `(()=>{const hit=document.querySelector('${hit}'), init={bubbles:true,pointerId:window.dragPointerId,clientX:${Math.round(target.x)}};
    hit.dispatchEvent(new PointerEvent('pointermove',{...init,clientY:${Math.round(target.y) + 13 * target.scale}}));
    hit.dispatchEvent(new PointerEvent('pointerup',{...init,clientY:${Math.round(target.y) + 24 * target.scale}}));
  })()`);
  b("mouse", "up", "left"); b("wait", "350");
  assert.equal(stored().pages[0].components.find(item => item.id === "cover-title").rect.y,
    original.pages[0].components.find(item => item.id === "cover-title").rect.y + 24, "release consumes its final coordinates before the next preview frame");
  assert.equal(evaluate("document.querySelector('[data-page=cover] .component-hit.selected').style.translate"), "", "no queued preview survives release");
  b("press", "Control+z"); b("wait", "350"); assert.deepEqual(stored(), original, "immediate release remains one undo step");
  b("dblclick", hit); b("fill", "#revision-note", "A comment at this zoom.");
  assert.equal(evaluate("document.querySelector('.scene-canvas textarea,.scene-canvas [contenteditable]')===null"), true, "zoomed text opens comments, not an editor");
  near(evaluate("document.querySelector('.revision-notes').getBoundingClientRect().width"), 360, "comment composer stays unscaled");
  const followsTarget = `(()=>{const a=document.querySelector('${hit}').getBoundingClientRect(),p=document.querySelector('.comment-composer').getBoundingClientRect();return p.left>=16&&p.right<=innerWidth-16&&p.top>=16&&p.bottom<document.querySelector('.review-launcher').getBoundingClientRect().top&&[p.top-a.bottom,a.top-p.bottom,p.left-a.right,a.left-p.right].some(gap=>Math.abs(gap-12)<1)})()`;
  b("wait", "--fn", followsTarget);
  wheel(-Math.log(1.25) / .004); settle();
  b("wait", "--fn", followsTarget);
  near(evaluate("document.querySelector('.comment-composer').getBoundingClientRect().width"), 360, "zooming with the composer open does not scale it");
  assert.equal(evaluate("document.querySelector('#revision-note').value"), "A comment at this zoom.", "zoom preserves the focused draft");
  capture("zoomed-anchored-comment");
  wheel(Math.log(1.25) / .004); settle();
  capture("zoomed-comment"); b("press", "Escape");
  assert.deepEqual(stored(), original, "draft comments preserve source");
  b("set", "viewport", "390", "844", "2"); settle();
  wheel(Math.log(2) / .004, { clientX: 195, clientY: 350 }); near(scale(), 1, "zoom survives responsive resize");
  b("eval", "document.querySelector('.workspace').scrollTo(0,0)");
  assert.equal(evaluate("(()=>{const pages=[...document.querySelectorAll('.board-page')].map(p=>p.getBoundingClientRect());return pages[0].left>=0&&pages[0].right<=innerWidth&&pages[0].bottom<innerHeight&&pages.every((p,i)=>p.top===pages[0].top&&(!i||p.left>pages[i-1].right))})()"), true, "narrow fit keeps one page visible and preserves the horizontal row");
  capture("narrow-fit");
  b("eval", "document.querySelector('.board-page:last-child').scrollIntoView({block:'nearest',inline:'center'})");
  assert.equal(evaluate("(()=>{const r=document.querySelector('.board-page:last-child').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<innerHeight})()"), true, "the last page is reachable horizontally");
  b("eval", "document.querySelector('.workspace').scrollLeft=document.querySelector('.workspace').scrollWidth");
  near(evaluate("innerWidth-document.querySelector('.board-page:last-child').getBoundingClientRect().right"), 16, "last page keeps the narrow right gutter", 1);
  capture("narrow-last-page");
  assert.equal(b("errors"), "", "no browser errors");
  console.log("PASS: native Ctrl+wheel zoom, pointer anchoring, two-axis wheel scrolling, Command+wheel, delta modes, limits, Safari event sequence, zoomed drag/undo/text/comments, unchanged source, fixed controls and narrow fit.");
} finally {
  cdp?.close(); b("close");
}
