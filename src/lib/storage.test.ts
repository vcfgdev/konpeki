import test from "node:test";
import assert from "node:assert/strict";
import { initialDraft } from "./model.ts";
import {
  clearStoredExampleDraft,
  exampleStorageKey,
  loadDraft,
  loadExampleDraft,
  persistDraft,
  persistExampleDraft,
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
