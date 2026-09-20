import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJSON } from "../composition/compile.ts";
import { initialDraft } from "../composition/document.ts";
import {
  readCompositionFile,
  saveCompositionFile,
} from "./session-store.ts";

test("file sessions save atomically and reject stale revisions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "konpeki-session-test-"));
  const path = join(directory, "composition.json");
  try {
    const draft = initialDraft(true);
    await writeFile(path, `${canonicalJSON(draft)}\n`, "utf8");
    const opened = await readCompositionFile(path);
    const changed = { ...opened.document, title: "Human revision" };
    const saved = await saveCompositionFile(path, opened.revision, changed);
    assert.equal((await readCompositionFile(path)).document.title, "Human revision");
    await assert.rejects(
      saveCompositionFile(path, opened.revision, draft),
      (error: Error & { code?: string; revision?: string }) =>
        error.code === "REVISION_CONFLICT" && error.revision === saved.revision,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
