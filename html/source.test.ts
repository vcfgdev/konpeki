import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileSource, inspectSource, patchSource } from "./source.ts";

const source = `<!doctype html>\n<style>p { color: blue; }</style>\n<body><article id='one' data-page>\n<!-- <p id="target">not the target</p> -->\n<p title="a > b" id="target" style='color: red; --label: "A&amp;B"'>Keep <b>inline</b> wording.</p><p id="other">Untouched</p></article><article data-page id="two"><p id="elsewhere">Other page</p></article></body>`;
test("patches only the exact style attribute, escaping CSS string content", () => {
  const style = 'color: red; --label: "A&B"; translate: 12px -6px;';
  assert.equal(patchSource(source, { kind: "move", page: "one", id: "target", style }), source.replace(`style='color: red; --label: "A&amp;B"'`, 'style="color: red; --label: &quot;A&amp;B&quot;; translate: 12px -6px;"'));
});
test("inserts style without rewriting other attributes; deletes only the selected subtree", () => {
  const result = patchSource(source, { kind: "move", page: "one", id: "other", style: "translate: -7px 19px;" });
  assert.equal(result, source.replace('<p id="other">', '<p id="other" style="translate: -7px 19px;">'));
  assert.equal(patchSource(source, { kind: "delete", page: "one", id: "target" }), source.replace(`<p title="a > b" id="target" style='color: red; --label: "A&amp;B"'>Keep <b>inline</b> wording.</p>`, ""));
});
test("rejects missing, ambiguous and cross-page targets and deleting pages", () => {
  assert.throws(() => inspectSource(source.replace('id="other"', 'id="target"')), /unique/);
  for (const id of ["elsewhere", "one", "missing"]) assert.throws(() => patchSource(source, { kind: "delete", page: "one", id }));
});
test("rejects active documents and duplicate attributes rather than silently changing their meaning", () => {
  for (const markup of ['<script>fetch("/private")</script>', '<img src="x" onerror="alert(1)">', '<iframe src="https://example.com"></iframe>', '<template><script>run()</script></template>', '<a href="javascript:alert(1)">link</a>'])
    assert.throws(() => inspectSource(source.replace("Untouched", markup)), /static/);
  assert.throws(() => inspectSource(source.replace('id="other"', 'id="other" id="second"')), /Duplicate HTML attributes/);
  assert.doesNotThrow(() => inspectSource(source.replace("Untouched", '<svg id="art"><path id="arrow" d="M0 0H10"/></svg>')));
});
test("serializes writes, rejects stale revisions and never undoes an external revision", async () => {
  const dir = await mkdtemp(join(tmpdir(), "konpeki-html-test-")), path = join(dir, "source.html");
  try {
    await writeFile(path, source);
    const store = fileSource(path), initial = await store.read();
    const changes = await Promise.allSettled([
      store.edit(initial.revision, { kind: "move", page: "one", id: "target", style: "translate: 12px -6px;" }),
      store.edit(initial.revision, { kind: "delete", page: "one", id: "other" }),
    ]);
    assert.equal(changes[0].status, "fulfilled"); assert.equal(changes[1].status, "rejected");
    const moved = await store.read();
    assert.match(moved.source, /translate: 12px -6px;/); assert.match(moved.source, /Untouched/);
    await store.edit(moved.revision, { kind: "undo" });
    assert.equal(await readFile(path, "utf8"), source);
    await store.edit(initial.revision, { kind: "delete", page: "one", id: "other" });
    const deleted = await store.read();
    const external = deleted.source.replace("Keep", "Newer agent wording");
    await writeFile(path, external);
    await assert.rejects(store.edit(deleted.revision, { kind: "undo" }), /outside/);
    const current = await store.read();
    await assert.rejects(store.edit(current.revision, { kind: "undo" }), /safe to undo/);
    assert.equal(await readFile(path, "utf8"), external);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
