import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import lockfile from "proper-lockfile";
import type { WireDocument as CompositionDocument } from "../composition/grid.ts";
import { emptyReview, type ReviewState, type ReviewTarget } from "../src/lib/review.ts";
import { readCompositionFile } from "./session-store.ts";

export const reviewFileFor = (path: string) => `${resolve(path)}.review.json`;
const invalid = (message: string) => Object.assign(new Error(message), { code: "INVALID_REVIEW" });

export async function readReview(path: string): Promise<ReviewState> {
  try {
    const state = JSON.parse(await readFile(reviewFileFor(path), "utf8"));
    if (state.schema !== "konpeki-review/v1") throw invalid("Unsupported revision-note format.");
    // Build requests were stored in this sidecar by older releases. Deliberately
    // project only the durable note state so legacy protocol data is ignored.
    return { schema: state.schema, version: state.version, notes: state.notes };
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
    validateTarget((await readCompositionFile(path)).document, target);
    state.notes.push({ id: randomUUID(), slideId: target.slideId, ...(target.componentId ? { componentId: target.componentId } : {}), ...(target.elementId ? { elementId: target.elementId } : {}), text: text.trim(), resolved: false });
  });
}

export async function removeRevisionNote(path: string, id: string) {
  return mutate(path, state => {
    state.notes = state.notes.filter(note => note.id !== id);
  });
}

export async function resolveRevisionNote(path: string, id: string) {
  return mutate(path, state => {
    const note = state.notes.find(candidate => candidate.id === id);
    if (!note) throw invalid("The revision note no longer exists.");
    note.resolved = true;
  });
}
