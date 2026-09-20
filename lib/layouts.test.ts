import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arrange, contentRegion, layoutKinds, type Region } from './layouts.ts';

function overlaps(a: Region, b: Region) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

test('all eight layouts keep panels and 48-unit relationship glyphs in bounds and separated', () => {
  for (const kind of layoutKinds) {
    const { panels, slots } = arrange(kind);
    assert.equal(panels.length, kind === 'two-columns' || kind === 'main-aside' ? 2 : kind === 'three-columns' ? 3 : 4);
    for (const [i, p] of panels.entries()) {
      assert(p.width > 0 && p.height > 0);
      assert(p.x >= contentRegion.x && p.y >= contentRegion.y);
      assert(p.x + p.width <= 1808.001 && p.y + p.height <= 924.001);
      for (const other of panels.slice(i + 1)) assert(!overlaps(p, other), kind);
    }
    for (const slot of slots) {
      const glyph = { x: slot.x - 24, y: slot.y - 24, width: 48, height: 48 };
      assert(panels.every(p => !overlaps(p, glyph)), `${kind}: clear relationship gutter`);
    }
  }
});

test('1+3 single panel can occupy each edge; main-aside is 2:1', () => {
  for (const kind of ['one-left', 'one-right', 'one-top', 'one-bottom'] as const) {
    const { panels: [single, ...siblings], slots: [slot] } = arrange(kind);
    const horizontal = kind === 'one-left' || kind === 'one-right';
    assert.equal(slot.axis, horizontal ? 'horizontal' : 'vertical');
    for (const sibling of siblings) {
      assert(kind === 'one-left' ? single.x < sibling.x : kind === 'one-right' ? single.x > sibling.x : kind === 'one-top' ? single.y < sibling.y : single.y > sibling.y);
    }
  }
  const { panels } = arrange('main-aside');
  assert.equal(panels[0].width, panels[1].width * 2);
});
