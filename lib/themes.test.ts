import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paletteNames as themeNames, resolvePalette as themePalette } from '../design/palettes/index.ts';
import { getTheme } from '../design/themes/index.ts';

function luminance(hex: string) {
  assert.match(hex, /^#[0-9A-F]{6}$/);
  const channels = hex.slice(1).match(/../g)!.map(channel => {
    const n = parseInt(channel, 16) / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test('eight light/dark themes preserve text contrast and dedicated category marks', () => {
  for (const name of themeNames) for (const mode of ['paper', 'night'] as const) {
    const p = themePalette(name, mode);
    const pairs = [[p.bg, p.accent], [p.bg, p.fg], [p.accent, p.wash],
      [p.emphasis, p.bg], [p.emphasis, p.emphasisWash], [p.bg, p.emphasis],
      [p.fg, p.emphasisWash], [p.muted, p.emphasisWash], [p.inverse, p.accent],
      ...[p.bg, p.surface, p.wash].flatMap(bg => [[p.fg, bg], [p.muted, bg]]),
      ...Object.values(p.status).map(color => [color, p.bg])];
    for (const [fg, bg] of pairs) assert(contrast(fg, bg) >= 4.5, `${name}/${mode}: ${fg} on ${bg}`);
    assert.equal(new Set(p.categorical).size, 6);
    for (const color of p.categorical) {
      assert.notEqual(color, p.fg, 'Foreground must not silently become a data series.');
      assert(contrast(color, p.bg) >= 3, `${name}/${mode}: category ${color} against canvas`);
    }
  }
});

test('sequential magnitude darkens on white and lightens on black', () => {
  for (const name of themeNames) for (const mode of ['paper', 'night'] as const) {
    const values = themePalette(name, mode).sequential.map(luminance);
    assert.equal(values.length, 5);
    values.slice(1).forEach((value, i) => assert(mode === 'paper' ? value < values[i] : value > values[i], `${name}/${mode}: ramp reverses`));
    assert.notDeepEqual(themePalette(name, 'paper').categorical, themePalette(name, 'night').categorical);
  }
});

test('resolved themes do not share mutable series arrays or status objects', () => {
  const before = themePalette('Graphite', 'night');
  const changed = themePalette('Graphite', 'night');
  changed.categorical[0] = '#000000';
  changed.sequential[0] = '#FFFFFF';
  changed.status.blocked = '#000000';
  assert.deepEqual(themePalette('Graphite', 'night'), before);
});

test('themes compose font roles with the independent palette resource', () => {
  for (const name of themeNames) {
    const theme = getTheme(name, 'night');
    assert.deepEqual(theme.palette, themePalette(name, 'night'));
    assert.equal(theme.typography.family, theme.body);
    assert(theme.headline.includes(name === 'Editorial' ? 'IBM Plex Serif' : name === 'Precision' ? 'Noto Sans' : 'IBM Plex Sans'));
    assert(theme.body.includes(name === 'Precision' ? 'Noto Sans' : 'IBM Plex Sans'));
  }
});

test('explicit typography overrides legacy pairings without changing colors', () => {
  const fonts = [
    ['plex-sans', '"IBM Plex Sans", sans-serif', '"IBM Plex Sans", sans-serif'],
    ['noto-sans', '"Noto Sans", sans-serif', '"Noto Sans", sans-serif'],
    ['plex-serif', '"IBM Plex Serif", serif', '"IBM Plex Sans", sans-serif'],
    ['hanken-grotesk', '"Hanken Grotesk", sans-serif', '"Hanken Grotesk", sans-serif'],
  ] as const;
  for (const name of themeNames) for (const mode of ['paper', 'night'] as const) {
    for (const [id, headline, body] of fonts) {
      const theme = getTheme(name, mode, id);
      assert.equal(theme.typographyId, id);
      assert.equal(theme.headline, headline);
      assert.equal(theme.body, body);
      assert.equal(theme.typography.family, body);
      assert.deepEqual(theme.palette, themePalette(name, mode));
    }
  }
});
