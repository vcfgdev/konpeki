import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contrastRatio } from './contrast.ts';

test('contrast endpoints, channel weights and order', () => {
  assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
  assert.equal(contrastRatio('#abcdef', '#ABCDEF'), 1);
  // Pure channels have exact luminance weights; catches swapped RGB channels.
  assert.ok(Math.abs(contrastRatio('#ff0000', '#000000') - 5.252) < 1e-12);
  assert.ok(Math.abs(contrastRatio('#00ff00', '#000000') - 15.304) < 1e-12);
  assert.ok(Math.abs(contrastRatio('#0000ff', '#000000') - 2.444) < 1e-12);
  assert.equal(contrastRatio('#147e80', '#f6f4ed'), contrastRatio('#f6f4ed', '#147e80'));
});

test('normal-text boundary uses unrounded nonlinear sRGB ratios', () => {
  assert.ok(Math.abs(contrastRatio('#767676', '#ffffff') - 4.542224959605253) < 1e-10);
  const failing = contrastRatio('#777777', '#ffffff');
  assert.ok(Math.abs(failing - 4.478089453577214) < 1e-10);
  assert.ok(failing < 4.5);
  assert.equal(failing.toFixed(1), '4.5'); // Display rounding must not decide a pass.
  // Adjacent channel values on either side of the sRGB transfer breakpoint.
  assert.ok(Math.abs(contrastRatio('#0a0a0a', '#000000') - 1.0607053967097675) < 1e-12);
  assert.ok(Math.abs(contrastRatio('#0b0b0b', '#000000') - 1.0669307152779832) < 1e-12);
});

test('unsupported and malformed colors fail explicitly in either position', () => {
  for (const color of ['#fff', '#ffffff80', 'transparent', 'red', 'rgb(0, 0, 0)', '#gg0000', '#000000\n']) {
    assert.throws(() => contrastRatio(color, '#ffffff'), /opaque six-digit/);
    assert.throws(() => contrastRatio('#ffffff', color), /opaque six-digit/);
  }
});
