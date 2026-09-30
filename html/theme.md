# Use a theme

Link `theme.css`; keep its imported CSS, fonts and licenses beside the document.
Use the tokens below without reading their CSS values. `inspect` reports resolved
type sizes, leading, weights and families under each page's `theme.type`.
Theme construction and diagnostics are in [Author a theme](theme-authoring.md).

## Type

Use semantic HTML. `data-type` changes appearance without changing reading order.
An explicit role replaces the semantic default; unmarked paragraphs inherit.

| `data-type` | Default | Purpose |
| --- | --- | --- |
| `fine` | Explicit only | Small supporting detail |
| `caption` | `figcaption` | Captions and sources |
| `body` | Page text | Main reading text |
| `lead` | `h3` | Lead or minor heading |
| `heading` | `h2` | Section heading |
| `title` | `h1` | Main headline |
| `display` | Explicit only | Large headline |

Custom SVG can use `--kp-font-ROLE`, `--kp-leading-ROLE`, `--kp-weight-ROLE` and
`--kp-tracking-ROLE`. Keep each size/leading pair together. Font slots are
`--kp-font-family`, `-heading`, `-display`, and `-mono`. `strong`, `code` and `em`
work directly; unsupported weights/styles and system-font fallback are errors.

## Color and shape

All names below start with `--kp-`:

| Tokens | Use |
| --- | --- |
| `bg`, `fg`, `muted`, `surface` | Canvas, main/supporting ink, secondary surface |
| `accent`, `wash`, `inverse` | Accent, tint, ink on the accent |
| `contrast`, `on-contrast`, `on-contrast-muted` | Contrasting surface and its inks |
| `line-subtle`, `line`, `line-strong` | Boundary strengths |
| `emphasis`, `emphasis-wash` | Secondary emphasis and tint |
| `complete`, `attention`, `blocked` | Status, paired with a non-color cue |
| `category-1` … `-6`; `sequence-1` … `-5` | Identities; ordered amounts |
| `space-1`, `-2`, `-3`, `-4`, `-5`, `-6`, `-8`, `-10`, `-12`, `-16` | Gaps/padding by relationship |
| `rule-width`, `stroke`, `stroke-heavy`; `radius-small`, `radius` | Boundaries, strokes; corners |

Palette membership is not contrast approval. Set a contrasting surface's ink
explicitly. Pale chart marks need labels or outlines; `inverse` is not universal
ink for every fill. Document CSS owns layout and data geometry.

## Page presets

Set `data-size` on each `[data-page]`: `presentation` (default, 1920×1080),
`portrait` (1080×1350), `square` (1080×1080), `link` (1200×630), `article`
(1600×600), `a4` (210×297 mm), `explainer` (1200×1600), or `gallery` (1600×1000).
Dimensions otherwise use CSS px. `--kp-page-width`, `-height`, and `-margin`
describe the canvas. Override page/type sizes on `[data-page]`, not `:root`.

Keep theme changes separate from composition. Read a theme's optional `NOTES.md`
for its taste; general judgment stays in AUTHORING.md. After a swap, inspect and
render every page. Reserve `data-theme="custom"` for deliberately unthemed
content; it does not disable layout or font checks.
