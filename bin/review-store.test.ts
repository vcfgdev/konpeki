import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readCompositionFile } from "./session-store.ts";
import { addRevisionNote, claimBuildRequest, finishBuildRequest, readReview, removeRevisionNote, writeBuildRequest } from "./review-store.ts";

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const directory = await mkdtemp(join(tmpdir(), "konpeki-review-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "composition.json");
  await writeFile(path, await readFile(new URL("../slides/introducing-konpeki/composition.json", import.meta.url)));
  return path;
}
const target = { slideId: "notes", componentId: "notes-ui", elementId: "ui-page-sel" };

test("notes retain distinct scopes and builds persist until explicitly acknowledged", async t => {
  const path = await fixture(t);
  const original = await readFile(path, "utf8");
  await addRevisionNote(path, target, "  Use square corners  ");
  await addRevisionNote(path, { slideId: "cover" }, "Keep the headline");
  const notes = (await readReview(path)).notes;
  assert.equal(notes[0].elementId, "ui-page-sel");
  assert.equal(notes[0].text, "Use square corners");
  assert.equal(notes[1].componentId, undefined);
  assert.equal(await readFile(path, "utf8"), original, "Notes must not modify artwork");
  const revision = (await readCompositionFile(path)).revision;
  const submitted = await writeBuildRequest(path, { ...target, revision, instruction: " Apply notes " });
  const request = submitted.request!;
  assert.equal(request.schema, "konpeki-build-request/v2");
  assert.equal(request.instruction, "Apply notes");
  assert.equal(request.revision, revision);
  assert.deepEqual(request.notes, notes);
  assert.equal(request.status, "submitted");
  await assert.rejects(finishBuildRequest(path, request.id, "done"), /Claim the request/);
  const claims = await Promise.all([claimBuildRequest(path), claimBuildRequest(path)]);
  assert.equal(claims.filter(Boolean).length, 1, "Only one waiter may claim a request");
  assert.equal((await readReview(path)).request?.status, "working");
  await assert.rejects(addRevisionNote(path, target, "Another note"), /current request/);
  await assert.rejects(removeRevisionNote(path, notes[0].id), /current request/);
  const document = (await readCompositionFile(path)).document;
  document.title = "Unrelated external change";
  await writeFile(path, JSON.stringify(document));
  assert.equal((await readReview(path)).request?.status, "working");
  assert.equal((await readReview(path)).notes[0].resolved, false);
  await assert.rejects(finishBuildRequest(path, "wrong-id", "done"), /no longer active/);
  const completed = await finishBuildRequest(path, request.id, "done", "Checked the result");
  assert.ok(completed.notes.every(note => note.resolved));
  assert.equal(completed.request?.resultRevision, (await readCompositionFile(path)).revision);
  assert.equal(await claimBuildRequest(path), undefined);
  await assert.rejects(finishBuildRequest(path, request.id, "done"), /no longer active/);
});

test("stale revisions and deleted targets are rejected without losing notes", async t => {
  const path = await fixture(t);
  await assert.rejects(addRevisionNote(path, { ...target, elementId: "missing" }, "Change this"), /vector element/);
  await assert.rejects(addRevisionNote(path, { slideId: "missing" }, "Change this"), /page/);
  await assert.rejects(addRevisionNote(path, target, " "), /1–4000/);
  const saved = await addRevisionNote(path, target, "Keep square corners");
  const opened = await readCompositionFile(path);
  const diagram = opened.document.slides.find(s => s.id === target.slideId)!.components.find(c => c.id === target.componentId)!;
  if (diagram.customVisual?.format !== "vector") throw Error("Missing fixture vectors");
  diagram.customVisual.elements = diagram.customVisual.elements.filter(e => e.id !== target.elementId);
  await writeFile(path, JSON.stringify(opened.document));
  await assert.rejects(writeBuildRequest(path, { ...target, revision: opened.revision, instruction: "Build" }), /latest composition/);
  const revision = (await readCompositionFile(path)).revision;
  await assert.rejects(writeBuildRequest(path, { slideId: "notes", revision, instruction: "Build" }), /vector element/);
  assert.equal((await readReview(path)).notes.length, 1);
  await removeRevisionNote(path, saved.notes[0].id);
  assert.equal((await readReview(path)).notes.length, 0);
});

test("failed and clarification requests retain notes; retries exclude resolved notes", async t => {
  const path = await fixture(t);
  const revision = (await readCompositionFile(path)).revision;
  await addRevisionNote(path, target, "First note");
  const first = (await writeBuildRequest(path, { ...target, revision, instruction: "Build" })).request!;
  await assert.rejects(writeBuildRequest(path, { ...target, revision, instruction: "Duplicate" }), /already waiting/);
  await assert.rejects(finishBuildRequest(path, first.id, "failed"), /Explain/);
  await finishBuildRequest(path, first.id, "needs-clarification", "Which corners?");
  assert.equal((await readReview(path)).notes[0].resolved, false);
  const second = (await writeBuildRequest(path, { ...target, revision, instruction: "Build" })).request!;
  await assert.rejects(finishBuildRequest(path, first.id, "done"), /no longer active/);
  await claimBuildRequest(path);
  await finishBuildRequest(path, second.id, "done"); // No-op completion is valid, with explicit acknowledgement.
  await addRevisionNote(path, { slideId: "cover" }, "New note");
  const third = (await writeBuildRequest(path, { ...target, revision, instruction: "Build" })).request!;
  assert.deepEqual(third.notes.map(n => n.text), ["New note"]);
  await finishBuildRequest(path, third.id, "failed", "Cancelled");
  assert.equal((await readReview(path)).notes[1].resolved, false);
});

test("concurrent note additions do not overwrite each other", async t => {
  const path = await fixture(t);
  await Promise.all([addRevisionNote(path, target, "One"), addRevisionNote(path, { slideId: "cover" }, "Two")]);
  assert.deepEqual((await readReview(path)).notes.map(n => n.text).sort(), ["One", "Two"]);
});
