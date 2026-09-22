import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const cli = fileURLToPath(new URL("./konpeki.mjs", import.meta.url));
async function launch(t: TestContext, path: string, args: string[] = [], executable = cli) {
  const child = spawn(process.execPath, [executable, "preview", path, "--json", ...args]);
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

test("installed preview serves hoisted fonts without exposing neighboring files", async t => {
  const root = await mkdtemp(join(tmpdir(), "konpeki-installed-preview-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const packageRoot = join(root, "konpeki");
  await mkdir(packageRoot);
  await symlink(fileURLToPath(new URL("../node_modules", import.meta.url)), join(root, "node_modules"), "dir");
  for (const file of ["package.json", "vite.config.ts"])
    await copyFile(new URL(`../${file}`, import.meta.url), join(packageRoot, file));
  await build({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    logLevel: "silent",
    build: {
      ssr: cli, outDir: join(packageRoot, "runtime"), emptyOutDir: true,
      rolldownOptions: { output: { entryFileNames: "konpeki.mjs" } },
    },
  });
  const compositionPath = join(root, "composition.json");
  await copyFile(new URL("../slides/introducing-konpeki/composition.json", import.meta.url), compositionPath);
  await writeFile(join(root, "private.txt"), "private neighboring file");
  await writeFile(join(packageRoot, ".env"), "PRIVATE=test-fixture");
  await writeFile(join(packageRoot, "composition.json.review.json"), "private review fixture");
  const preview = await launch(t, compositionPath, ["--port", "0"], join(packageRoot, "runtime/konpeki.mjs"));
  const { url } = await preview.ready;
  for (const font of ["ibm-plex-sans", "ibm-plex-serif", "noto-sans", "hanken-grotesk"]) {
    for (const weight of [400, 500, 600]) {
      const path = fileURLToPath(import.meta.resolve(`@fontsource/${font}/files/${font}-latin-${weight}-normal.woff2`));
      const response = await fetch(new URL(`/@fs${path}`, url));
      assert.equal(response.status, 200, `${font} ${weight} must load outside the installed package root`);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(path), "serve actual font bytes, not HTML fallback");
    }
  }
  for (const path of [join(root, "private.txt"), join(packageRoot, ".env"), join(packageRoot, "composition.json.review.json")])
    assert.equal((await fetch(new URL(`/@fs${path}`, url))).status, 403, "font access must not expose neighboring or denied files");
});
