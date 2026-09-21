import test from "node:test";
import assert from "node:assert/strict";
import { moveVectorElement, parseEditableSvg, removeVectorElement } from "./vector.ts";
import { validateComposition } from "./validate.ts";
import {
  initialDraft,
  parseCompositionJSON,
  parseStoredDraft,
  serializeDraft,
} from "./document.ts";
import { commitHistory, createHistory, redoHistory, undoHistory } from "../src/lib/history.ts";

const source = `<svg viewBox="0 0 800 400">
  <g id="group" transform="translate(10 20)">
    <rect id="box" width="200" height="100" fill="#007bbb"/>
    <text id="label" x="20" y="50">Before <tspan id="bold" font-weight="700" dx="2">bold</tspan> after</text>
  </g>
  <path id="path" d="M0 0L100 100" stroke="#123456"/>
</svg>`;

test("SVG conversion preserves mixed text order, spacing, nested geometry and stable IDs", () => {
  const parsed = parseEditableSvg(source);
  assert.deepEqual(parsed, parseEditableSvg(source));
  const label = parsed.elements.find((element) => element.id === "label")!;
  assert.equal(label.text, undefined);
  assert.deepEqual(parsed.elements.filter((element) => element.parentId === "label").map((element) => element.text), ["Before ", "bold", " after"]);
  assert.equal(parsed.elements.find((element) => element.id === "bold")!.attributes.dx, "2");
  assert.equal(parsed.elements[0].text, undefined);
  assert.equal(parsed.elements.at(-1)!.attributes.d, "M0 0L100 100");
  const duplicate = parseEditableSvg('<svg viewBox="0 0 10 10"><g id="same"><rect id="same"/></g></svg>');
  assert.deepEqual(duplicate.elements.map((element) => element.id), ["same", "same-2"]);
});

test("vector edits, sibling subtree ordering and deletion survive history and both JSON round trips", () => {
  const draft = initialDraft();
  const visual = { format: "vector" as const, ...parseEditableSvg(source), description: "Editable artwork" };
  draft.slides[0].components[0].customVisual = visual;
  const original = structuredClone(draft);
  let history = createHistory(draft);
  const edited = structuredClone(draft);
  const elements = moveVectorElement(structuredClone(visual.elements), "group", 1);
  assert.equal(elements[0].id, "path");
  assert.equal(elements[1].id, "group");
  assert.equal(moveVectorElement(elements, "group", 1), elements);
  elements.find((element) => element.id === "bold")!.text = "revised";
  elements.find((element) => element.id === "path")!.attributes.d = "M10 10L90 90";
  edited.slides[0].components[0].customVisual = { ...visual, elements };
  history = commitHistory(history, edited);
  assert.equal(validateComposition(edited).ok, true);
  assert.deepEqual(parseStoredDraft(serializeDraft(edited)), { ok: true, draft: edited });
  const imported = parseCompositionJSON(JSON.stringify(edited));
  assert.equal(imported.ok, true);
  if (imported.ok) assert.deepEqual(imported.document, edited);
  assert.deepEqual(undoHistory(history).present, original);
  assert.deepEqual(redoHistory(undoHistory(history)).present, edited);
  // Deleting a group removes its text descendants but not its peer path.
  assert.deepEqual(removeVectorElement(elements, "group").map((element) => element.id), ["path"]);
  edited.slides[0].components[0].customVisual = { ...visual, elements: [] };
  assert.equal(validateComposition(edited).ok, true, "last-element deletion leaves a valid blank interior");
  assert.deepEqual(draft, original, "editing does not mutate the previous document");
});

test("invisible invalid SVG hierarchies and executable content are rejected", () => {
  for (const elements of [
    [{ id: "rect", kind: "rect", attributes: {} }, { id: "child", kind: "text", parentId: "rect", attributes: {}, text: "invisible" }],
    [{ id: "orphan", kind: "tspan", attributes: {}, text: "invisible" }],
    [{ id: "shape", kind: "path", attributes: { fill: "url(https://example.com/a.svg)" } }],
  ]) {
    const draft = initialDraft();
    const candidate = JSON.parse(JSON.stringify(draft));
    candidate.slides[0].components[0].customVisual = { format: "vector", elements, viewBox: { x: 0, y: 0, width: 100, height: 100 }, description: "Invalid" };
    assert.equal(validateComposition(candidate).ok, false);
  }
  assert.throws(() => parseEditableSvg('<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>'), /Unsupported/);
  const inert = parseEditableSvg('<svg viewBox="0 0 10 10"><rect onclick="alert(1)" width="10"/></svg>');
  assert.deepEqual(inert.elements[0].attributes, { width: "10" });
});
