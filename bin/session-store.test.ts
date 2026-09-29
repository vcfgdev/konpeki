import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJSON } from "../composition/compile.ts";
import { initialDraft } from "../composition/document.ts";
import { toComposition } from "../composition/grid.ts";
import {
  readCompositionFile,
  saveCompositionFile,
} from "./session-store.ts";

test("file sessions save atomically and reject stale revisions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "konpeki-session-test-"));
  const path = join(directory, "composition.json");
  try {
    const draft = initialDraft(true);
    await writeFile(path, `${canonicalJSON(toComposition(draft))}\n`, "utf8");
    const opened = await readCompositionFile(path);
    const changed = { ...opened.document, title: "Human revision" };
    const saved = await saveCompositionFile(path, opened.revision, changed);
    assert.equal((await readCompositionFile(path)).document.title, "Human revision");
    await assert.rejects(
      saveCompositionFile(path, opened.revision, toComposition(draft)),
      (error: Error & { code?: string; revision?: string }) =>
        error.code === "REVISION_CONFLICT" && error.revision === saved.revision,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("file sessions import old slides but only write canonical pages without intent", async () => {
  const directory = await mkdtemp(join(tmpdir(), "konpeki-session-legacy-"));
  const path = join(directory, "composition.json");
  try {
    const expected = toComposition(initialDraft());
    const { pages, ...rest } = expected;
    const legacy = { ...rest, slides: pages.map(page => ({ ...page,
      components: page.components.map(component => ({ ...component, intent: "Old instruction" })) })) };
    const raw = canonicalJSON(legacy);
    await writeFile(path, raw);
    const opened = await readCompositionFile(path);
    assert.deepEqual(opened.document, expected);
    assert.equal(await readFile(path, "utf8"), raw, "opening is read-only");
    await saveCompositionFile(path, opened.revision, legacy);
    assert.equal(await readFile(path, "utf8"), `${canonicalJSON(expected)}\n`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
