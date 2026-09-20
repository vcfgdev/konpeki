// Original specimen palette. Named palettes build on these color roles.
export const palettes = {
  paper: {
    bg: '#FFFFFF', fg: '#000000', muted: '#3F4A54', line: '#BCC6CE',
    surface: '#EAEFF3', wash: '#E3EAF8', accent: '#2458C7', inverse: '#FFFFFF',
    emphasis: '#98451F', emphasisWash: '#F1E1D4',
  },
  night: {
    bg: '#000000', fg: '#FFFFFF', muted: '#B2C1CC', line: '#4C6072',
    surface: '#202E3C', wash: '#233857', accent: '#97B9FF', inverse: '#000000',
    emphasis: '#F0AC7D', emphasisWash: '#443025',
  },
};
export type Palette = typeof palettes.paper;
