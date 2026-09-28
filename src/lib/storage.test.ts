import test from "node:test";
import assert from "node:assert/strict";
import { initialDraft } from "./model.ts";
import { emptyReview } from "./review.ts";
import {
  clearStoredExampleDraft,
  exampleStorageKey,
  fileReviewStorageKey,
  loadDraft,
  loadExampleDraft,
  loadFileReview,
  persistDraft,
  persistExampleDraft,
  persistFileReview,
  storageKey,
} from "./storage.ts";

function withStorage(
  entries: [string, string][],
  run: (data: Map<string, string>) => void,
) {
  const data = new Map(entries);
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    },
  });
  try {
    run(data);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
}

test("an example working copy survives reload", () => {
  withStorage([], () => {
    const bundled = initialDraft();
    bundled.title = "Bundled example";
    const edited = structuredClone(bundled);
    edited.title = "Browser edit";
    persistExampleDraft("introducing-konpeki", edited);
    assert.deepEqual(
      loadExampleDraft("introducing-konpeki", bundled),
      { draft: edited, storageBlocked: false },
    );
  });
});

test("comments persist with their document but never enter artwork JSON", () => {
  withStorage([], data => {
    const draft = initialDraft();
    const review = { ...emptyReview(), version: 3, notes: [
      { id: "page-comment", slideId: draft.slides[0].id, text: "Explain the failure case", resolved: false },
      { id: "old-target", slideId: "deleted-page", componentId: "old-component", text: "Keep this context", resolved: true },
    ] };
    persistExampleDraft("first", draft, review);
    persistExampleDraft("second", draft, emptyReview());
    persistDraft(draft, review);
    assert.deepEqual(loadExampleDraft("first", initialDraft()), { draft, review, storageBlocked: false });
    assert.deepEqual(loadDraft().review, review);
    assert.deepEqual(loadExampleDraft("second", initialDraft()).review, emptyReview());
    const raw = JSON.parse(data.get(exampleStorageKey("first"))!);
    assert.equal(JSON.stringify(raw.document).includes("Explain the failure case"), false);
    clearStoredExampleDraft("first");
    assert.equal(loadExampleDraft("first", draft).review, undefined);
    assert.deepEqual(loadDraft().review, review);
  });
});

test("malformed saved comments block autosave without replacing stored bytes", () => {
  withStorage([], data => {
    const draft = initialDraft();
    persistDraft(draft, emptyReview());
    const saved = JSON.parse(data.get(storageKey)!);
    for (const review of [null, { ...emptyReview(), version: -1 }, { ...emptyReview(), notes: [null] },
      { ...emptyReview(), notes: [{ id: "note", slideId: "slide-1", text: "Keep", resolved: "no" }] }]) {
      const raw = JSON.stringify({ ...saved, review });
      data.set(storageKey, raw);
      assert.equal(loadDraft().storageBlocked, true);
      assert.equal(data.get(storageKey), raw);
    }
  });
});

test("file comments import legacy feedback once, isolate documents, and never resurrect removed notes", () => {
  withStorage([], data => {
    const legacy = { ...emptyReview(), version: 9, notes: [{ id: "old", slideId: "cover", text: "Keep this", resolved: false }] };
    assert.deepEqual(loadFileReview("first", legacy), { review: legacy, storageBlocked: false });
    persistFileReview("first", legacy);
    persistFileReview("second", emptyReview());
    assert.deepEqual(loadFileReview("first", emptyReview()).review, legacy);
    assert.deepEqual(loadFileReview("second", legacy).review, emptyReview());
    persistFileReview("first", { ...emptyReview(), version: 10 });
    assert.deepEqual(loadFileReview("first", legacy).review.notes, []);
    assert.equal(data.has(storageKey), false, "file comments must not replace the standalone composition");
  });
});

test("corrupt file comments block writes instead of being silently replaced by legacy state", () => {
  withStorage([], data => {
    for (const raw of ["{broken", "null", JSON.stringify({ ...emptyReview(), notes: [null] })]) {
      data.set(fileReviewStorageKey("first"), raw);
      assert.equal(loadFileReview("first", emptyReview()).storageBlocked, true);
      assert.equal(data.get(fileReviewStorageKey("first")), raw);
    }
  });
});

test("legacy import errors do not block existing browser comments or mark a failed import complete", () => {
  withStorage([], data => {
    const error = "Legacy comments could not be imported.";
    assert.deepEqual(loadFileReview("first", emptyReview(), error), { review: emptyReview(), storageBlocked: true, error });
    assert.equal(data.has(fileReviewStorageKey("first")), false);
    const saved = { ...emptyReview(), notes: [{ id: "local", slideId: "cover", text: "Keep local feedback", resolved: false }] };
    for (const review of [saved, emptyReview()]) {
      persistFileReview("first", review);
      assert.deepEqual(loadFileReview("first", emptyReview(), error), { review, storageBlocked: false });
    }
  });
});

test("ordinary drafts and each example use isolated storage", () => {
  withStorage([], (data) => {
    const ordinary = initialDraft();
    ordinary.title = "Ordinary";
    const introduction = initialDraft();
    introduction.title = "Introduction";
    const migration = initialDraft();
    migration.title = "Migration";
    persistDraft(ordinary);
    persistExampleDraft("introducing-konpeki", introduction);
    persistExampleDraft("react-page-migration", migration);
    assert.equal(loadDraft().draft.title, "Ordinary");
    assert.equal(
      loadExampleDraft("introducing-konpeki", initialDraft()).draft.title,
      "Introduction",
    );
    assert.equal(
      loadExampleDraft("react-page-migration", initialDraft()).draft.title,
      "Migration",
    );
    assert.equal(data.size, 3);
    assert.ok(data.has(storageKey));
  });
});

test("reset clears only the selected example working copy", () => {
  withStorage([], (data) => {
    const draft = initialDraft();
    persistDraft(draft);
    persistExampleDraft("introducing-konpeki", draft);
    persistExampleDraft("custom-visual", draft);
    clearStoredExampleDraft("introducing-konpeki");
    assert.equal(data.has(exampleStorageKey("introducing-konpeki")), false);
    assert.equal(data.has(exampleStorageKey("custom-visual")), true);
    assert.equal(data.has(storageKey), true);
  });
});

test("corrupt and unavailable example storage falls back without overwriting data", () => {
  const key = exampleStorageKey("introducing-konpeki");
  withStorage([[key, "{broken"]], (data) => {
    const bundled = initialDraft();
    bundled.title = "Safe fallback";
    const loaded = loadExampleDraft("introducing-konpeki", bundled);
    assert.equal(loaded.storageBlocked, true);
    assert.equal(loaded.draft.title, "Safe fallback");
    assert.equal(data.get(key), "{broken");
  });

  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => { throw new Error("blocked"); } },
  });
  try {
    const bundled = initialDraft();
    assert.deepEqual(loadExampleDraft("introducing-konpeki", bundled), {
      draft: bundled,
      storageBlocked: true,
      error:
        "Browser storage is unavailable. You can still download JSON; reset to retry saving.",
    });
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
