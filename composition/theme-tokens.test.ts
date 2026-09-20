import test from "node:test";
import assert from "node:assert/strict";
import { colorTokens, fontTokens, resolveVectorAttribute, validThemeBinding } from "./theme-tokens.ts";
import { initialDraft, parseCompositionJSON } from "./document.ts";
import { canonicalJSON } from "./compile.ts";
import { validateComposition } from "./validate.ts";
import { parseEditableSvg } from "./vector.ts";

test("theme bindings are explicit and restricted to compatible attributes", () => {
  for (const token of colorTokens) for (const name of ["fill", "stroke", "color"]) {
    assert.ok(validThemeBinding(name, `theme:${token}`));
    assert.equal(resolveVectorAttribute(name, `theme:${token}`), `var(--vector-${token})`);
  }
  for (const token of fontTokens) assert.ok(validThemeBinding("font-family", `theme:${token}`));
  for (const [name, value] of [["x", "theme:ink"], ["fill", "theme:heading-font"], ["font-family", "theme:accent"], ["fill", "theme:unknown"]])
    assert.equal(validThemeBinding(name, value), false);
  assert.equal(resolveVectorAttribute("fill", "#007bbb"), "#007bbb");
  assert.equal(resolveVectorAttribute("x", 12), 12);
});

test("bindings and fixed overrides survive validation and JSON round trips", () => {
  const draft = initialDraft();
  const visual = parseEditableSvg('<svg viewBox="0 0 100 100"><text x="1" y="20" fill="#007bbb">Literal</text></svg>');
  draft.slides[0].components[0].customVisual = { ...visual, format: "vector", description: "Mixed linked and fixed artwork" };
  assert.equal(visual.elements[0].attributes.fill, "#007bbb");
  visual.elements[0].attributes["font-family"] = "theme:heading-font";
  assert.ok(validateComposition(draft).ok);
  const result = parseCompositionJSON(canonicalJSON(draft));
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.document, draft);
  visual.elements[0].attributes.x = "theme:accent";
  assert.equal(validateComposition(draft).ok, false);
  visual.elements[0].attributes.x = 1;
  visual.elements[0].attributes.fill = "theme:unknown";
  assert.equal(validateComposition(draft).ok, false);
});

test("v14 literal artwork migrates without guessing theme roles", () => {
  const draft = initialDraft();
  draft.slides[0].components[0].customVisual = { ...parseEditableSvg('<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#fff"/></svg>'), format: "vector", description: "Legacy fixed artwork" };
  const result = validateComposition({ ...draft, schema: "konpeki-composition/v14" });
  assert.ok(result.ok);
  for (const component of draft.slides[0].components) {
    if (component.kind === "chart" || component.kind === "diagram") component.appearance.selection = "explicit";
  }
  if (result.ok) assert.deepEqual(result.document.slides, draft.slides);
});
