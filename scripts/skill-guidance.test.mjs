import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

test("copied skill links reach all format guides without missing resources or anchors", async t => {
  const root = await mkdtemp(join(tmpdir(), "konpeki-guidance-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const copied = join(root, "installed skill");
  await cp(new URL("../skills/konpeki/", import.meta.url), copied, { recursive: true });
  const base = pathToFileURL(`${copied}/`);
  const pending = [new URL("SKILL.md", base)];
  const visited = new Set();
  while (pending.length) {
    const url = pending.pop();
    assert.ok(url.href.startsWith(base.href), `Guidance escapes copied skill: ${url.href}`);
    const source = await readFile(url, "utf8");
    if (url.hash) {
      const headings = [...source.matchAll(/^#{1,6} (.+)$/gm)].map(([, heading]) =>
        heading.toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu, "").replace(/ /g, "-"));
      assert.ok(headings.includes(decodeURIComponent(url.hash.slice(1))), `Missing anchor: ${url.href}`);
    }
    url.hash = "";
    if (visited.has(url.href)) continue;
    visited.add(url.href);
    if (!url.pathname.endsWith(".md")) continue;
    for (const [, link] of source.matchAll(/\[[^\]]+\]\(([^\s)]+)\)/g)) {
      if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(link)) continue;
      pending.push(new URL(link, url));
    }
  }
  for (const reference of ["slides", "resume", "long-document", "one-pager", "cover", "patterns"]) {
    assert.ok(visited.has(new URL(`references/${reference}.md`, base).href), `Unreachable guidance: ${reference}`);
  }
  assert.ok(visited.has(new URL("floor.md", base).href), "The shared floor must remain reachable");
});
