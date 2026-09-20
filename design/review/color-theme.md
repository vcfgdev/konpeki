# Color / theme review

Owns palette use across the deck. Apply existing
[theme guidance](../../AUTHORING.md#taste-and-creative-freedom) and
[color roles](../palettes/README.md); this category adds no new style rules.

- Check palette roles, background and visual emphasis against the brief and
  selected mode. Both modes use the original white-background/main-accent
  fallback unless the user supplies another direction. Dynamic permits local
  emphasis fills, not an automatic dark or colored canvas.
- Check text/mark contrast on actual surfaces at viewing size. Confirm category
  and status meanings stay consistent and have cues beyond color alone.

Leave font rendering to typography and container structure to visuals.
Use the shared [review process](../visual-review.md#independent-review).

## Measure a declared solid pair

Use [contrastRatio](../../lib/contrast.ts) for opaque six-digit sRGB hex colors.
From the kit directory, this checks one declared normal-text pair:

```sh
node --input-type=module <<'JS'
import { contrastRatio } from './lib/contrast.ts';
const foreground = '#505B68', background = '#FFFFFF';
const ratio = contrastRatio(foreground, background);
console.log({ foreground, background, ratio, minimum: 4.5 });
if (ratio < 4.5) process.exitCode = 1;
JS
```

Use actual palette roles or rendered values for the pair under review. Record
the page/element, pair, ratio and applicable threshold. Compare the unrounded
ratio: rounding 4.478 to 4.5 does not make it pass. Normal text needs 4.5:1;
large text can use 3:1 only when it qualifies at the delivered size (at least
24 CSS px regular or about 18.67 CSS px bold). A 32-unit SVG label scaled to
half size is not 32 CSS px. Contrast does not establish comfortable readability.

This helper does not discover backgrounds, classify text, composite opacity or
inspect images, gradients and overlapping shapes. Confirm the solid pair really
applies in the render. For other surfaces, measure the actual composite with an
appropriate tool and inspect the result; otherwise report contrast as Not verified.
Never report an unmeasured ratio. The existing theme browser check's containing-
rectangle assumption remains specimen-specific, not a general background solver.
