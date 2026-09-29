import assert from "node:assert/strict";
import { test } from "node:test";
import { layoutPages } from "./page-board.ts";

test("mixed-size pages fit the viewport in a single left-to-right row", () => {
  const sizes = [{ width: 2, height: 1 }, { width: 1, height: 2 }, { width: 1, height: 1 }, { width: 4, height: 1 }, { width: 1, height: 1 }];
  const layout = layoutPages(sizes, 1080, 632);
  assert.deepEqual(layout.pages, [
    { x: 0, y: 32, width: 1080, height: 540 },
    { x: 1160, y: 32, width: 300, height: 600 },
    { x: 1540, y: 32, width: 600, height: 600 },
    { x: 2220, y: 32, width: 1080, height: 270 },
    { x: 3380, y: 32, width: 600, height: 600 },
  ]);
  assert.deepEqual(layout.arrows, [
    "M 1096 302 H 1120 V 332 H 1144",
    "M 1476 332 H 1500 V 332 H 1524",
    "M 2156 332 H 2180 V 167 H 2204",
    "M 3316 167 H 3340 V 332 H 3364",
  ]);
  assert.equal(layout.height, 632);
  assert.equal(layout.width, 3980);
});

test("narrow viewports retain the row; fitted pages have no invisible side gutters", () => {
  const sizes = [{ width: 2, height: 1 }, { width: 1, height: 2 }];
  assert.deepEqual(layoutPages(sizes, 358, 640), {
    width: 742, height: 640,
    pages: [{ x: 0, y: 32, width: 358, height: 179 }, { x: 438, y: 32, width: 304, height: 608 }],
    arrows: ["M 374 121.5 H 398 V 336 H 422"],
  });
  assert.deepEqual(layoutPages(sizes.slice(0, 1), 1600, 932), {
    width: 1600, height: 832, pages: [{ x: 0, y: 32, width: 1600, height: 800 }], arrows: [],
  });
  assert.deepEqual(layoutPages(sizes.slice(0, 1), 1080, 232), {
    width: 400, height: 232, pages: [{ x: 0, y: 32, width: 400, height: 200 }], arrows: [],
  });
  assert.deepEqual(layoutPages([{ width: 1, height: 2 }, { width: 1, height: 2 }], 1600, 932), {
    width: 980, height: 932,
    pages: [{ x: 0, y: 32, width: 450, height: 900 }, { x: 530, y: 32, width: 450, height: 900 }],
    arrows: ["M 466 482 H 490 V 482 H 514"],
  });
  assert.deepEqual(layoutPages([], 400, 600), { width: 400, height: 0, pages: [], arrows: [] });
});
