// WCAG relative luminance for opaque, six-digit sRGB hex colors only.
// Callers must establish the actual rendered pair; this does not inspect a DOM.
export function contrastRatio(foreground: string, background: string): number {
  const luminance = (color: string) => {
    if (!/^#[0-9a-f]{6}$/i.test(color)) {
      throw new Error('Contrast requires opaque six-digit sRGB hex colors (#RRGGBB).');
    }
    const channels = [1, 3, 5].map(offset => {
      const value = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const fg = luminance(foreground), bg = luminance(background);
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}
