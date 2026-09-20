// Runs a disposable file session and the external agent-browser CLI.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { createServer } from "vite";
import { fileSessionPlugin } from "../bin/session-plugin.ts";
import { requestFileFor } from "../bin/session-store.ts";

const exec = promisify(execFile);
const scratch = await mkdtemp(join(tmpdir(), "konpeki-build-"));
const compositionPath = join(scratch, "composition.json");
const artifacts = resolve(process.argv[2] ?? ".amp/in/artifacts/build");
const document = JSON.parse(await readFile("slides/introducing-konpeki/composition.json", "utf8"));
await writeFile(compositionPath, JSON.stringify(document));
await mkdir(artifacts, { recursive: true });
let requests = 0;
let rejectBuild = false;
const server = await createServer({
  server: { host: "127.0.0.1", port: 0 },
  plugins: [fileSessionPlugin({
    compositionPath,
    token: "disposable-build-test",
    onBuildRequest: () => {
      if (rejectBuild) throw Error("Build request rejected for test");
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
  await check("getComputedStyle(document.querySelector('.build-button')).backgroundColor === 'rgb(255, 255, 255)'", "Idle Build it background is not white");
  await capture("idle");
  if (process.argv.includes("--record"))
    await browser("record", "start", join(artifacts, "build-cycle.mp4"), "--fps", "15");
  await browser("click", ".build-button");
  await browser("wait", "--fn", "!!document.querySelector('.build-loading')");
  await browser("wait", "1500"); // The POST and at least one unchanged poll must not end loading.
  await check("!document.querySelector('.toast.visible')", "Build request showed a redundant toast");
  await check("document.querySelector('.build-button.building:disabled[aria-busy=true]') && document.querySelector('.editor-content').inert && document.querySelector('.build-loading[role=status]')", "Loading ended before the agent returned");
  await check("getComputedStyle(document.querySelector('.build-button')).backgroundImage.includes('linear-gradient')", "Disabled styles hid the gradient");
  await browser("eval", "document.querySelector('.build-button').click()");
  assert.equal(requests, 1, "Duplicate build request");
  await capture("waiting");
  document.slides[0].name = "Agent result loaded";
  await writeFile(compositionPath, JSON.stringify(document));
  await browser("wait", "--fn", "!document.querySelector('.build-loading') && document.querySelector('.stage-meta').textContent.includes('Agent result loaded')");
  await check("!document.querySelector('.build-button').disabled && !document.querySelector('.editor-content').inert", "Editor did not unlock after the result rendered");
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
  await check("getComputedStyle(document.querySelector('.build-button')).animationName === 'none' && getComputedStyle(document.querySelector('.build-loading-track'), '::after').animationName === 'none'", "Reduced motion still animates");
  await capture("waiting-reduced-motion");
  await writeFile(compositionPath, "invalid JSON");
  await browser("wait", "--text", "Could not load the agent result.");
  await check("!document.querySelector('.build-loading') && !document.querySelector('.editor-content').inert", "Polling failure left the editor locked");
  await capture("connection-error");
  console.log("Build lifecycle OK: pending after POST, duplicate blocked, result rendered, request/poll failures unlock, reduced motion respected.");
} finally {
  await browser("close").catch(() => {});
  await server.close();
  await rm(requestFileFor(compositionPath), { force: true });
  await rm(scratch, { recursive: true, force: true });
}
