import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { addRevisionNote, readReview, removeRevisionNote, resolveRevisionNote, reviewFileFor } from "./review-store.ts";

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const directory = await mkdtemp(join(tmpdir(), "konpeki-review-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "composition.json");
  await writeFile(path, await readFile(new URL("../slides/introducing-konpeki/composition.json", import.meta.url)));
  return path;
}
const target = { slideId: "notes", componentId: "notes-ui", elementId: "ui-page-sel" };

test("notes retain stable scopes and resolve independently of artwork", async t => {
  const path = await fixture(t);
  const original = await readFile(path, "utf8");
  await addRevisionNote(path, target, "  Use square corners  ");
  await addRevisionNote(path, { slideId: "cover" }, "Keep the headline");
  const notes = (await readReview(path)).notes;
  assert.equal(notes[0].elementId, "ui-page-sel");
  assert.equal(notes[0].text, "Use square corners");
  assert.equal(notes[1].componentId, undefined);
  assert.equal(await readFile(path, "utf8"), original, "Notes must not modify artwork");
  const resolved = await resolveRevisionNote(path, notes[0].id);
  assert.equal(resolved.notes[0].resolved, true);
  assert.equal(resolved.notes[1].resolved, false);
  await assert.rejects(resolveRevisionNote(path, "missing"), /no longer exists/);
  await removeRevisionNote(path, notes[1].id);
  assert.deepEqual((await readReview(path)).notes.map(note => note.id), [notes[0].id]);
});

test("invalid and deleted note targets are rejected without losing notes", async t => {
  const path = await fixture(t);
  await assert.rejects(addRevisionNote(path, { ...target, elementId: "missing" }, "Change this"), /vector element/);
  await assert.rejects(addRevisionNote(path, { slideId: "missing" }, "Change this"), /page/);
  await assert.rejects(addRevisionNote(path, target, " "), /1–4000/);
  const saved = await addRevisionNote(path, target, "Keep square corners");
  assert.equal(saved.notes.length, 1);
  assert.equal((await readReview(path)).notes.length, 1);
});

test("legacy build requests are ignored and dropped by the next atomic note mutation", async t => {
  const path = await fixture(t);
  await writeFile(reviewFileFor(path), JSON.stringify({
    schema: "konpeki-review/v1", version: 4, notes: [],
    request: { schema: "konpeki-build-request/v2", id: "legacy", status: "working" },
  }));
  assert.deepEqual(await readReview(path), { schema: "konpeki-review/v1", version: 4, notes: [] });
  await addRevisionNote(path, { slideId: "cover" }, "Still editable");
  const stored = JSON.parse(await readFile(reviewFileFor(path), "utf8"));
  assert.equal(stored.request, undefined);
  assert.equal(stored.notes[0].text, "Still editable");
});

test("concurrent note mutations are serialized", async t => {
  const path = await fixture(t);
  await Promise.all([addRevisionNote(path, target, "One"), addRevisionNote(path, { slideId: "cover" }, "Two")]);
  const notes = (await readReview(path)).notes;
  await Promise.all([resolveRevisionNote(path, notes[0].id), removeRevisionNote(path, notes[1].id)]);
  const final = await readReview(path);
  assert.equal(final.notes.length, 1);
  assert.equal(final.notes[0].resolved, true);
});
