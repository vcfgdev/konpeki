import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { emptyReview, isReviewState, type ReviewState } from "../src/lib/review.ts";

export const reviewFileFor = (path: string) => `${resolve(path)}.review.json`;

// Read-only migration support. New comments live in browser storage, never here.
export async function readReview(path: string): Promise<ReviewState> {
  try {
    const state = JSON.parse(await readFile(reviewFileFor(path), "utf8"));
    if (!isReviewState(state)) throw Object.assign(new Error("Unsupported or invalid legacy comments."), { code: "INVALID_REVIEW" });
    // Ignore old agent protocol fields without modifying the user's file.
    return { schema: state.schema, version: state.version, notes: state.notes };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyReview();
    throw error;
  }
}
