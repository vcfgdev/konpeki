import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import lockfile from "proper-lockfile";
import type { CompositionDocument } from "../composition/types.ts";
import { activeRequest, emptyReview, type BuildRequest, type ReviewState, type ReviewTarget } from "../src/lib/review.ts";
import { readCompositionFile } from "./session-store.ts";

export const reviewFileFor = (path: string) => `${resolve(path)}.review.json`;
const conflict = (message: string) => Object.assign(new Error(message), { code: "REVISION_CONFLICT" });
const invalid = (message: string) => Object.assign(new Error(message), { code: "INVALID_REVIEW" });

export async function readReview(path: string): Promise<ReviewState> {
  try {
    const state = JSON.parse(await readFile(reviewFileFor(path), "utf8"));
    if (state.schema !== "konpeki-review/v1") throw invalid("Unsupported revision-note format.");
    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyReview();
    throw error;
  }
}

// Serialize browser and CLI mutations; publish complete state with an atomic rename.
async function mutate(path: string, change: (state: ReviewState) => Promise<void> | void) {
  const file = reviewFileFor(path);
  const release = await lockfile.lock(file, { realpath: false, retries: { retries: 60, minTimeout: 100, maxTimeout: 250 } });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const state = await readReview(path);
    await change(state);
    state.version++;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`);
    await rename(temporary, file);
    return state;
  } finally {
    await rm(temporary, { force: true });
    await release();
  }
}

function validateTarget(document: CompositionDocument, target: ReviewTarget) {
  const slide = document.slides.find(s => s.id === target.slideId);
  if (!slide) throw invalid("The note's page no longer exists. Remove the note and select a new target.");
  const component = slide.components.find(c => c.id === target.componentId);
  if (target.componentId !== undefined && !component) throw invalid("The note's component no longer exists. Remove the note and select a new target.");
  if (target.elementId !== undefined && !(component?.customVisual?.format === "vector" && component.customVisual.elements.some(e => e.id === target.elementId)))
    throw invalid("The note's vector element no longer exists. Remove the note and select a new target.");
}

export async function addRevisionNote(path: string, target: ReviewTarget, text: string) {
  if (typeof text !== "string" || !text.trim() || text.length > 4000) throw invalid("Write a revision note of 1–4000 characters.");
  return mutate(path, async state => {
    if (activeRequest(state.request)) throw conflict("Wait for the current request before adding notes.");
    validateTarget((await readCompositionFile(path)).document, target);
    state.notes.push({ id: randomUUID(), slideId: target.slideId, ...(target.componentId ? { componentId: target.componentId } : {}), ...(target.elementId ? { elementId: target.elementId } : {}), text: text.trim(), resolved: false });
  });
}

export async function removeRevisionNote(path: string, id: string) {
  return mutate(path, state => {
    if (activeRequest(state.request)) throw conflict("Wait for the current request before removing notes.");
    state.notes = state.notes.filter(note => note.id !== id);
  });
}

export async function writeBuildRequest(path: string, request: ReviewTarget & { revision: string; instruction: string }) {
  return mutate(path, async state => {
    if (activeRequest(state.request)) throw conflict("A build request is already waiting or working.");
    const current = await readCompositionFile(path);
    if (current.revision !== request.revision) throw conflict("Save the latest composition before requesting a build.");
    validateTarget(current.document, request);
    const notes = state.notes.filter(note => !note.resolved);
    for (const note of notes) validateTarget(current.document, note);
    if (typeof request.instruction !== "string" || !request.instruction.trim()) throw invalid("Describe what the agent should build.");
    state.request = {
      schema: "konpeki-build-request/v2", id: randomUUID(), compositionPath: resolve(path),
      revision: current.revision, instruction: request.instruction.trim(), slideId: request.slideId,
      ...(request.componentId ? { componentId: request.componentId } : {}),
      ...(request.elementId ? { elementId: request.elementId } : {}),
      notes, status: "submitted",
    };
  });
}

export async function claimBuildRequest(path: string): Promise<BuildRequest | undefined> {
  if ((await readReview(path)).request?.status !== "submitted") return;
  let claimed: BuildRequest | undefined;
  await mutate(path, state => {
    if (state.request?.status !== "submitted") return;
    state.request.status = "working";
    claimed = state.request;
  });
  return claimed;
}

export async function finishBuildRequest(path: string, id: string, status: string, message?: string) {
  if (!["done", "needs-clarification", "failed"].includes(status)) throw invalid("Status must be done, needs-clarification or failed.");
  if (status !== "done" && !message?.trim()) throw invalid("Explain what failed or needs clarification.");
  return mutate(path, async state => {
    if (state.request?.id !== id || !activeRequest(state.request)) throw conflict("This request is no longer active.");
    if (status === "done" && state.request.status !== "working") throw conflict("Claim the request with konpeki wait before completing it.");
    if (status === "done") {
      state.request.resultRevision = (await readCompositionFile(path)).revision;
      const completed = new Set(state.request.notes.map(note => note.id));
      state.notes = state.notes.map(note => completed.has(note.id) ? { ...note, resolved: true } : note);
    }
    state.request.status = status as BuildRequest["status"];
    state.request.message = message?.trim();
  });
}
