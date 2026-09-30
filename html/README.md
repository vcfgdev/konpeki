# HTML, files, theme, and CLI

This is the reference for Konpeki's source contract and runtime behavior. The
[skill](../skills/konpeki/SKILL.md) owns workflow; [AUTHORING.md](../AUTHORING.md)
owns editorial and visual judgment.

## Document and file contract

- Author static HTML/CSS and inline SVG. Do not author JavaScript, applications,
  interactive controls, or remote resources.
- Each page is an explicit direct child of `<body>` with `data-page` and a
  globally unique, stable `id`. Targetable HTML and SVG elements also need
  globally unique, stable IDs.
- CSS defines fixed page width and height, at most 8192 CSS px per side. Pages
  may differ in size. Page breaks are explicit; overflow is not paginated.
- Keep images, stylesheets, and licensed fonts beside the HTML with relative
  paths, or embed them. The only remote exception is Google Fonts from
  `fonts.googleapis.com/css2` and `fonts.gstatic.com`; it requires network access.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="theme.css">
  </head>
  <body>
    <main id="page-1" data-page data-size="link">
      <h1 id="title">A clear headline</h1>
    </main>
  </body>
</html>
```

## Themes

Link `theme.css` for the default light-blue theme. Read [Use a theme](theme.md)
for its `--kp-`-prefixed public tokens, complete type roles, page presets, and asset
requirements. A compatible entry point sets `--kp-theme: 1`; the base alone does
not. Keep the imported `theme-base.css` and referenced fonts beside the entry
point. Adapt a copy of the default when a brief brings its own look.

For deliberately unthemed content, set `data-theme="custom"` on its ancestor.
This skips theme-value checks in that subtree and definition checks on an
opted-out page, but keeps layout and resource checks. An alternative implementing
the contract does not need this opt-out.

## Diagnostics

`inspect` detects page and text overflow, clipped text, missing resources,
inter-element text line-box overlap, and opaque sRGB HTML text contrast against
solid ancestor backgrounds. Contrast thresholds are 3:1 for large text and
4.5:1 otherwise. Contrast inspection skips SVG text, gradients, images,
transparency, and compositing it cannot evaluate reliably.

`small-text` warns below 24 CSS px on screen presets and 11 CSS px on A4,
including unthemed HTML and SVG text. The default preset is presentation.
These are computed font-size floors, not a guarantee of legibility after SVG
viewBox scaling, CSS transforms, or reduction to the final viewing size. Unknown
custom presets have no assumed floor. Review screen graphics at their intended
size and print pages at actual size; warnings do not block export.

For opted-in themes, it also checks the active definition and compares used
size/leading pairs, colors and shape treatments to its tokens. See the [theme diagnostics](theme-authoring.md#verify-a-theme)
for required roles and contrast pairs. `inspect` includes each page's resolved
type treatments under `theme.type`, so authors can plan with the actual sizes.

CLI inspection checks which fonts actually drew the text. Installed-font fallback
is an error, including on unthemed pages. Both CLI and preview check declared
weight/style coverage; only CLI can audit actual glyph fallback. Bundle the
required licensed faces and subsets instead of relying on the machine.

HTML overlap uses estimated line-height boxes rather than raw font rectangles;
SVG, normal leading and transformed text retain range bounds. These are not glyph
ink measurements, and automated checks cannot establish factual
correctness or visual quality. Inspect rendered output. A render with diagnostic
errors exits nonzero and writes no output.

## CLI

```text
konpeki validate document.html
konpeki inspect document.html [--page N] [--details]
konpeki check document.html
konpeki render document.html [--page N] [--format png|pdf] [--scale 2] [--output file]
konpeki preview document.html [--host host] [--port port] [--json]
konpeki browser install
```

Pages are one-based. HTML export supports PNG and PDF only. PNG defaults to page
1; PDF includes all pages unless `--page N` is supplied and preserves mixed page
sizes. `--scale` affects PNG only. Outputs are exclusive and never overwritten.

Inspection and export require the pinned Chromium installed by `browser install`;
preview does not. Preview chooses another available port when its default is
busy, while an explicit `--port` is strict.

Preview comments remain browser-local. **Copy & clear** copies the full local
document path, comments, and target IDs for pasting into an agent conversation.
Small moves edit translation only; they do not reorder source. Deletion may
reflow content. Reread current source and preserve unrelated edits when applying
feedback.
