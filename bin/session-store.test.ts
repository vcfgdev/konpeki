import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJSON } from "../composition/compile.ts";
import { initialDraft } from "../composition/document.ts";
import {
  readCompositionFile,
  requestFileFor,
  saveCompositionFile,
  writeBuildRequest,
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

test("build requests bind the instruction and selection to the saved revision", async () => {
  const directory = await mkdtemp(join(tmpdir(), "konpeki-request-test-"));
  const path = join(directory, "composition.json");
  const draft = initialDraft(true);
  const requestPath = requestFileFor(path);
  try {
    await writeFile(path, `${canonicalJSON(draft)}\n`, "utf8");
    const opened = await readCompositionFile(path);
    await writeBuildRequest(path, {
      revision: opened.revision,
      instruction: "  Add implementation detail.  ",
      slideId: draft.slides[0].id,
      componentId: "diagram-1",
    });
    const request = JSON.parse(await readFile(requestPath, "utf8"));
    assert.deepEqual(
      {
        schema: request.schema,
        revision: request.revision,
        instruction: request.instruction,
        slideId: request.slideId,
        componentId: request.componentId,
      },
      {
        schema: "konpeki-build-request/v1",
        revision: opened.revision,
        instruction: "Add implementation detail.",
        slideId: draft.slides[0].id,
        componentId: "diagram-1",
      },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(requestPath, { force: true });
  }
});
