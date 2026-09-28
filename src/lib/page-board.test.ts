import assert from "node:assert/strict";
import { test } from "node:test";
import { layoutPages } from "./page-board.ts";

test("mixed-size pages snake through rows without overlapping; arrows connect document order", () => {
  const sizes = [{ width: 2, height: 1 }, { width: 1, height: 2 }, { width: 1, height: 1 }, { width: 4, height: 1 }, { width: 1, height: 1 }];
  const layout = layoutPages(sizes, 1080);
  assert.deepEqual(layout.pages, [
    { x: 0, y: 32, width: 500, height: 250 },
    { x: 580, y: 32, width: 500, height: 1000 },
    { x: 580, y: 1144, width: 500, height: 500 },
    { x: 0, y: 1144, width: 500, height: 125 },
    { x: 0, y: 1756, width: 500, height: 500 },
  ]);
  assert.deepEqual(layout.arrows, [
    "M 516 157 H 540 V 532 H 564",
    "M 830 1048 V 1096",
    "M 564 1394 H 540 V 1206.5 H 516",
    "M 250 1285 V 1708",
  ]);
  assert.equal(layout.height, 2256);
});

test("breakpoint, single page and empty board", () => {
  const sizes = [{ width: 2, height: 1 }, { width: 1, height: 2 }];
  const narrow = layoutPages(sizes, 899);
  assert.deepEqual(narrow.pages.map(({ x, y }) => [x, y]), [[0, 32], [0, 593.5]]);
  assert.deepEqual(narrow.arrows, ["M 449.5 497.5 V 545.5"]);
  assert.equal(layoutPages(sizes, 900).pages[1].x, 490);
  assert.deepEqual(layoutPages(sizes.slice(0, 1), 1600), {
    width: 1440, height: 512, pages: [{ x: 240, y: 32, width: 960, height: 480 }], arrows: [],
  });
  assert.deepEqual(layoutPages([], 400), { width: 400, height: 0, pages: [], arrows: [] });
});
