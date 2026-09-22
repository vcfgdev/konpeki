// Runs a disposable file session and the external agent-browser CLI.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { createServer } from "vite";
import { fileSessionPlugin } from "../bin/session-plugin.ts";
import { readReview } from "../bin/review-store.ts";

const exec = promisify(execFile);
const scratch = await mkdtemp(join(tmpdir(), "konpeki-build-"));
const compositionPath = join(scratch, "composition.json");
const artifacts = resolve(process.argv[2] ?? ".amp/in/artifacts/build");
const document = JSON.parse(await readFile("slides/introducing-konpeki/composition.json", "utf8"));
await writeFile(compositionPath, JSON.stringify(document));
await mkdir(artifacts, { recursive: true });
let requests = 0;
let rejectBuild = false;
let rejectSave = false;
const server = await createServer({
  server: { host: "127.0.0.1", port: 0 },
  plugins: [{ name: "reject-test-build", enforce: "pre", configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (rejectSave && request.method === "PUT" && request.url === "/__konpeki/session") {
        response.writeHead(500, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "Save rejected for test" }));
      } else if (rejectBuild && request.url === "/__konpeki/session/build") {
        response.writeHead(500, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "Build request rejected for test" }));
      } else next();
    });
  } }, fileSessionPlugin({
    compositionPath,
    token: "disposable-build-test",
    onBuildRequest: () => {
      requests++;
    },
  })],
});
async function browser(...args) {
  const { stdout } = await exec("agent-browser", ["--session", "build-check", ...args]);
  return stdout.trim();
}
async function check(source, message) {
  await browser("eval", `if (!(${source})) throw Error(${JSON.stringify(message)})`);
}
async function capture(name) {
  await browser("eval", "document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))");
  await browser("screenshot", join(artifacts, `${name}.png`));
}
try {
  await server.listen();
  const port = server.httpServer.address().port;
  await browser("open", `http://127.0.0.1:${port}/?session=disposable-build-test`);
  await browser("set", "viewport", "1440", "900", "2");
  await browser("wait", "--fn", "!!document.querySelector('.build-button:not(:disabled)')");
  await check("!document.querySelector('.toast button')", "Opening notification has an unexpected dismiss button");
  await browser("wait", "--fn", "!document.querySelector('.toast.visible')");
  rejectSave = true;
  await browser("eval", `new Promise(resolve => {
    const input = document.querySelector('[name="composition-title"]');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setValue.call(input, 'Unsaved title');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    requestAnimationFrame(() => {
      document.querySelector('.build-button').click();
      resolve();
    });
  })`);
  await browser("wait", "--text", "Save rejected for test");
  await check("document.querySelector('.toast.error [role=alert]') && !document.querySelector('.build-loading')", "Failed pre-build save lost its error or left the editor locked");
  assert.equal(requests, 0, "Build request was sent after its save failed");
  rejectSave = false;
  await browser("reload");
  await browser("wait", "--fn", "!!document.querySelector('.build-button:not(:disabled)')");
  await browser("wait", "--fn", "!document.querySelector('.toast.visible')");
  await check("getComputedStyle(document.querySelector('.build-button')).backgroundColor === 'rgb(255, 255, 255)'", "Idle Build it background is not white");
  await capture("idle");
  await browser("eval", "window.idleOrbBounds=document.querySelector('.build-button .build-orb').getBoundingClientRect().toJSON()");
  if (process.argv.includes("--record"))
    await browser("record", "start", join(artifacts, "build-cycle.mp4"), "--fps", "15");
  await browser("click", ".build-button");
  await browser("wait", "--fn", "!!document.querySelector('.build-loading')");
  await check("(()=>{const r=document.querySelector('.build-button .build-orb').getBoundingClientRect();return r.x===window.idleOrbBounds.x && r.y===window.idleOrbBounds.y})()", "Orb shifted when button label changed");
  await browser("wait", "1500"); // The POST and at least one unchanged poll must not end loading.
  await check("!document.querySelector('.toast.visible')", "Build request showed a redundant toast");
  await check("document.querySelector('.build-button.building:disabled[aria-busy=true]') && [...document.querySelectorAll('.editor-content')].every(element => element.inert) && document.querySelector('.build-loading[role=status]')", "Loading ended before the agent returned");
  await check("document.querySelector('.action-island').checkVisibility() && document.querySelector('.build-label').textContent === 'Request ready'", "Document actions disappeared while the request waited for handoff");
  await check("getComputedStyle(document.querySelector('.build-label')).backgroundImage.includes('linear-gradient') && getComputedStyle(document.querySelector('.build-label')).backgroundClip === 'text'", "Shimmer is not on the label");
  await check("!document.querySelector('.build-loading-track') && getComputedStyle(document.querySelector('.build-button'),'::after').content === 'none'", "Old progress strip remains");
  await browser("eval", "window.orbStart=getComputedStyle(document.querySelector('.build-button circle')).transform");
  await browser("wait", "1700");
  await check("getComputedStyle(document.querySelector('.build-button circle')).transform !== window.orbStart", "Button orb did not change shape");
  await browser("eval", "document.querySelector('.build-button').click()");
  assert.equal(requests, 1, "Duplicate build request");
  await capture("waiting");
  await check("document.querySelector('.build-loading-card strong').textContent === 'Request ready' && document.querySelector('.build-loading-card').textContent.includes('Copy the handoff prompt')", "Handoff state is unclear");
  await browser("eval", "Object.defineProperty(navigator.clipboard, 'writeText', {configurable:true,value:async text=>{window.copiedPrompt=text}})");
  await browser("find", "role", "button", "click", "--name", "Copy prompt", "--exact");
  await check("window.copiedPrompt === 'Pick up my pending Konpeki request and apply the changes.'", "Copied prompt is incorrect");
  await browser("eval", "Object.defineProperty(navigator.clipboard, 'writeText', {configurable:true,value:async()=>{throw Error('Clipboard denied')}})");
  await browser("find", "role", "button", "click", "--name", "Copy prompt", "--exact");
  await browser("wait", "--text", "Could not copy. Ask your coding agent to pick up your pending Konpeki request");
  await browser("wait", "--fn", "!document.querySelector('.toast.visible')");
  const { stdout } = await exec(process.execPath, ["bin/konpeki.mjs", "wait", compositionPath]);
  const request = JSON.parse(stdout);
  assert.equal(request.status, "working");
  await browser("wait", "--text", "Agent working");
  await check("document.querySelector('.action-island').checkVisibility() && document.querySelector('.build-label').textContent === 'Agent working'", "Document actions disappeared while the agent worked");
  await check("!document.querySelector('.build-loading-card').textContent.includes('Copy prompt')", "Working state still asks for handoff");
  await capture("working");
  document.slides[0].name = "Agent result loaded";
  await writeFile(compositionPath, JSON.stringify(document));
  await browser("wait", "--fn", "document.querySelector('.stage-meta').textContent.includes('Agent result loaded')");
  await check("!!document.querySelector('.build-loading')", "An unrelated file change completed the request");
  await exec(process.execPath, ["bin/konpeki.mjs", "finish", compositionPath, request.id]);
  await browser("wait", "--fn", "!document.querySelector('.build-loading') && document.querySelector('.stage-meta').textContent.includes('Agent result loaded')");
  await check("!document.querySelector('.build-button').disabled && [...document.querySelectorAll('.editor-content')].every(element => !element.inert)", "Editor did not unlock after the result rendered");
  await check("!document.querySelector('.toast.visible')", "Agent result showed a redundant toast");
  await capture("completed");
  if (process.argv.includes("--record")) {
    await browser("wait", "1000");
    await browser("record", "stop");
  }

  rejectBuild = true;
  await browser("click", ".build-button");
  await browser("wait", "--text", "Build request rejected for test");
  await check("!document.querySelector('.build-loading') && !document.querySelector('.build-button').disabled", "Failed request left the editor locked");
  await capture("request-error");
  rejectBuild = false;

  await browser("set", "viewport", "1024", "768", "2");
  await browser("set", "media", "light", "reduced-motion");
  await browser("click", ".build-button");
  await browser("wait", "--fn", "!!document.querySelector('.build-loading')");
  await browser("wait", "1500");
  await check("[...document.querySelectorAll('.build-orb, .build-orb circle, .build-label')].every(e=>getComputedStyle(e).animationName === 'none') && getComputedStyle(document.querySelector('.build-nebula'), '::before').animationName === 'none'", "Reduced motion still animates");
  await capture("waiting-reduced-motion");
  await writeFile(compositionPath, "invalid JSON");
  await browser("wait", "--text", "Could not load the agent result.");
  await check("!!document.querySelector('.build-loading') && [...document.querySelectorAll('.editor-content')].every(element => element.inert)", "Polling failure unlocked an active request");
  await capture("connection-error");
  await writeFile(compositionPath, JSON.stringify(document));
  await browser("wait", "1500");
  await check("!!document.querySelector('.build-loading') && [...document.querySelectorAll('.editor-content')].every(element => element.inert)", "Recovery unlocked an active request");
  await browser("find", "role", "button", "click", "--name", "Cancel request", "--exact");
  await browser("wait", "--fn", "!document.querySelector('.build-loading')");
  assert.equal((await readReview(compositionPath)).request.status, "failed");
  console.log("Build lifecycle OK: failed pre-build save remains visible, persisted request, CLI claim, explicit completion, duplicate blocked, polling failure/recovery stays locked until cancel, reduced motion respected.");
} finally {
  await browser("close").catch(() => {});
  await server.close();
  await rm(scratch, { recursive: true, force: true });
}
