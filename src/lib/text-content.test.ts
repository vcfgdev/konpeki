import test from "node:test";
import assert from "node:assert/strict";
import { initialDraft, parseCompositionJSON } from "./model.ts";
import { canonicalJSON, compileHandoff } from "../../composition/compile.ts";
import { validateComposition } from "../../composition/validate.ts";

test("native content is independent of agent instructions and round trips", () => {
  const draft = initialDraft();
  const block = draft.slides[0].components[0];
  assert.equal(block.kind, "text-block");
  if (block.kind !== "text-block") return;
  assert.equal(block.content, "Text");
  block.content = "A real headline\nSecond line <script> is plain text";
  block.intent = "Shorten this without changing meaning";
  block.textStyle = { size: 56, weight: 600, lineHeight: 1.4, font: "heading", color: "accent" };
  const result = parseCompositionJSON(canonicalJSON(draft));
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.document, draft);
  assert.match(compileHandoff(draft), /Intent is separate agent guidance/);
  block.textStyle.size = -2;
  assert.equal(validateComposition(draft).ok, false);
});
