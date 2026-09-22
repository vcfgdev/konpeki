import { typography } from '../../lib/taste.ts';
import { paletteNames, resolvePalette, type PaletteName, type PaletteMode } from '../palettes/index.ts';
import type { TypographyId } from '../../composition/types.ts';

export const themeNames = paletteNames;
export type ThemeName = PaletteName;
export type ThemeMode = PaletteMode;
export const typographyLabels: Record<TypographyId, string> = {
  'plex-sans': 'IBM Plex Sans',
  'noto-sans': 'Noto Sans',
  'plex-serif': 'Plex Serif + Plex Sans',
  'hanken-grotesk': 'Hanken Grotesk',
};

// Themes combine typography with a palette; they do not choose a composition.
// Omitted typography retains the original pairing for older documents/callers.
export function getTheme(name: ThemeName, mode: ThemeMode,
  typographyId: TypographyId = name === 'Precision' ? 'noto-sans' : name === 'Editorial' ? 'plex-serif' : 'plex-sans',
) {
  const body = typographyId === 'noto-sans' ? '"Noto Sans", sans-serif'
    : typographyId === 'hanken-grotesk' ? '"Hanken Grotesk", sans-serif' : typography.family;
  const headline = typographyId === 'plex-serif' ? '"IBM Plex Serif", serif' : body;
  return { name, typographyId, body, headline, typography: { ...typography, family: body }, palette: resolvePalette(name, mode) };
}
