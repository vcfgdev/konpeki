import test from "node:test";
import assert from "node:assert/strict";
import {
  commitHistory,
  createHistory,
  finishHistoryEdit,
  redoHistory,
  undoHistory,
} from "./history.ts";

test("history coalesces one edit gesture and preserves redo", () => {
  let history = createHistory({ value: 1 });
  history = commitHistory(history, { value: 2 }, "drag:item");
  history = commitHistory(history, { value: 3 }, "drag:item");
  history = finishHistoryEdit(history);
  history = commitHistory(history, { value: 4 }, "drag:item");
  assert.equal(history.past.length, 2);
  history = undoHistory(history);
  assert.equal(history.present.value, 3);
  history = undoHistory(history);
  assert.equal(history.present.value, 1);
  history = redoHistory(history);
  assert.equal(history.present.value, 3);
});

test("a new edit clears redo and history is bounded", () => {
  let history = createHistory(0);
  for (let value = 1; value <= 105; value += 1)
    history = commitHistory(history, value);
  assert.equal(history.past.length, 100);
  history = undoHistory(history);
  assert.equal(history.future.length, 1);
  history = commitHistory(history, 200);
  assert.deepEqual(history.future, []);
});
