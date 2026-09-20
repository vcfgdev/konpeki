// Three independent choices: typography, surface/style, and relationship geometry.
// Layouts consume these roles; colors are never assigned by item index.
export const typography = {
  family: '"IBM Plex Sans", sans-serif',
  display: 72,
  heading: 40,
  body: 32,
  caption: 24,
  meta: 20,
  leading: 1.3,
};

export const cornerRadii = { square: 0, soft: 16 };
export const layout = { inset: 112, contentWidth: 1696, gap: 32, stroke: 4, radius: cornerRadii.soft };

// Existing runtime consumers retain their imports; color definitions live in design/.
export { palettes, type Palette } from '../design/palettes/base.ts';
