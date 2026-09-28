import assert from "node:assert/strict";
import { test } from "node:test";
import { reviewPosition } from "./review-position.ts";

const panel = { width: 360, height: 176 };
const viewport = { x: 0, y: 0, width: 1000, height: 800 };

test("composer prefers below, flips above at the bottom, and clamps the right edge", () => {
  assert.deepEqual(reviewPosition({ x: 100, y: 200, width: 240, height: 40 }, panel, viewport), { left: 100, top: 252 });
  assert.deepEqual(reviewPosition({ x: 720, y: 660, width: 180, height: 32 }, panel, viewport), { left: 624, top: 472 });
  // Exact lower boundary fits; one extra pixel must flip above.
  assert.equal(reviewPosition({ x: 100, y: 564, width: 240, height: 32 }, panel, viewport).top, 608);
  assert.equal(reviewPosition({ x: 100, y: 565, width: 240, height: 32 }, panel, viewport).top, 377);
});

test("tall targets use the available side without covering the target", () => {
  assert.deepEqual(reviewPosition({ x: 60, y: 60, width: 420, height: 680 }, panel, viewport), { left: 492, top: 60 });
  assert.deepEqual(reviewPosition({ x: 480, y: 40, width: 480, height: 720 }, panel, viewport), { left: 108, top: 40 });
});

test("oversized or offscreen targets keep the composer inside narrow or shifted viewports", () => {
  assert.deepEqual(reviewPosition({ x: -20, y: -30, width: 900, height: 780 }, { width: 288, height: 200 }, { x: 0, y: 0, width: 320, height: 500 }), { left: 16, top: 284 });
  assert.deepEqual(reviewPosition({ x: 100, y: 140, width: 60, height: 40 }, { width: 358, height: 220 }, { x: 25, y: 90, width: 390, height: 560 }), { left: 41, top: 192 });
});
