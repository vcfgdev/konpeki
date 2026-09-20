import { typography, type Palette } from './taste.ts';

// Shared presentation defaults for Nivo SVG components, not a chart wrapper.
// Decks still own data, dimensions, scales, labels and semantic color assignments.
export function chartDefaults(p: Palette) {
  return {
    animate: false,
    isInteractive: false,
    renderWrapper: false,
    colors: [p.accent, p.emphasis],
    theme: {
      text: { fontFamily: typography.family, fontSize: typography.caption, fill: p.fg },
      axis: { ticks: { text: { fill: p.fg, fontSize: typography.caption } }, domain: { line: { stroke: p.line } } },
      grid: { line: { stroke: p.line, strokeWidth: 1 } },
      labels: { text: { fontSize: typography.caption, fill: p.fg } },
    },
  };
}
