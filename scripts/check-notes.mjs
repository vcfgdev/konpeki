// Real select → add comment → review → copy in disposable file and browser-only sessions.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { createServer } from "vite";
import { fileSessionPlugin } from "../bin/session-plugin.ts";
import { parseCompositionJSON, removeComponent } from "../composition/document.ts";
import { toComposition } from "../composition/grid.ts";

const exec = promisify(execFile);
const scratch = await mkdtemp(join(tmpdir(), "konpeki-comments-"));
const path = join(scratch, "composition.json");
const artifacts = resolve(process.argv[2] ?? "/tmp/konpeki-comments");
await mkdir(artifacts, { recursive: true });
const original = JSON.parse(await readFile("slides/introducing-konpeki/composition.json", "utf8"));
await writeFile(path, JSON.stringify(original));
let server = await createServer({ server: { host: "127.0.0.1", port: 0 }, plugins: [fileSessionPlugin({ compositionPath: path, token: "comments-test" })] });
const b = async (...args) => (await exec("agent-browser", ["--session", "comments-check", ...args], { maxBuffer: 8 * 1024 * 1024 })).stdout.trim();
const check = expression => b("eval", `if(!(${expression}))throw Error(${JSON.stringify(expression)})`);
const wait = expression => b("wait", "--fn", expression);
const click = name => b("find", "role", "button", "click", "--name", name, "--exact");
const page = id => `[data-page="${id}"]`;
const ready = () => wait(`document.querySelectorAll('.scene-artwork svg').length===${original.pages.length} && !document.querySelector('.workspace[inert]')`);
const choosePage = async id => {
  await b("focus", `${page(id)} .page-comment-hit`);
  await b("press", "Enter");
  await wait("document.activeElement.id==='revision-note'");
};
const enterReview = async () => {
  if (await b("eval", "!!document.querySelector('.workspace.reviewing')") === "true") return;
  if (await b("eval", "!document.querySelector('.revision-notes')") === "true") await click("Comment");
  if (await b("eval", "!!document.querySelector('.review-actions')") === "true") await click("New comment");
  await check("!!document.querySelector('.workspace.reviewing') && !document.querySelector('.revision-notes')");
};
const reviewPage = async id => { await enterReview(); await choosePage(id); };
const addComment = async () => {
  await click("Add comment");
  await wait("document.querySelector('#comment-heading')?.textContent==='Pending reviews' && !document.querySelector('.workspace.reviewing')");
  await check("!document.querySelector('#revision-note') && !document.querySelector('.review-actions .primary').disabled && document.activeElement.id==='revision-notes'");
};
const openReviews = async () => {
  if (await b("eval", "!!document.querySelector('.comment-composer')") === "true") await click("Cancel");
  if (await b("eval", "!document.querySelector('.revision-notes')") === "true") {
    if (await b("eval", "!!document.querySelector('.workspace.reviewing')") === "true") await b("click", ".review-launcher");
    await click("Comment");
  }
  await wait("document.querySelector('#comment-heading')?.textContent==='Pending reviews'");
  await b("eval", "Promise.allSettled(document.querySelector('.revision-notes').getAnimations().map(a=>a.finished)).then(()=>true)");
  await check("!document.querySelector('.revision-note-resolve,.review-hint') && document.querySelector('.revision-notes').style.cssText==='' && document.querySelectorAll('.review-actions button').length===2");
};
const copyReviews = async () => {
  await openReviews();
  const count = await b("eval", "document.querySelector('.review-count').textContent");
  await click("Copy & clear");
  await wait("document.querySelector('.toast.visible')?.textContent.includes('Copied and cleared') && document.activeElement.classList.contains('review-launcher')");
  await check("!document.querySelector('.workspace.reviewing,.revision-notes,.review-count,.revision-pin') && document.querySelector('.review-launcher').getAttribute('aria-expanded')==='false'");
  // Recover the batch for the subsequent persistence/targeting scenarios.
  await click("Undo");
  assert.equal(await b("eval", "document.querySelector('.review-count').textContent"), count);
  await check("!document.querySelector('.workspace.reviewing,.revision-notes') && document.querySelector('.review-launcher').getAttribute('aria-pressed')==='false'");
};
const capture = async name => {
  await b("eval", "document.fonts.ready.then(()=>Promise.allSettled(document.getAnimations().map(a=>a.finished))).then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))");
  await b("screenshot", join(artifacts, `${name}.png`));
};
let cdp;
let requestId = 0;
function command(method, params, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    const timer = setTimeout(() => { cdp.removeEventListener("message", receive); reject(new Error(`CDP timed out: ${method}`)); }, 10000);
    function receive(event) {
      const response = JSON.parse(event.data);
      if (response.id !== id) return;
      clearTimeout(timer); cdp.removeEventListener("message", receive);
      if (response.error) reject(new Error(JSON.stringify(response.error))); else resolve(response.result);
    }
    cdp.addEventListener("message", receive);
    cdp.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
async function waitForFile(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate(JSON.parse(await readFile(path, "utf8")))) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail("Timed out waiting for composition save");
}
try {
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
  const session = await (await fetch(`${base}__konpeki/session`, { headers: { "x-konpeki-session": "comments-test" } })).json();
  const fileStorage = `konpeki-comments/v1/${session.commentKey}`;
  const readBrowserReview = async () => JSON.parse(await b("eval", `JSON.parse(localStorage.getItem('${fileStorage}'))`));
  await b("open", `${base}?session=comments-test`);
  await b("set", "viewport", "1440", "1000", "2");
  await ready();
  await check("!document.querySelector('.left-sidebar,.right-panel,.component-dock,select,textarea')");
  await check("document.querySelectorAll('button:not(.component-hit):not([inert] button)').length===1");
  await check(`document.querySelectorAll('.board-page').length===${original.pages.length} && document.querySelectorAll('.page-order > path').length===${original.pages.length - 1}`);
  await check(`JSON.stringify([...document.querySelectorAll('.page-order > path')].map(p=>[p.dataset.from,p.dataset.to]))===${JSON.stringify(JSON.stringify(original.pages.slice(1).map((p, i) => [original.pages[i].id, p.id])))}`);
  await capture("page-board");

  // Establish document undo history, then prove native comment undo is isolated.
  await b("dblclick", `${page("cover")} .stage-meta h2`);
  await b("fill", 'input[aria-label="Page name"]', "Undo isolation");
  await b("press", "Enter");
  await waitForFile(doc => doc.pages[0].name === "Undo isolation");
  const inactiveColor = await b("eval", "getComputedStyle(document.querySelector('.review-launcher')).backgroundColor");
  await click("Comment");
  await check("!!document.querySelector('.workspace.reviewing') && !document.querySelector('.revision-notes,.review-count,.review-hint')");
  await check("(()=>{const b=document.querySelector('.review-launcher'),r=b.getBoundingClientRect();return b.textContent===''&&b.getAttribute('aria-label')==='Cancel selection'&&b.getAttribute('aria-expanded')==='false'&&r.width===r.height})()");
  await b("eval", "Promise.all(document.querySelector('.review-launcher').getAnimations().map(a=>a.finished)).then(()=>true)");
  assert.notEqual(await b("eval", "getComputedStyle(document.querySelector('.review-launcher')).backgroundColor"), inactiveColor);
  await capture("select-first");
  await b("click", ".review-launcher");
  await check("!document.querySelector('.workspace.reviewing,.revision-notes') && document.querySelector('.review-launcher').getAttribute('aria-expanded')==='false'");
  await reviewPage("cover");
  await check("document.querySelector('.revision-note-submit .primary').disabled");
  await b("press", "Tab");
  await check("document.activeElement.textContent==='Cancel' && document.activeElement.matches(':focus-visible') && getComputedStyle(document.activeElement).outlineStyle!=='none'");
  await capture("review-keyboard-focus");
  await click("Cancel");
  await check("!document.querySelector('.workspace.reviewing,.revision-notes') && document.activeElement.classList.contains('review-launcher')");
  await reviewPage("cover");
  await capture("empty-composer");
  await b("type", "#revision-note", "x");
  await b("press", "Control+z");
  await check("document.querySelector('[data-page=cover] h2').textContent==='Undo isolation' && document.querySelector('#revision-note').value===''");
  await b("fill", "#revision-note", "Explain the main takeaway more directly.");
  const beforeComment = await readFile(path, "utf8");
  await b("eval", "window.clipboardWrites=0;window.writeClipboard=navigator.clipboard.writeText.bind(navigator.clipboard);navigator.clipboard.writeText=(text)=>{window.clipboardWrites++;return window.writeClipboard(text)}");
  await addComment();
  await wait("document.querySelector('.review-count')?.textContent==='1'");
  await check("window.clipboardWrites===0");
  await copyReviews();
  await check("window.clipboardWrites===1");
  // The write above uses real user activation. Grant read permission only to inspect it.
  cdp = new WebSocket(await b("get", "cdp-url"));
  await new Promise((resolve, reject) => { cdp.addEventListener("open", resolve, { once: true }); cdp.addEventListener("error", reject, { once: true }); });
  const clipboardAccess = () => command("Browser.grantPermissions", { origin: base, permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] });
  await clipboardAccess();
  assert.match(await b("clipboard", "read"), /Explain the main takeaway more directly/);
  assert.equal(await readFile(path, "utf8"), beforeComment, "comments never change the authored document");
  assert.deepEqual((await readBrowserReview()).notes.map(n => [n.slideId, n.componentId, n.resolved]), [["cover", undefined, false]]);
  await assert.rejects(readFile(`${path}.review.json`), { code: "ENOENT" });

  // Editing replaces only the text, keeps the note ID, and survives a failed save.
  const firstNote = (await readBrowserReview()).notes[0];
  await openReviews(); await click("Edit comment 1");
  await check(`document.querySelector('#revision-note').value===${JSON.stringify(firstNote.text)}`);
  await b("fill", "#revision-note", "Use one clear takeaway, not three.");
  await b("eval", "window.realSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('Storage full')}");
  await click("Save comment");
  await wait("document.querySelector('.comment-error')?.textContent.includes('Storage full')");
  assert.deepEqual((await readBrowserReview()).notes, [firstNote]);
  await check("document.querySelector('#revision-note').value==='Use one clear takeaway, not three.'");
  await b("eval", "Storage.prototype.setItem=window.realSetItem");
  await b("focus", "#revision-note"); await b("press", "Control+Enter");
  await wait("!!document.querySelector('.review-actions')");
  assert.deepEqual((await readBrowserReview()).notes, [{ ...firstNote, text: "Use one clear takeaway, not three." }]);
  await click("Edit comment 1");
  await check("document.querySelector('#revision-note').value==='Use one clear takeaway, not three.'");
  await b("fill", "#revision-note", firstNote.text); await click("Save comment");
  await wait("!!document.querySelector('.review-actions')");
  assert.deepEqual((await readBrowserReview()).notes, [firstNote]);

  // Queue keyboard input must not delete a selected component behind the card.
  await b("click", `${page("cover")} .component-hit[data-component="wordmark"]`);
  await b("focus", "#revision-notes"); await b("press", "Delete");
  await check("!!document.querySelector('[data-page=cover] .component-hit[data-component=wordmark]')");
  assert.equal(await readFile(path, "utf8"), beforeComment);

  // Only an empty queue dismisses outside; panel controls and drafts stay usable.
  await b("click", ".board-heading h1");
  await check("!!document.querySelector('.review-actions')");
  await click("Remove comment 1"); await wait("!!document.querySelector('.review-empty')");
  await b("click", ".review-empty");
  await check("!!document.querySelector('.review-empty')");
  await click("New comment"); await choosePage("cover");
  await b("fill", "#revision-note", "Draft kept while the queue is empty");
  await b("click", ".board-heading h1");
  await check("document.querySelector('#revision-note')?.value==='Draft kept while the queue is empty'");
  await click("Cancel"); await b("press", "Control+z");
  await openReviews(); await click("Remove comment 1");
  await wait("!!document.querySelector('.review-empty')");
  // Component pointer handlers stop propagation; outside dismissal must still run.
  await b("click", `${page("cover")} .component-hit[data-component="wordmark"]`);
  await check("!document.querySelector('.revision-notes,.workspace.reviewing') && document.querySelector('.review-launcher').getAttribute('aria-expanded')==='false'");
  await check("document.activeElement.matches('.component-hit[data-component=wordmark]')");
  await b("press", "Control+z");
  await openReviews(); await click("Remove comment 1");
  await wait("!!document.querySelector('.review-empty')");
  await b("click", ".review-launcher");
  await check("!document.querySelector('.revision-notes,.workspace.reviewing')");
  await reviewPage("cover");
  await check("document.querySelector('#revision-note').value==='Draft kept while the queue is empty'");
  await b("press", "Escape"); await b("press", "Control+z");
  await wait(`JSON.parse(localStorage.getItem('${fileStorage}')).notes.length===1`);
  assert.deepEqual((await readBrowserReview()).notes, [firstNote]);
  assert.equal(await readFile(path, "utf8"), beforeComment);

  // Esc keeps drafts, target changes isolate them, review keys never nudge/delete.
  await reviewPage("cover");
  await b("fill", "#revision-note", "Cover draft");
  await openReviews();
  await check("document.querySelectorAll('.revision-note-list li').length===1 && !document.querySelector('#revision-note')");
  await b("click", ".review-launcher");
  await check("!document.querySelector('.workspace.reviewing,.revision-notes')");
  await wait("document.activeElement.classList.contains('review-launcher')");
  // Existing comments are also reachable in one click, not a mode-only stop.
  await click("Comment");
  await check("document.querySelector('#comment-heading')?.textContent==='Pending reviews' && document.querySelectorAll('.revision-note-list li').length===1");
  await enterReview();
  await choosePage("cover");
  await check("document.querySelector('#revision-note').value==='Cover draft'");
  await b("click", ".review-launcher");
  await check("!document.querySelector('.workspace.reviewing,.revision-notes')");
  await reviewPage("cover");
  await check("document.querySelector('#revision-note').value==='Cover draft'");
  await b("press", "Escape");
  await check("document.activeElement.classList.contains('review-launcher')");
  await reviewPage("cover");
  await check("document.querySelector('#revision-note').value==='Cover draft'");

  // The composer follows the selected component rather than the launcher or page.
  const titleHit = `${page("cover")} .component-hit[data-component="cover-title"]`;
  await b("click", titleHit);
  await b("fill", "#revision-note", "Make this title more direct.");
  const belowTitle = `(()=>{const a=document.querySelector('${titleHit}').getBoundingClientRect(),p=document.querySelector('.comment-composer').getBoundingClientRect();return Math.abs(p.top-a.bottom-12)<1&&Math.abs(p.left-a.left)<1})()`;
  await wait(belowTitle);
  await b("eval", "window.composerLeft=document.querySelector('.comment-composer').getBoundingClientRect().left;document.querySelector('.workspace').scrollLeft+=40");
  await wait("Math.abs(document.querySelector('.comment-composer').getBoundingClientRect().left-window.composerLeft+40)<1");
  await capture("anchored-component");
  await b("set", "viewport", "390", "844", "2");
  await wait("(()=>{const p=document.querySelector('.comment-composer').getBoundingClientRect();return p.left>=16&&p.right<=innerWidth-16&&p.top>=16&&p.bottom<document.querySelector('.review-launcher').getBoundingClientRect().top})()");
  await check("document.querySelector('#revision-note').value==='Make this title more direct.'");
  await capture("narrow-anchored-component");
  await b("set", "viewport", "1440", "1000", "2");
  await b("eval", "document.querySelector('.workspace').scrollTo(0,0)");
  await wait(belowTitle);
  await b("press", "Escape");
  await reviewPage("cover");
  await check("document.querySelector('#revision-note').value==='Cover draft'");
  await b("focus", `${page("notes")} .component-hit[data-component="notes-ui"]`);
  await b("press", "ArrowDown"); await b("press", "Delete"); await b("press", "Enter");
  await check("document.querySelector('#revision-note').value==='' && !document.querySelector('.scene-text-editor')");
  await b("fill", "#revision-note", "Keep this explanation simple.");
  await capture("component-comment");
  await addComment();
  await wait("document.querySelector('.review-count')?.textContent==='2'");
  await openReviews();
  await capture("pending-reviews");
  await copyReviews();
  assert.equal((await readBrowserReview()).notes[1].componentId, "notes-ui");
  const copied = await b("clipboard", "read");
  for (const part of ["composition.json", "cover", "notes-ui", "Explain the main takeaway more directly.", "Keep this explanation simple."])
    assert.ok(copied.includes(part), `Copied prompt must include ${part}`);
  assert.equal(await readFile(path, "utf8"), beforeComment);

  // Markers remain on the correction canvas and open only their own feedback.
  await check("!document.querySelector('.workspace.reviewing,.revision-notes') && document.querySelectorAll('.revision-pin').length===2");
  await capture("persistent-markers");
  await b("dblclick", `${page("notes")} .revision-pin`);
  await check("document.querySelector('.revision-note-scope').textContent.includes('Image') && document.querySelector('.current-comments p').textContent==='Keep this explanation simple.'");
  await check("document.querySelectorAll('.current-comments li').length===1 && !document.querySelector('.comment-history,.comment-help,.review-actions') && !document.querySelector('.revision-notes').textContent.includes('Explain the main takeaway more directly.')");
  await check("(()=>{const r=document.querySelector('.current-comments p').getBoundingClientRect(),p=document.querySelector('.revision-notes').getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom})()");
  await capture("open-saved-comment");
  await copyReviews(); // Undo restores the copied batch without adding duplicates.
  assert.equal((await readBrowserReview()).notes.length, 2);
  await b("click", `${page("notes")} .revision-pin`);
  await b("fill", "#revision-note", "Keep the labels concise."); await addComment();
  await wait("document.querySelector('.review-count')?.textContent==='3'");
  await b("click", `${page("notes")} .revision-pin:last-child`);
  await check("JSON.stringify([...document.querySelectorAll('.current-comments p')].map(p=>p.textContent))===JSON.stringify(['Keep this explanation simple.','Keep the labels concise.'])");
  await click("Remove comment 3");
  await wait("document.querySelectorAll('.current-comments li').length===1 && document.querySelectorAll('.revision-pin').length===2");
  await b("press", "Escape");

  // Seed a legacy sidecar and a first-time browser import; the app never writes it.
  await assert.rejects(readFile(`${path}.review.json`), { code: "ENOENT" });
  const legacy = await readBrowserReview();
  legacy.notes.push({ id: "legacy-vector", slideId: "notes", componentId: "notes-ui", elementId: "ui-page-sel", text: "Preserve the old targeted feedback.", resolved: false });
  legacy.notes.push({ id: "legacy-resolved", slideId: "cover", text: "Previously addressed feedback stays hidden.", resolved: true });
  const legacyBytes = JSON.stringify(legacy);
  await writeFile(`${path}.review.json`, legacyBytes);
  // Stop the current app before clearing storage: its debounced persistence can
  // otherwise recreate the record between removeItem and a separate reload.
  await b("open", `${base}src/assets/konpeki-mark.png`);
  await b("eval", `localStorage.removeItem('${fileStorage}')`);
  await b("open", `${base}?session=comments-test`); await ready();
  await wait("document.querySelector('.review-count')?.textContent==='3'");
  await openReviews();
  await b("click", ".revision-note-list li:last-child .revision-note-target");
  await check("document.querySelector('.revision-note-scope').textContent.includes('ui-page-sel')");
  await check("document.querySelector('.current-comments p').textContent==='Preserve the old targeted feedback.' && !document.querySelector('.review-actions')");
  await b("eval", `(async()=>{
    const {exportComposition}=await import('/src/lib/export-scene.ts');
    const {document:composition}=await (await fetch('/__konpeki/session',{headers:{'x-konpeki-session':'comments-test'}})).json();
    const first=new Uint8Array(await (await exportComposition(composition,'png',4)).arrayBuffer());
    document.querySelectorAll('.revision-pin,.page-order').forEach(n=>n.remove());
    const second=new Uint8Array(await (await exportComposition(composition,'png',4)).arrayBuffer());
    if(first.length!==second.length||first.some((v,i)=>v!==second[i]))throw Error('Review or board chrome changed PNG');
  })()`);
  await b("reload"); await ready();
  await openReviews();
  await click("Remove comment 1");
  await wait("document.querySelectorAll('.revision-note-list li').length===2");
  assert.ok(!(await readBrowserReview()).notes.some(n => n.text === "Explain the main takeaway more directly."));
  assert.equal((await readBrowserReview()).notes.filter(n => n.resolved).length, 1);
  await check("!document.querySelector('[data-page=cover] .revision-pin')");
  await click("Remove comment 1");
  await wait("document.querySelectorAll('.revision-note-list li').length===1");
  await copyReviews();
  const remaining = await b("clipboard", "read");
  assert.match(remaining, /ui-page-sel/);
  assert.doesNotMatch(remaining, /Explain the main takeaway|Keep this explanation simple/);
  assert.equal(await readFile(`${path}.review.json`, "utf8"), legacyBytes);
  await b("reload"); await ready();
  await check("document.querySelectorAll('.revision-pin').length===1");
  await b("press", "Escape");

  // Direct corrections still save; keyboard history replaces the toolbar.
  const text = original.pages[0].components.find(c => c.kind === "text-block" && !c.customVisual);
  const hit = `${page("cover")} .component-hit[data-component="${text.id}"]`;
  await enterReview(); await b("click", hit);
  await b("fill", "#revision-note", "Keep this name."); await addComment();
  await wait("!!document.querySelector('[data-page=cover] .revision-pin')");
  await b("press", "Escape");
  const pinTop = "(()=>{const p=document.querySelector('[data-page=cover]');return p.querySelector('.revision-pin').getBoundingClientRect().top-p.querySelector('.scene-canvas').getBoundingClientRect().top})()";
  const beforeMove = Number(await b("eval", pinTop));
  const dragPoint = JSON.parse(await b("eval", `(()=>{const r=document.querySelector('${hit}').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`));
  const beforeDrag = await readFile(path, "utf8");
  await b("mouse", "move", String(dragPoint.x), String(dragPoint.y)); await b("mouse", "down", "left");
  // The CLI mouse command accepts only integers; CDP preserves subpixel input.
  const { targetInfos } = await command("Target.getTargets");
  const targetId = targetInfos.find(target => target.type === "page" && target.url.startsWith(base)).targetId;
  const { sessionId } = await command("Target.attachToTarget", { targetId, flatten: true });
  await command("Input.dispatchMouseEvent", { type: "mouseMoved", x: dragPoint.x, y: dragPoint.y + .25, button: "left", buttons: 1 }, sessionId);
  await command("Target.detachFromTarget", { sessionId });
  await wait(`Math.abs(${pinTop}-${beforeMove})<.5`);
  await b("wait", "350");
  assert.equal(await readFile(path, "utf8"), beforeDrag, "drag preview does not write the source");
  await b("mouse", "up", "left");
  await wait(`Math.abs(${pinTop}-${beforeMove})<.05`);
  assert.equal(await readFile(path, "utf8"), beforeDrag, "a sub-half-page-pixel drop restores the marker without changing source");
  await b("click", hit); await b("press", "ArrowDown");
  await waitForFile(doc => doc.pages[0].components.find(c => c.id === text.id).rect.y === text.rect.y + 1);
  await wait(`${pinTop}>${beforeMove}`);
  await b("press", "Control+z");
  await waitForFile(doc => doc.pages[0].components.find(c => c.id === text.id).rect.y === text.rect.y);
  await b("press", "Control+Shift+z");
  await waitForFile(doc => doc.pages[0].components.find(c => c.id === text.id).rect.y === text.rect.y + 1);
  await b("dblclick", hit); await b("fill", ".scene-text-editor", "Corrected wording"); await b("press", "Tab");
  await waitForFile(doc => doc.pages[0].components.find(c => c.id === text.id).content === "Corrected wording");
  await b("click", hit); await b("press", "Delete");
  await waitForFile(doc => !doc.pages[0].components.some(c => c.id === text.id));
  await check("!document.querySelector('[data-page=cover] .revision-pin')");
  await b("press", "Control+z");
  await waitForFile(doc => doc.pages[0].components.some(c => c.id === text.id));
  await wait("!!document.querySelector('[data-page=cover] .revision-pin')");

  // An open text correction merges with newer geometry, not its captured component.
  await b("dblclick", titleHit); await b("fill", ".scene-text-editor", "Preserve the newer geometry.");
  const oldTop = await b("eval", `document.querySelector('${titleHit}').style.top`);
  const external = JSON.parse(await readFile(path, "utf8"));
  const externalTitle = external.pages[0].components.find(c => c.id === "cover-title");
  externalTitle.rect.y += 2;
  externalTitle.textStyle.weight = 500;
  await writeFile(path, JSON.stringify(external));
  await wait(`document.querySelector('${titleHit}').style.top!==${oldTop}`);
  await b("press", "Tab");
  await waitForFile(doc => doc.pages[0].components.find(c => c.id === "cover-title").content === "Preserve the newer geometry.");
  const merged = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(merged.pages[0].components.find(c => c.id === "cover-title"), { ...externalTitle, content: "Preserve the newer geometry." });

  // Competing content never gets overwritten; an unrelated editor cannot eat the draft.
  await b("dblclick", titleHit); await b("fill", ".scene-text-editor", "My unsent headline");
  merged.pages[0].components.find(c => c.id === "cover-title").content = "External headline";
  await writeFile(path, JSON.stringify(merged));
  await wait("!!document.querySelector('[data-page=cover] .scene-artwork [aria-label=\"External headline\"]')");
  await b("press", "Tab");
  await wait("document.querySelector('.toast.visible')?.textContent.includes('text changed elsewhere')");
  await check("document.querySelector('.scene-text-editor').value==='My unsent headline'");
  await capture("text-conflict");
  await b("dblclick", hit);
  await check("document.querySelector('.scene-text-editor').value==='My unsent headline'");
  await b("focus", ".scene-text-editor"); await b("press", "Escape");
  assert.equal(JSON.parse(await readFile(path, "utf8")).pages[0].components.find(c => c.id === "cover-title").content, "External headline");

  // Merely opening and blurring unchanged text must not revert a newer value.
  await b("dblclick", titleHit);
  merged.pages[0].components.find(c => c.id === "cover-title").content = "Newer headline";
  await writeFile(path, JSON.stringify(merged));
  await wait("!!document.querySelector('[data-page=cover] .scene-artwork [aria-label=\"Newer headline\"]')");
  await b("press", "Tab");
  await check("!document.querySelector('.scene-text-editor')");
  assert.equal(JSON.parse(await readFile(path, "utf8")).pages[0].components.find(c => c.id === "cover-title").content, "Newer headline");
  await b("dblclick", titleHit); await b("fill", ".scene-text-editor", "Keep my draft after deletion");
  const parsed = parseCompositionJSON(JSON.stringify(merged));
  assert.ok(parsed.ok);
  await writeFile(path, JSON.stringify(toComposition(removeComponent(parsed.document, "cover-title", "cover"))));
  await wait(`!document.querySelector('${titleHit}')`);
  await b("press", "Tab");
  await check("document.querySelector('.scene-text-editor').value==='Keep my draft after deletion' && document.querySelector('.toast.visible').textContent.includes('removed or replaced')");
  await b("focus", ".scene-text-editor"); await b("press", "Escape");
  await writeFile(path, JSON.stringify(merged));
  await wait(`!!document.querySelector('${titleHit}')`);

  // File GET failure must not disable either clipboard path for local comments.
  const recoveryReview = await readBrowserReview();
  const beforeRecovery = await readFile(path, "utf8");
  await b("eval", `window.fileFetch=window.fetch;window.fetch=(url,init)=>String(url)==='/__konpeki/session'&&(!init?.method||init.method==='GET')?Promise.resolve(new Response(JSON.stringify({error:'Service unavailable'}),{status:503})):window.fileFetch(url,init)`);
  await wait("document.querySelector('.workspace').dataset.fileStatus==='error'");
  await copyReviews();
  assert.match(await b("clipboard", "read"), /Keep this name/);
  await openReviews();
  await b("eval", "Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined})");
  await click("Copy & clear"); await wait("!!document.querySelector('.comment-copy-fallback textarea')");
  await check("document.querySelector('.comment-copy-fallback textarea').value.includes('Keep this name.')");
  await capture("file-error-copy");
  await b("eval", "delete navigator.clipboard;window.fetch=window.fileFetch");
  await b("press", "Escape");
  await wait("document.querySelector('.workspace').dataset.fileStatus==='saved' && !document.querySelector('.recovery.visible')");
  assert.equal(await readFile(path, "utf8"), beforeRecovery);
  assert.deepEqual((await readBrowserReview()).notes, recoveryReview.notes);

  // Delay a real PUT so an intervening disk edit deterministically produces 409.
  await b("eval", "window.fetch=(url,init)=>String(url)==='/__konpeki/session'&&init?.method==='PUT'?new Promise(resolve=>{window.releaseSave=()=>resolve(window.fileFetch(url,init))}):window.fileFetch(url,init)");
  await b("dblclick", `${page("cover")} .stage-meta h2`);
  await b("fill", 'input[aria-label="Page name"]', "Unsaved browser name"); await b("press", "Enter");
  await wait("!!window.releaseSave");
  const conflicting = JSON.parse(beforeRecovery); conflicting.title = "External revision wins";
  await writeFile(path, JSON.stringify(conflicting));
  await b("eval", "window.releaseSave();true");
  await wait("document.querySelector('.workspace').dataset.fileStatus==='conflict'");
  await copyReviews();
  assert.match(await b("clipboard", "read"), /Keep this name/);
  await openReviews();
  await b("eval", "Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined})");
  await click("Copy & clear"); await wait("!!document.querySelector('.comment-copy-fallback textarea')");
  await check("document.querySelector('.comment-copy-fallback textarea').value.includes('Keep this name.')");
  await capture("file-conflict-copy");
  assert.equal(JSON.parse(await readFile(path, "utf8")).title, "External revision wins");
  assert.deepEqual((await readBrowserReview()).notes, recoveryReview.notes);
  await b("eval", "delete navigator.clipboard;window.fetch=window.fileFetch;window.confirm=()=>true");
  await click("Load file version"); await ready();
  await wait("document.querySelector('.board-heading h1').textContent==='External revision wins' && document.querySelector('.workspace').dataset.fileStatus==='saved'");

  // Invalid legacy data cannot block local comments or composition autosaving.
  await writeFile(`${path}.review.json`, "{broken");
  await b("reload"); await ready();
  assert.deepEqual((await readBrowserReview()).notes, recoveryReview.notes);
  await check("!document.querySelector('.recovery.visible')");
  await b("dblclick", `${page("cover")} .stage-meta h2`);
  await b("fill", 'input[aria-label="Page name"]', "Local comments take precedence"); await b("press", "Enter");
  await waitForFile(doc => doc.pages[0].name === "Local comments take precedence");
  await b("open", `${base}src/assets/konpeki-mark.png`);
  await b("eval", `localStorage.removeItem('${fileStorage}')`);
  await b("open", `${base}?session=comments-test`); await ready();
  await wait("document.querySelector('.recovery.visible')?.textContent.includes('Legacy comments could not be imported')");
  await b("dblclick", `${page("cover")} .stage-meta h2`);
  await b("fill", 'input[aria-label="Page name"]', "Composition remains editable"); await b("press", "Enter");
  await waitForFile(doc => doc.pages[0].name === "Composition remains editable");
  await check(`localStorage.getItem('${fileStorage}')===null`);
  assert.equal(await readFile(`${path}.review.json`, "utf8"), "{broken");
  await capture("legacy-import-warning");
  await writeFile(`${path}.review.json`, legacyBytes);
  await b("reload"); await ready();
  await wait(`localStorage.getItem('${fileStorage}')!==null`);
  assert.deepEqual(await readBrowserReview(), legacy);
  await check("!document.querySelector('.recovery.visible')");
  await b("eval", `localStorage.setItem('${fileStorage}', ${JSON.stringify(JSON.stringify(recoveryReview))})`);
  await b("reload"); await ready();

  // A fresh preview token at the same origin keeps local feedback, not stale sidecar state.
  const savedReview = await readBrowserReview();
  await b("open", "about:blank");
  await server.close();
  server = await createServer({ server: { host: "127.0.0.1", port: Number(new URL(base).port), strictPort: true }, plugins: [fileSessionPlugin({ compositionPath: path, token: "restarted-test" })] });
  await server.listen();
  await b("open", `${base}?session=restarted-test`); await ready();
  assert.deepEqual(await readBrowserReview(), savedReview);
  await check("document.querySelectorAll('.revision-pin').length===2");
  assert.equal(await readFile(`${path}.review.json`, "utf8"), legacyBytes);
  await b("eval", `localStorage.setItem('${fileStorage}', '{broken')`);
  await b("reload"); await ready();
  await b("wait", "1200");
  await check("document.querySelector('.recovery.visible')?.textContent.includes('Browser comments could not be read')");
  await check(`localStorage.getItem('${fileStorage}')==='{broken'`);
  await b("eval", `localStorage.setItem('${fileStorage}', ${JSON.stringify(JSON.stringify(savedReview))})`);

  // Browser-only feedback survives reload and undoes imports; JSON contains no comments.
  await b("open", `${base}?example=introducing-konpeki`); await ready();
  const storage = "konpeki-composer/examples/v1/introducing-konpeki";
  await reviewPage("cover"); await b("fill", "#revision-note", "Explain the outcome, not the editing tools."); await addComment();
  await wait("document.querySelector('.review-count')?.textContent==='1'");
  await b("reload"); await ready();
  await check("!document.querySelector('.workspace.reviewing') && !!document.querySelector('[data-page=cover] .revision-pin')");
  await b("focus", `${page("cover")} .revision-pin`); await b("press", "Enter");
  await check("document.querySelector('.current-comments p').textContent==='Explain the outcome, not the editing tools.'");
  await check(`JSON.parse(localStorage.getItem('${storage}')).review.notes[0].slideId==='cover'`);
  await b("eval", "HTMLAnchorElement.prototype.click=function(){fetch(this.href).then(r=>r.json()).then(value=>window.downloaded={name:this.download,value})}");
  await check("![...document.querySelectorAll('button')].some(b=>b.textContent==='Download comments')");
  await b("press", "Escape"); await b("press", "Control+s"); await wait("window.downloaded?.value.schema==='konpeki-composition/v2'");
  await check("!('review' in window.downloaded.value) && !('notes' in window.downloaded.value)");
  await b("upload", 'input[type=file]', path); await wait("!document.querySelector('.revision-notes') && !document.querySelector('.review-count')");
  await b("press", "Control+z"); await wait("document.querySelector('.review-count')?.textContent==='1'");
  await reviewPage("cover");
  await b("eval", "window.realSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('Storage full')}");
  await b("fill", "#revision-note", "Unsaved comment must remain in the composer"); await click("Add comment");
  await wait("document.querySelector('.comment-error')?.textContent.includes('Storage full')");
  await check("document.querySelector('#revision-note').value==='Unsaved comment must remain in the composer' && document.querySelectorAll('.revision-note-list li').length===1");
  await capture("comment-error");
  await b("eval", "Storage.prototype.setItem=window.realSetItem");

  // Clipboard rejection leaves saved comments and a selected manual-copy prompt.
  await command("Browser.setPermission", { origin: base, permission: { name: "clipboard-write" }, setting: "denied" });
  await b("fill", "#revision-note", "Show the failure path too."); await addComment();
  await openReviews(); await click("Copy & clear");
  await wait("!!document.querySelector('.comment-copy-fallback textarea')");
  await check("!document.querySelector('#revision-note') && document.querySelectorAll('.revision-note-list li').length===2");
  await check("(()=>{const t=document.querySelector('.comment-copy-fallback textarea');return t.readOnly&&t.value.includes('Show the failure path too.')&&t.value.includes('Explain the outcome, not the editing tools.')&&t.selectionStart===0&&t.selectionEnd===t.value.length})()");
  await check("!document.querySelector('.toast.visible')?.textContent.includes('Copied')");
  await capture("clipboard-fallback");
  await b("set", "viewport", "390", "844", "2");
  await capture("narrow-clipboard-fallback");
  await clipboardAccess();
  await copyReviews();
  await check(`JSON.parse(localStorage.getItem('${storage}')).review.notes.length===2`);
  assert.match(await b("clipboard", "read"), /Show the failure path too/);
  await openReviews();
  await b("eval", "Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined})");
  await click("Copy & clear"); await wait("!!document.querySelector('.comment-copy-fallback textarea')");
  await check(`JSON.parse(localStorage.getItem('${storage}')).review.notes.length===2`);
  await b("eval", "delete navigator.clipboard");
  await b("press", "Escape"); await b("reload"); await ready();

  // Delayed permission clears the captured batch, not comments restored meanwhile.
  await b("set", "viewport", "1440", "1000", "2");
  const beforeClear = JSON.parse(await b("eval", `JSON.parse(localStorage.getItem('${storage}')).review.notes`));
  await reviewPage("cover"); await b("fill", "#revision-note", "Unsent draft survives copying");
  await openReviews(); await click("Remove comment 2");
  await b("eval", "window.writeClipboard=navigator.clipboard.writeText.bind(navigator.clipboard);navigator.clipboard.writeText=text=>new Promise(resolve=>{window.finishCopy=()=>window.writeClipboard(text).then(resolve)})");
  await click("Copy & clear"); await wait("!!window.finishCopy");
  await b("press", "Control+z");
  await check("document.querySelector('.review-count').textContent==='2'");
  await b("press", "Escape");
  await b("dblclick", `${page("cover")} .stage-meta h2`);
  await b("fill", 'input[aria-label="Page name"]', "Newer human title"); await b("press", "Enter");
  await b("eval", "window.finishCopy();true");
  await wait("document.querySelector('.toast.visible')?.textContent.includes('Copied and cleared')");
  assert.deepEqual(JSON.parse(await b("eval", `JSON.parse(localStorage.getItem('${storage}')).review.notes`)), [beforeClear[1]]);
  assert.doesNotMatch(await b("clipboard", "read"), /Show the failure path too/);
  await check(`JSON.parse(localStorage.getItem('${storage}')).document.pages[0].name==='Newer human title'`);
  await capture("copy-clear-undo");
  await b("dblclick", `${page("cover")} .stage-meta h2`);
  await b("fill", 'input[aria-label="Page name"]', "After-copy human title"); await b("press", "Enter");
  await click("Undo");
  assert.deepEqual(JSON.parse(await b("eval", `JSON.parse(localStorage.getItem('${storage}')).review.notes`)), beforeClear);
  await check(`JSON.parse(localStorage.getItem('${storage}')).document.pages[0].name==='After-copy human title'`);
  await reviewPage("cover");
  await check("document.querySelector('#revision-note').value==='Unsent draft survives copying'");

  // Clipboard success alone is insufficient: persist the clear before removing pins.
  await openReviews(); await click("Copy & clear");
  await b("eval", "window.realSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('Storage full')};window.finishCopy();true");
  await wait("document.querySelector('.toast.visible')?.textContent.includes('Your queue was kept')");
  await check("!!document.querySelector('.revision-notes') && document.querySelector('.review-launcher').getAttribute('aria-expanded')==='true' && document.querySelector('.review-count').textContent==='2' && document.querySelectorAll('.revision-pin').length===2");
  assert.deepEqual(JSON.parse(await b("eval", `JSON.parse(localStorage.getItem('${storage}')).review.notes`)), beforeClear);
  await capture("copy-clear-storage-failure");
  await b("eval", "Storage.prototype.setItem=window.realSetItem");

  // An import remounts the review session; its pending copy cannot clear an undo-restored queue.
  await click("Copy & clear");
  await b("upload", 'input[type=file]', path); await wait("!document.querySelector('.review-count')");
  await b("press", "Control+z"); await wait("document.querySelector('.review-count')?.textContent==='2'");
  await b("eval", "window.finishCopy();true");
  await b("wait", "350");
  assert.deepEqual(JSON.parse(await b("eval", `JSON.parse(localStorage.getItem('${storage}')).review.notes`)), beforeClear);
  await b("eval", "navigator.clipboard.writeText=window.writeClipboard");

  // Successful clearing dismisses reviews and is durable across reloads.
  await openReviews(); await click("Copy & clear");
  await wait("document.querySelector('.toast.visible')?.textContent.includes('Copied and cleared')");
  await check("!document.querySelector('.revision-notes,.workspace.reviewing,.review-count,.revision-pin') && document.querySelector('.review-launcher').getAttribute('aria-expanded')==='false'");
  await capture("copied-closed-reviews");
  await b("reload"); await ready();
  await check(`JSON.parse(localStorage.getItem('${storage}')).review.notes.length===0 && !document.querySelector('.revision-pin')`);
  // Keep comments for the remaining responsive-layout scenarios.
  await b("open", `${base}src/assets/konpeki-mark.png`);
  await b("eval", `(()=>{const state=JSON.parse(localStorage.getItem('${storage}'));state.review.notes=${JSON.stringify(beforeClear)};localStorage.setItem('${storage}',JSON.stringify(state))})()`);
  await b("open", `${base}?example=introducing-konpeki`); await ready();
  await openReviews();
  await b("set", "viewport", "390", "844", "2");
  await wait("[...document.querySelectorAll('.board-page')].every((p,i,pages)=>p.style.top===pages[0].style.top&&(!i||parseFloat(p.style.left)>parseFloat(pages[i-1].style.left)))");
  await check("(()=>{const r=document.querySelector('.revision-notes').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})()");
  await capture("narrow-comments");
  await b("press", "Escape"); await capture("narrow-board");
  await check("document.querySelector('.workspace').scrollHeight<=document.querySelector('.workspace').clientHeight+1");
  await b("eval", "document.querySelector('.board-page:last-child').scrollIntoView({block:'nearest',inline:'center'})");
  await check("(()=>{const r=document.querySelector('.board-page:last-child').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<innerHeight})()");

  // A tall list and unbroken text must not push actions outside a short viewport.
  await b("eval", `(()=>{const state=JSON.parse(localStorage.getItem('${storage}'));state.review.notes=Array.from({length:12},(_,i)=>({id:'overflow-'+i,slideId:'cover',text:i===0?'Keep this reference readable: '+ 'LongReference'.repeat(28):'Review '+(i+1)+': Keep the explanation concise and preserve the source facts.',resolved:false}));localStorage.setItem('${storage}',JSON.stringify(state))})()`);
  await b("reload"); await ready();
  await b("set", "viewport", "390", "620", "2");
  await openReviews();
  await check("document.querySelector('.review-count').textContent==='12' && document.querySelectorAll('.revision-note-list li').length===12");
  await check("(()=>{const p=document.querySelector('.revision-notes');return p.scrollHeight>p.clientHeight&&p.scrollWidth===p.clientWidth&&p.getBoundingClientRect().height<=innerHeight/2})()");
  await capture("long-review-list");
  await b("eval", "document.querySelector('.revision-notes').scrollTop=document.querySelector('.revision-notes').scrollHeight");
  await check("(()=>{const p=document.querySelector('.revision-notes').getBoundingClientRect(),f=document.querySelector('.review-actions').getBoundingClientRect(),last=document.querySelector('.revision-note-list li:last-child').getBoundingClientRect();return f.bottom<=p.bottom&&last.top>=p.top&&last.bottom<=f.top&&p.left>=0&&p.right<=innerWidth&&p.bottom<document.querySelector('.review-launcher').getBoundingClientRect().top})()");
  await capture("long-review-list-end");
  // New comment removes even a full queue before selecting the next target.
  await click("New comment");
  await check("!document.querySelector('.revision-notes') && !!document.querySelector('.workspace.reviewing')");
  await b("eval", "document.querySelector('.workspace').scrollTo(0,0)");
  await b("click", titleHit);
  await check("!!document.querySelector('.comment-composer') && document.activeElement.id==='revision-note'");
  await click("Cancel");
  await check("document.querySelector('#comment-heading')?.textContent==='Pending reviews'");
  await b("click", ".review-launcher");
  await b("set", "media", "light", "reduced-motion");
  await openReviews();
  await check("matchMedia('(prefers-reduced-motion: reduce)').matches && getComputedStyle(document.querySelector('.revision-notes')).animationName==='none'");
  await click("New comment"); await b("click", titleHit);
  await check("getComputedStyle(document.querySelector('.revision-notes')).animationName==='none' && getComputedStyle(document.querySelector('.review-launcher svg')).animationName==='none'");
  await b("press", "Escape");
  await b("set", "media", "light");
  await b("open", base); await wait("!!document.querySelector('.scene-artwork svg')");
  await check("document.querySelectorAll('.board-page').length===1 && !document.querySelector('.component-hit,.page-order > path')");
  await capture("empty-board");
  console.log("PASS: select-first entry, compact queue, new-comment selection, saved-comment editing, reduced motion, cancel/Escape draft preservation, anchored composer follows selection/scroll/resize, clipboard contents and safe clearing, no-duplicate retry, denied/unavailable clipboard fallback, browser-local persistence and legacy import, session restart, no sidecar writes, markers/movement/deletion/undo, correction canvas, export isolation, corrupt/full storage, keyboard focus, empty/narrow states, long-list sticky actions and wrapping.");
} catch (error) {
  await capture("failure").catch(() => {});
  console.error(await b("eval", "JSON.stringify({count:document.querySelector('.review-count')?.textContent,comments:[...document.querySelectorAll('.revision-note-list li p')].map(p=>p.textContent),error:document.querySelector('.recovery.visible')?.textContent,storage:Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('konpeki-comments/')))})").catch(() => "Browser diagnostics unavailable"));
  throw error;
} finally {
  cdp?.close();
  await b("close").catch(() => {});
  await server.close();
  await rm(scratch, { recursive: true, force: true });
}
