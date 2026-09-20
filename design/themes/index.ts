import { typography } from '../../lib/taste.ts';
import { paletteNames, resolvePalette, type PaletteName, type PaletteMode } from '../palettes/index.ts';

export const themeNames = paletteNames;
export type ThemeName = PaletteName;
export type ThemeMode = PaletteMode;

// Themes combine typography with a palette; they do not choose a composition.
export function getTheme(name: ThemeName, mode: ThemeMode) {
  const body = name === 'Precision' ? '"Noto Sans", sans-serif' : typography.family;
  const headline = name === 'Editorial' ? '"IBM Plex Serif", serif' : body;
  return { name, body, headline, typography: { ...typography, family: body }, palette: resolvePalette(name, mode) };
}
