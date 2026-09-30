# Theme contract v1

A theme is a local CSS entry point plus its fonts and other licensed assets.
Documents use the names below rather than depending on a particular palette or
font. Replace `theme.css` to change the visual treatment without rewriting HTML.
Different font metrics can still change wrapping and fit: inspect every page
after a swap.

Every public theme custom property uses the `--kp-` prefix. A compatible theme
entry point sets `--kp-theme: 1` on `:root`; the shared base intentionally does
not set this marker, so loading `theme-base.css` alone does not opt into theme
checks.

`theme.css` supplies reusable appearance. [AUTHORING.md](../AUTHORING.md) and
design skills supply judgment: what to emphasize, how to arrange evidence, and
when a treatment is appropriate. Document CSS owns composition and data geometry.

## Use a theme

```html
<link rel="stylesheet" href="theme.css">
<style>
  .opening { display: grid; gap: var(--kp-space-3); }
  .opening p { max-width: 36ch; }
</style>
<!-- Inside body: -->
<main id="page-1" data-page data-size="link">
  <header class="opening">
    <h1 id="title" data-type="display">The supported conclusion</h1>
    <p id="evidence">The evidence that earns it.</p>
  </header>
</main>
```

Read this API when authoring a document; reading a theme's CSS implementation is
only necessary when creating or changing the theme itself. Use semantic HTML;
`data-type` changes appearance, not heading level or reading order. Page-owned
CSS may use these tokens for geometry and custom SVG, and override defaults when
the material requires it. Avoid hard-coded treatments if the document must be
theme-swappable.

## Type roles

Every role has `--kp-font-ROLE`, `--kp-leading-ROLE`, `--kp-weight-ROLE`, and
`--kp-tracking-ROLE`. Sizes and leading resolve through custom properties to
literal positive pixel lengths such as `24px`; v1 does not accept `rem` or `calc()`
for these slots. Weights must have bundled faces; tracking uses `em` or `px`.
These names form complete treatments, not independent invitations to mix seven
sizes with seven line heights.

| Role / `data-type` | Semantic default | Family | Default color role |
| --- | --- | --- | --- |
| `fine` | Explicit hook only | `--kp-font-family` | `--kp-muted` |
| `caption` | `figcaption` | `--kp-font-family` | `--kp-muted` |
| `body` | Page text | `--kp-font-family` | `--kp-fg` |
| `lead` | `h3` | `--kp-font-family` | Inherited |
| `heading` | `h2` | `--kp-font-family-heading` | Inherited |
| `title` | `h1` | `--kp-font-family-heading` | `--kp-accent` |
| `display` | Explicit hook only | `--kp-font-family-display` | `--kp-accent` |

An explicit role replaces an element's semantic default: `h2 data-type="caption"`
uses the caption treatment, and remains an `h2`. An unmarked paragraph inherits
its context. `strong` uses `--kp-weight-strong`. Inline `code` keeps its context's
size and leading but uses `--kp-font-family-mono`, `--kp-weight-mono`, and the
accent. All four family slots are required; they may refer to the same face.

`inspect` reports the resolved `theme.type` for each page, including size, leading,
weight, tracking, and family. Use those measurements to plan line lengths without
opening CSS: the default link preset has body 24/32 and title 52/60 CSS px.

## Color roles

Konpeki bundles one theme: cobalt blue on a light canvas, independent of OS
preference. Define every token below when adapting it for a brief.

| Tokens | Meaning |
| --- | --- |
| `--kp-bg`, `--kp-fg`, `--kp-muted` | Canvas, primary ink, supporting ink |
| `--kp-surface` | Secondary surface |
| `--kp-line-subtle`, `--kp-line`, `--kp-line-strong` | Three boundary strengths |
| `--kp-contrast`, `--kp-on-contrast`, `--kp-on-contrast-muted` | Contrasting surface and its primary/supporting ink |
| `--kp-accent`, `--kp-wash`, `--kp-inverse` | Primary accent, tinted surface, ink for an accent field |
| `--kp-emphasis`, `--kp-emphasis-wash` | Secondary emphasis and its surface |
| `--kp-complete`, `--kp-attention`, `--kp-blocked` | Status, always paired with a non-color cue |
| `--kp-category-1` … `--kp-category-6` | Unordered identities; keep identity consistent across the document |
| `--kp-sequence-1` … `--kp-sequence-5` | Ordered amounts, from least to most emphasized |

