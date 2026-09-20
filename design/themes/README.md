# Themes

Themes combine font roles and a referenced color palette, not a slide layout.

Use [authoring guidance](../../AUTHORING.md#taste-and-creative-freedom) for theme
selection, font defaults and deck-wide consistency.

```ts
import { getTheme } from './design/themes/index.ts';
const theme = getTheme('Plex', 'paper');
// theme.body, theme.headline, theme.typography, theme.palette
```

Eight light/dark themes: Plex, Precision, Editorial, Blue–cyan, Orange–coral,
Yellow, Green and Graphite. Precision uses Noto Sans; Editorial uses Plex Serif
headlines with Plex Sans body; the others use Plex Sans. Font loading remains
the author's responsibility; load the required Fontsource Latin weights before
measuring or rendering text.

Mineral and Botanical are light-only palette candidates in
[palettes/candidates.ts](../palettes/candidates.ts).
A theme does not impose geometry, density or supporting-text sizes.
