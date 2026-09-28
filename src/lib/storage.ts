import {
  initialGridDraft,
  parseStoredDraft,
  serializeDraft,
  type Draft,
} from "./model.ts";
import { isReviewState, type ReviewState } from "./review.ts";
export const storageKey = "konpeki-composer/v1";
export const exampleStorageKey = (name: string) =>
  `konpeki-composer/examples/v1/${encodeURIComponent(name)}`;
export type LoadedDraft = {
  draft: Draft;
  review?: ReviewState;
  storageBlocked: boolean;
  error?: string;
};
function loadStoredDraft(
  key: string,
  fallback: Draft,
  unreadableMessage: string,
): LoadedDraft {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return { draft: fallback, storageBlocked: false };
    const result = parseStoredDraft(saved);
    const review: unknown = result.ok ? JSON.parse(saved).review : undefined;
    return result.ok && (review === undefined || isReviewState(review))
      ? { draft: result.draft, ...(review === undefined ? {} : { review: review as ReviewState }), storageBlocked: false }
      : {
          draft: fallback,
          storageBlocked: true,
          error: unreadableMessage,
        };
  } catch {
    return {
      draft: fallback,
      storageBlocked: true,
      error:
        "Browser storage is unavailable. You can still download JSON; reset to retry saving.",
    };
  }
}
function persistStoredDraft(key: string, draft: Draft, review?: ReviewState) {
  if (review !== undefined && !isReviewState(review)) throw new Error("Invalid comments cannot be saved.");
  const value = review === undefined ? serializeDraft(draft) : JSON.stringify({ ...JSON.parse(serializeDraft(draft)), review });
  if (!parseStoredDraft(value).ok)
    throw new Error("Invalid draft cannot be saved.");
  localStorage.setItem(key, value);
}
export function loadDraft(): LoadedDraft {
  return loadStoredDraft(
    storageKey,
    initialGridDraft(),
    "Saved data could not be read. It has not been changed. Reset saved draft to recover.",
  );
}
export function loadExampleDraft(name: string, bundled: Draft): LoadedDraft {
  return loadStoredDraft(
    exampleStorageKey(name),
    bundled,
    "This example's saved working copy could not be read. It has not been changed. Reset the example to recover.",
  );
}
export function persistDraft(draft: Draft, review?: ReviewState) {
  persistStoredDraft(storageKey, draft, review);
}
export function persistExampleDraft(name: string, draft: Draft, review?: ReviewState) {
  persistStoredDraft(exampleStorageKey(name), draft, review);
}
export function clearStoredDraft() {
  localStorage.removeItem(storageKey);
}
export function clearStoredExampleDraft(name: string) {
  localStorage.removeItem(exampleStorageKey(name));
}

export const fileReviewStorageKey = (documentKey: string) => `konpeki-comments/v1/${documentKey}`;

export function loadFileReview(documentKey: string, legacy: ReviewState, legacyError?: string) {
  try {
    const saved = localStorage.getItem(fileReviewStorageKey(documentKey));
    // An existing local record, even an empty one, wins over legacy feedback.
    if (saved === null && legacyError) return { review: legacy, storageBlocked: true, error: legacyError };
    const review: unknown = saved === null ? legacy : JSON.parse(saved);
    if (!isReviewState(review)) throw new Error("Invalid saved comments");
    return { review, storageBlocked: false };
  } catch {
    return { review: legacy, storageBlocked: true, error: "Browser comments could not be read. Stored data has not been changed." };
  }
}

export function persistFileReview(documentKey: string, review: ReviewState) {
  if (!isReviewState(review)) throw new Error("Invalid comments cannot be saved.");
  localStorage.setItem(fileReviewStorageKey(documentKey), JSON.stringify(review));
}
