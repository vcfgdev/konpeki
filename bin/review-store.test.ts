import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { emptyReview } from "../src/lib/review.ts";
import { readReview, reviewFileFor } from "./review-store.ts";

test("legacy feedback is read without changing or creating files", async t => {
  const directory = await mkdtemp(join(tmpdir(), "konpeki-review-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "composition.json");
  assert.deepEqual(await readReview(path), emptyReview());
  assert.deepEqual(await readdir(directory), []);
  const legacy = {
    ...emptyReview(), version: 4,
    notes: [{ id: "old", slideId: "notes", componentId: "notes-ui", elementId: "ui-page-sel", text: "Keep square corners", resolved: false }],
    request: { id: "legacy", status: "working" },
  };
  const raw = `  ${JSON.stringify(legacy)}\n\n`;
  await writeFile(reviewFileFor(path), raw);
  assert.deepEqual(await readReview(path), { schema: legacy.schema, version: 4, notes: legacy.notes });
  assert.equal(await readFile(reviewFileFor(path), "utf8"), raw);
  assert.deepEqual(await readdir(directory), ["composition.json.review.json"]);
});

test("unreadable legacy feedback is reported and its bytes are preserved", async t => {
  const directory = await mkdtemp(join(tmpdir(), "konpeki-review-invalid-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "composition.json");
  for (const raw of ["{broken", "null", JSON.stringify({ ...emptyReview(), notes: [null] }), JSON.stringify({ ...emptyReview(), version: -1 })]) {
    await writeFile(reviewFileFor(path), raw);
    await assert.rejects(readReview(path));
    assert.equal(await readFile(reviewFileFor(path), "utf8"), raw);
  }
});
