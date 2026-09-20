import {
  initialDraft,
  parseStoredDraft,
  serializeDraft,
  type Draft,
} from "./model.ts";
export const storageKey = "konpeki-composer/v1";
export type LoadedDraft = {
  draft: Draft;
  storageBlocked: boolean;
  error?: string;
};
export function loadDraft(): LoadedDraft {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === null) return { draft: initialDraft(true), storageBlocked: false };
    const result = parseStoredDraft(saved);
    return result.ok
      ? { draft: result.draft, storageBlocked: false }
      : {
          draft: initialDraft(true),
          storageBlocked: true,
          error:
            "Saved data could not be read. It has not been changed. Reset saved draft to recover.",
        };
  } catch {
    return {
      draft: initialDraft(true),
      storageBlocked: true,
      error:
        "Storage is unavailable. You can still export your work; reset to retry saving.",
    };
  }
}
export function persistDraft(draft: Draft) {
  const value = serializeDraft(draft);
  if (!parseStoredDraft(value).ok)
    throw new Error("Invalid draft cannot be saved.");
  localStorage.setItem(storageKey, value);
}
export function clearStoredDraft() {
  localStorage.removeItem(storageKey);
}