Palette membership is not contrast approval. Check actual text/background pairs;
chart fills and subtle boundaries need not be suitable text colors. In particular,
`inverse` is ink for `accent`, not for every category or sequential fill. Pale
sequential steps and washes need direct labels or contrasting outlines when used
as chart marks. A contrasting surface owns its ink: set both its background and
its text colors in document CSS rather than inheriting the canvas's ink.

## Rhythm, shape, and output geometry

- `--kp-unit` is the theme's spacing unit. The base derives `--kp-space-1`, `-2`, `-3`,
  `-4`, `-5`, `-6`, `-8`, `-10`, `-12`, and `-16` as multiples on each page.
  Choose gaps by relationship.
- `--kp-rule-width`, `--kp-stroke`, and `--kp-stroke-heavy` describe rules, diagram
  strokes, and heavy marks. `--kp-radius-small` and `--kp-radius` describe corners.
  `hr` uses the rule width and `--kp-line`; other boundaries, strokes, and corners
  are applied by document CSS. These tokens do not mandate panels or rounded pages.
- `--kp-page-width`, `--kp-page-height`, and `--kp-page-margin` describe the output canvas.
  The shared [base stylesheet](../theme-base.css) provides these presets:

| `data-size` | Width × height | Default margin |
| --- | --- | --- |
| `presentation` or omitted | 1920 × 1080 px | 72 px |
| `portrait` | 1080 × 1350 px | 60 px |
| `square` | 1080 × 1080 px | 60 px |
| `link` | 1200 × 630 px | 48 px |
| `article` | 1600 × 600 px | 48 px |
| `a4` | 210 × 297 mm | 56 px |
| `explainer` | 1200 × 1600 px | 60 px |
| `gallery` | 1600 × 1000 px | 64 px |

The base also supplies the existing seven-step type sizes and leading per
preset, box sizing, margin resets, and role application. It does not choose page
layout. Theme authors may tune type steps and margins on `[data-page]` or
`[data-size="…"]` after the import; changing them on `:root` will not override
the page's own values. Keep preset dimensions stable across themes.

## Create a theme

When a brief brings its own look, adapt a copy of [`theme.css`](../theme.css).
Keep `theme-base.css`, the referenced font files, and their licenses beside it.
Change token values and font declarations in the copy.
The HTML continues to link only `theme.css`; its first rule imports the local
base. Keep that import before font faces and other rules.

The bundled default uses IBM Plex Sans Latin 400/600/700 and Plex Mono Latin 400
for code. Font files come from Fontsource 5.3.0 and retain their licenses in
`fonts/OFL.txt` and `fonts/plex-mono-OFL.txt`.
Bundle additional licensed subsets, weights, and styles when needed. Loading a
font does not prove it covers every glyph: these files do not cover CJK and do
not include italics. Do not depend on a machine's installed fonts or synthesized
faces for required content.

## Verify a theme

Define every listed token, directly or through the shared base. Run `konpeki check`
on a specimen for each supported page size. Use all font families and weights in
the specimen to exercise their loading. The existing inspector validates the
active definition on each page, including unused tokens.

For example, start a specimen beside the theme and its assets with:

```html
<!doctype html>
<html lang="en">
<head><link rel="stylesheet" href="theme.css"></head>
<body>
  <main id="specimen" data-page data-size="link">
    <h1>Theme specimen</h1><p>Body, <strong>emphasis</strong>, and <code>code</code>.</p>
  </main>
</body>
</html>
```

Theme diagnostics require `--kp-theme: 1`. Other versions warn and skip these
checks; a stylesheet without the marker does not opt in.

- **Errors:** missing required tokens, invalid colors or type treatments,
  non-increasing type sizes, leading smaller than its size, and text-role contrast
  below 4.5:1. Text pairs are `fg`/`muted` on `bg`/`surface`/`wash`, the two
  `on-contrast` inks on `contrast`, `accent` on `bg`, and `inverse` on `accent`.
- **Warnings:** category marks below 3:1 against `bg`, exact duplicate category
  colors, and used colors or size/leading pairs outside the active theme. SVG
  text checks size only, because coordinates own its line placement.

Contrast checks cover opaque sRGB only. Duplicate detection is not a test for
perceptual distinguishability or color-vision accessibility. Inspection cannot
prove a value was written with `var()`, detect every font fallback, or establish
good composition. Render and review every page, including wrapping, chart labels,
and meaning. Compatible alternatives need no `data-theme="custom"` opt-out;
reserve that for deliberately unthemed content.
