import {
  initialDraft,
  parseStoredDraft,
  serializeDraft,
  type Draft,
} from "./model.ts";
export const storageKey = "konpeki-composer/v1";
export const exampleStorageKey = (name: string) =>
  `konpeki-composer/examples/v1/${encodeURIComponent(name)}`;
export type LoadedDraft = {
  draft: Draft;
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
    return result.ok
      ? { draft: result.draft, storageBlocked: false }
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
function persistStoredDraft(key: string, draft: Draft) {
  const value = serializeDraft(draft);
  if (!parseStoredDraft(value).ok)
    throw new Error("Invalid draft cannot be saved.");
  localStorage.setItem(key, value);
}
export function loadDraft(): LoadedDraft {
  return loadStoredDraft(
    storageKey,
    initialDraft(true),
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
export function persistDraft(draft: Draft) {
  persistStoredDraft(storageKey, draft);
}
export function persistExampleDraft(name: string, draft: Draft) {
  persistStoredDraft(exampleStorageKey(name), draft);
}
export function clearStoredDraft() {
  localStorage.removeItem(storageKey);
}
export function clearStoredExampleDraft(name: string) {
  localStorage.removeItem(exampleStorageKey(name));
}
