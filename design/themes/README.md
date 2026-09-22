# Themes

Document appearance has independent **Typography**, **Color palette**, and
**Background** controls. These do not choose a layout or change font sizes.

Use [authoring guidance](../../AUTHORING.md#taste-and-creative-freedom) for theme
selection, font defaults and deck-wide consistency.

```ts
import { getTheme } from './design/themes/index.ts';
const theme = getTheme('Green', 'paper', 'noto-sans');
// theme.body, theme.headline, theme.typography, theme.palette
```

Eight palettes retain their existing names: Plex, Precision, Editorial,
Blue–cyan, Orange–coral, Yellow, Green and Graphite. Each supports Paper and Night.
Choose any palette with any of these typography presets:

| Typography ID | Headings | Body |
| --- | --- | --- |
| `plex-sans` | IBM Plex Sans | IBM Plex Sans |
| `noto-sans` | Noto Sans | Noto Sans |
| `plex-serif` | IBM Plex Serif | IBM Plex Sans |
| `hanken-grotesk` | Hanken Grotesk | Hanken Grotesk |

Composition JSON stores the optional choice in `theme.typography`, independently
of `theme.id` (palette) and `theme.mode` (background). Omitted typography preserves
legacy appearance: Precision uses Noto Sans, Editorial uses Plex Serif headings
with Plex Sans body, and all other palettes use Plex Sans. Changing the palette
in the editor records the current typography so colors no longer change fonts.
Two-argument `getTheme` callers retain those legacy pairings too.

Font loading remains the author's responsibility; load the required Fontsource
Latin weights before measuring or rendering text. Theme-linked native text and
vectors follow the selection; literal font/color overrides remain fixed.
Different fonts can change wrapping or overflow, so inspect the result.

Mineral and Botanical are light-only palette candidates in
[palettes/candidates.ts](../palettes/candidates.ts).
A theme does not impose geometry, density or supporting-text sizes.
