import test from "node:test";
import assert from "node:assert/strict";
import { initialDraft, parseCompositionJSON } from "./model.ts";
import { canonicalJSON, compileHandoff } from "../../composition/compile.ts";
import { validateComposition } from "../../composition/validate.ts";
import { resolveDocument, toComposition } from "../../composition/grid.ts";

test("native content and explicit typography round trip without an intent field", () => {
  const draft = initialDraft();
  const block = draft.pages[0].components[0];
  assert.equal(block.kind, "text-block");
  if (block.kind !== "text-block") return;
  assert.equal(block.content, "Text");
  block.content = "A real headline\nSecond line <script> is plain text";
  block.textStyle = { ...block.textStyle, step: "title", weight: 600, font: "heading", color: "accent" };
  const result = parseCompositionJSON(canonicalJSON(toComposition(draft)));
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.document, resolveDocument(toComposition(draft)));
  assert.doesNotMatch(compileHandoff(draft), /"intent"\s*:/);
  block.textStyle.leading = -2;
  assert.equal(validateComposition(toComposition(draft)).ok, false);
});
