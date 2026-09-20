import test from "node:test";
import assert from "node:assert/strict";
import { presentationAction } from "./presentation.ts";

test("presentation navigation advances and clamps at deck boundaries", () => {
  assert.equal(presentationAction("ArrowRight", 0, 3), 1);
  assert.equal(presentationAction(" ", 1, 3), 2);
  assert.equal(presentationAction("PageDown", 2, 3), 2);
  assert.equal(presentationAction("ArrowLeft", 0, 3), 0);
  assert.equal(presentationAction("Home", 2, 3), 0);
  assert.equal(presentationAction("End", 0, 3), 2);
});

test("presentation navigation distinguishes exit and unrelated keys", () => {
  assert.equal(presentationAction("Escape", 1, 3), "exit");
  assert.equal(presentationAction("Enter", 1, 3), undefined);
  assert.equal(presentationAction(" ", 1, 3, true), undefined);
});
