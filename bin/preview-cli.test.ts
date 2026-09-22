import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("./konpeki.mjs", import.meta.url));
async function launch(t: TestContext, path: string, args: string[] = []) {
  const child = spawn(process.execPath, [cli, "preview", path, "--json", ...args]);
  const exited = once(child, "exit");
  t.after(async () => { if (child.exitCode === null) child.kill(); await exited; });
  let stdout = "";
  let stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk; });
  const ready = new Promise<{ type: string; compositionPath: string; url: string }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Preview did not become ready")), 30_000);
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("exit", () => { clearTimeout(timer); reject(new Error(stderr || "Preview exited before readiness")); });
    child.stdout.on("data", chunk => {
      stdout += chunk;
      if (!stdout.includes("\n")) return;
      clearTimeout(timer);
      try { resolve(JSON.parse(stdout.trim())); } catch (error) { reject(error); }
    });
  });
  return { ready, exited, output: () => stdout };
}

test("preview readiness identifies the right document and collision-free session", async t => {
  const root = await mkdtemp(join(tmpdir(), "konpeki-preview-cli-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const original = JSON.parse(await readFile(new URL("../slides/introducing-konpeki/composition.json", import.meta.url), "utf8"));
  const sessions = [];
  for (const [title, args] of [
    ["Product announcement", []],
    ["Article cover", []],
    ["Quarterly chart", ["--port", "0"]],
  ] as const) {
    const path = join(root, `${title}.json`);
    await writeFile(path, JSON.stringify({ ...original, title }));
    const process = await launch(t, path, [...args]);
    const ready = await process.ready;
    assert.equal(ready.type, "ready");
    assert.equal(ready.compositionPath, path);
    const url = new URL(ready.url);
    assert.equal(url.hostname, "127.0.0.1");
    assert.ok(Number(url.port) > 0);
    const endpoint = new URL("/__konpeki/session", url);
    assert.equal((await fetch(endpoint)).status, 403, "readiness must not remove session protection");
    const response = await fetch(endpoint, { headers: { "x-konpeki-session": url.searchParams.get("session")! } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).document.title, title);
    assert.equal(process.output().trim().split("\n").length, 1, "stdout must stay machine readable");
    sessions.push(url);
  }
  assert.equal(new Set(sessions.map(url => url.port)).size, 3);
  assert.notEqual(sessions[0].searchParams.get("session"), sessions[1].searchParams.get("session"));
});

test("an explicitly occupied port fails cleanly rather than reporting a false ready URL", async t => {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const process = await launch(t, fileURLToPath(new URL("../slides/introducing-konpeki/composition.json", import.meta.url)), ["--port", String(address.port)]);
  await assert.rejects(process.ready, /already in use/);
  assert.equal((await process.exited)[0], 1);
  assert.equal(process.output(), "");
});
