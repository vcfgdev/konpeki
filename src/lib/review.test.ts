import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveDocument } from "../../composition/grid.ts";
import { assertComposition } from "../../composition/validate.ts";
import { emptyReview, reviewPrompt } from "./review.ts";

const document = resolveDocument(assertComposition(JSON.parse(readFileSync(new URL("../../slides/introducing-konpeki/composition.json", import.meta.url), "utf8"))));

test("copy prompt preserves requests and scoped IDs, includes every pending note and never resolves them", () => {
  const review = { ...emptyReview(), notes: [
    { id: "done", slideId: "cover", text: "Already addressed", resolved: true },
    { id: "page", slideId: "cover", text: "Keep the title.\nExplain the tradeoff → clearly.", resolved: false },
    { id: "vector", slideId: "notes", componentId: "notes-ui", elementId: "ui-page-sel", text: "Remove this outline, not the component.", resolved: false },
  ] };
  const before = structuredClone(review);
  const prompt = reviewPrompt(document, review, "composition.json");
  assert.ok(prompt.includes(`composition ${JSON.stringify(document.title)}`));
  assert.ok(prompt.includes('Source file: "composition.json"'));
  assert.ok(prompt.includes('1. Page: "cover"'));
  assert.ok(prompt.includes('2. Page: "notes"'));
  assert.ok(prompt.includes('Component: "notes-ui"\nVector element: "ui-page-sel"\nComment:\nRemove this outline, not the component.'));
  assert.ok(prompt.includes("Comment:\nKeep the title.\nExplain the tradeoff → clearly."));
  assert.doesNotMatch(prompt, /Already addressed|\[missing\]/);
  assert.match(prompt, /Reread the current source first.*Preserve unrelated human edits/);
  assert.deepEqual(review, before);
  assert.match(reviewPrompt(document, review), /latest composition JSON shared in this conversation; ask for it if unavailable/);
});

test("prompt marks missing pages, components and vector elements instead of matching IDs from another page", () => {
  const review = { ...emptyReview(), notes: [
    { id: "page", slideId: "gone", text: "Recover this page", resolved: false },
    { id: "component", slideId: "cover", componentId: "notes-ui", text: "Wrong page", resolved: false },
    { id: "element", slideId: "notes", componentId: "notes-ui", elementId: "gone", text: "Missing vector", resolved: false },
  ] };
  const prompt = reviewPrompt(document, review);
  assert.ok(prompt.includes('1. Page: "gone" [missing]\nComment:\nRecover this page'));
  assert.ok(prompt.includes('Component: "notes-ui" [missing]\nComment:\nWrong page'));
  assert.ok(prompt.includes('Component: "notes-ui"\nVector element: "gone" [missing]\nComment:\nMissing vector'));
  assert.match(prompt, /If a target is missing or ambiguous, ask rather than guessing/);
});
