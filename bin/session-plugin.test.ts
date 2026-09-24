import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createServer } from "vite";
import { fileSessionPlugin } from "./session-plugin.ts";
import { addRevisionNote } from "./review-store.ts";

test("review sidecars are API-only, including temporary and /@fs/ paths", async t => {
  const root = await mkdtemp(join(tmpdir(), "konpeki-private-review-"));
  const path = join(root, "composition.json");
  await writeFile(path, await readFile(new URL("../slides/introducing-konpeki/composition.json", import.meta.url)));
  await addRevisionNote(path, { slideId: "cover" }, "Private feedback");
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
  assert.equal((await response.json()).review.notes[0].text, "Private feedback");
});
