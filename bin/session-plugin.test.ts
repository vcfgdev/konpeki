import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createServer } from "vite";
import { fileSessionPlugin } from "./session-plugin.ts";
import { emptyReview } from "../src/lib/review.ts";

test("review sidecars are API-only, including temporary and /@fs/ paths", async t => {
  const root = await mkdtemp(join(tmpdir(), "konpeki-private-review-"));
  const path = join(root, "composition.json");
  await writeFile(path, await readFile(new URL("../slides/introducing-konpeki/composition.json", import.meta.url)));
  const legacy = JSON.stringify({ ...emptyReview(), notes: [{ id: "old-note", slideId: "cover", text: "Private feedback", resolved: false }] });
  await writeFile(`${path}.review.json`, legacy);
  await writeFile(`${path}.review.json.test.tmp`, "Private temporary data");
  await writeFile(join(root, ".env"), "PRIVATE=value");
  for (const file of ["private.key", ".npmrc", ".yarnrc.yml", "caller-private.txt"])
    await writeFile(join(root, file), "Disposable private fixture");
  const server = await createServer({ root, configFile: false, logLevel: "silent", server: { host: "127.0.0.1", port: 0, fs: { deny: ["**/caller-private.txt"] } }, plugins: [fileSessionPlugin({ compositionPath: path, token: "test-token" })] });
  t.after(async () => { await server.close(); await rm(root, { recursive: true, force: true }); });
  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  for (const file of ["composition.json.review.json", "composition.json.review.json.test.tmp", ".env", "private.key", ".npmrc", ".yarnrc.yml", "caller-private.txt"]) {
    for (const url of [`/${file}`, `/@fs/${root}/${file}`])
      assert.equal((await fetch(base + url)).status, 403, url);
  }
  assert.equal((await fetch(`${base}/__konpeki/session`)).status, 403);
  const response = await fetch(`${base}/__konpeki/session`, { headers: { "x-konpeki-session": "test-token" } });
  assert.equal(response.status, 200);
  const session = await response.json();
  assert.equal(session.review.notes[0].text, "Private feedback");
  const headers = { "x-konpeki-session": "test-token", "content-type": "application/json" };
  const exportBody = { revision: session.revision, format: "svg", page: 2, scale: 2 };
  assert.equal((await fetch(`${base}/__konpeki/session/export`, { method: "POST", body: JSON.stringify(exportBody) })).status, 403);
  assert.equal((await fetch(`${base}/__konpeki/session/export`, { method: "POST", headers, body: JSON.stringify({ ...exportBody, revision: "stale" }) })).status, 409);
  assert.equal((await fetch(`${base}/__konpeki/session/export`, { method: "POST", headers, body: JSON.stringify({ ...exportBody, page: 0 }) })).status, 400);
  const exported = await fetch(`${base}/__konpeki/session/export`, { method: "POST", headers, body: JSON.stringify(exportBody) });
  assert.equal(exported.status, 200);
  assert.equal(exported.headers.get("content-type"), "image/svg+xml");
  assert.match(await exported.text(), /aria-label="brief-to-page"/);
  for (const endpoint of ["build", "cancel", "notes", "notes/resolve"])
    assert.equal((await fetch(`${base}/__konpeki/session/${endpoint}`, { method: "POST", headers, body: "{}" })).status, 404);
  assert.equal((await fetch(`${base}/__konpeki/session/notes`, { method: "DELETE", headers, body: "{}" })).status, 404);
  assert.equal(await readFile(`${path}.review.json`, "utf8"), legacy);
});

test("browser comment identity survives revisions and tokens but isolates different files", async t => {
  const root = await mkdtemp(join(tmpdir(), "konpeki-comment-identity-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const raw = await readFile(new URL("../slides/introducing-konpeki/composition.json", import.meta.url), "utf8");
  const identities = [];
  const revisions = [];
  for (const [file, token, content] of [["first.json", "first-token", raw], ["first.json", "new-token", raw + "\n"], ["second.json", "new-token", raw + "\n"]]) {
    const path = join(root, file);
    await writeFile(path, content);
    const server = await createServer({ root, configFile: false, logLevel: "silent", server: { host: "127.0.0.1", port: 0 }, plugins: [fileSessionPlugin({ compositionPath: path, token })] });
    try {
      await server.listen();
      const address = server.httpServer!.address();
      assert.ok(address && typeof address === "object");
      const response = await fetch(`http://127.0.0.1:${address.port}/__konpeki/session`, { headers: { "x-konpeki-session": token } });
      assert.equal(response.status, 200);
      const session = await response.json();
      identities.push(session.commentKey); revisions.push(session.revision);
      assert.match(session.commentKey, /^[a-f0-9]{64}$/);
      await assert.rejects(readFile(`${path}.review.json`), { code: "ENOENT" });
    } finally { await server.close(); }
  }
  assert.equal(identities[0], identities[1]);
  assert.notEqual(identities[1], identities[2]);
  assert.notEqual(revisions[0], revisions[1]);
  assert.equal(revisions[1], revisions[2]);
});

test("malformed legacy comments warn without blocking document reads or revision-checked saves", async t => {
  const root = await mkdtemp(join(tmpdir(), "konpeki-legacy-warning-"));
  const path = join(root, "composition.json");
  await writeFile(path, await readFile(new URL("../slides/introducing-konpeki/composition.json", import.meta.url)));
  const server = await createServer({ root, configFile: false, logLevel: "silent", server: { host: "127.0.0.1", port: 0 }, plugins: [fileSessionPlugin({ compositionPath: path, token: "test-token" })] });
  t.after(async () => { await server.close(); await rm(root, { recursive: true, force: true }); });
  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}/__konpeki/session`;
  const headers = { "x-konpeki-session": "test-token", "content-type": "application/json" };
  for (const raw of ["{broken", "null", JSON.stringify({ ...emptyReview(), notes: [null] })]) {
    await writeFile(`${path}.review.json`, raw);
    const response = await fetch(url, { headers });
    assert.equal(response.status, 200);
    const session = await response.json();
    assert.match(session.reviewError, /Legacy comments could not be imported/);
    assert.deepEqual(session.review, emptyReview());
    session.document.title += " revised";
    const body = JSON.stringify({ revision: session.revision, document: session.document });
    assert.equal((await fetch(url, { method: "PUT", headers, body })).status, 200);
    assert.equal((await fetch(url, { method: "PUT", headers, body })).status, 409);
    assert.equal(JSON.parse(await readFile(path, "utf8")).title, session.document.title);
    assert.equal(await readFile(`${path}.review.json`, "utf8"), raw);
  }
  await writeFile(path, "{broken");
  assert.equal((await fetch(url, { headers })).status, 400, "composition errors must still fail");
});
