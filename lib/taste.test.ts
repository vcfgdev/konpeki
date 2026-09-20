import assert from 'node:assert/strict';
import { test } from 'node:test';
import { palettes } from './taste.ts';

function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map(channel => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

test('both palettes keep all intended text/background pairs at WCAG AA contrast', () => {
  for (const [name, p] of Object.entries(palettes)) {
    const pairs = [
      [p.fg, p.bg], [p.muted, p.bg], [p.accent, p.bg], [p.emphasis, p.bg],
      [p.fg, p.surface], [p.muted, p.surface], [p.accent, p.wash],
      [p.fg, p.emphasisWash], [p.muted, p.emphasisWash], [p.emphasis, p.emphasisWash],
      [p.inverse, p.accent], [p.bg, p.emphasis],
    ];
    for (const [foreground, background] of pairs) {
      const a = luminance(foreground), b = luminance(background);
      const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      assert(contrast >= 4.5, `${name}: ${foreground} on ${background} = ${contrast.toFixed(2)}:1`);
    }
  }
});
