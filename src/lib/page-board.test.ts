import assert from "node:assert/strict";
import { test } from "node:test";
import { layoutPages } from "./page-board.ts";

test("mixed-size pages fit the viewport in a single left-to-right row", () => {
  const sizes = [{ width: 2, height: 1 }, { width: 1, height: 2 }, { width: 1, height: 1 }, { width: 4, height: 1 }, { width: 1, height: 1 }];
  const layout = layoutPages(sizes, 1080, 632);
  assert.deepEqual(layout.pages, [
    { x: 0, y: 32, width: 1080, height: 540 },
    { x: 1550, y: 32, width: 300, height: 600 },
    { x: 2560, y: 32, width: 600, height: 600 },
    { x: 3480, y: 32, width: 1080, height: 270 },
    { x: 4880, y: 32, width: 600, height: 600 },
  ]);
  assert.deepEqual(layout.arrows, [
    "M 1096 302 H 1315 V 332 H 1534",
    "M 1866 332 H 2205 V 332 H 2544",
    "M 3176 332 H 3320 V 167 H 3464",
    "M 4576 167 H 4720 V 332 H 4864",
  ]);
  assert.equal(layout.height, 632);
  assert.equal(layout.width, 5720);
});

test("narrow viewports retain the row; single pages use the full available space", () => {
  const sizes = [{ width: 2, height: 1 }, { width: 1, height: 2 }];
  assert.deepEqual(layoutPages(sizes, 358, 640), {
    width: 796, height: 640,
    pages: [{ x: 0, y: 32, width: 358, height: 179 }, { x: 465, y: 32, width: 304, height: 608 }],
    arrows: ["M 374 121.5 H 411.5 V 336 H 449"],
  });
  assert.deepEqual(layoutPages(sizes.slice(0, 1), 1600, 932), {
    width: 1600, height: 832, pages: [{ x: 0, y: 32, width: 1600, height: 800 }], arrows: [],
  });
  assert.deepEqual(layoutPages(sizes.slice(0, 1), 1080, 232), {
    width: 1080, height: 232, pages: [{ x: 340, y: 32, width: 400, height: 200 }], arrows: [],
  });
  assert.deepEqual(layoutPages([], 400, 600), { width: 400, height: 0, pages: [], arrows: [] });
});
