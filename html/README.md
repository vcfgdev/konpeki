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

## Bundled theme

Link the root [`theme.css`](../theme.css) unless the brief supplies its own look.
Keep its `fonts/` directory beside it. It bundles IBM Plex Sans Latin 400, 600,
and 700 under the SIL Open Font License.

Set `data-mode="light|dark"` and choose one of eight `data-palette` slugs:
`plex`, `precision`, `editorial`, `blue-cyan`, `orange-coral`, `yellow`, `green`,
or `graphite`. Page presets use `data-size` values `portrait`, `square`, `link`,
`article`, `a4`, `explainer`, or `gallery`; omitting it uses the original
1920 × 1080 scale.

The theme provides `--unit` (8px), `--page-width`, `--page-height`,
`--page-margin`, color tokens, and type tokens from `--font-fine` through
`--font-display` with matching `--leading-*` values. Presets preserve the former
type scales. Read `theme.css` for exact values.

For a brief-specific look, set `data-theme="custom"`. This suppresses only
theme-value warnings. Computed-value inspection cannot prove whether a value
came from a CSS variable, so visual review remains required.

## Diagnostics

`inspect` detects page and text overflow, clipped text, missing resources,
inter-element text line-box overlap, and opaque sRGB HTML text contrast against
solid ancestor backgrounds. Contrast thresholds are 3:1 for large text and
4.5:1 otherwise. Contrast inspection skips SVG text, gradients, images,
transparency, and compositing it cannot evaluate reliably.

Line boxes are not glyph ink, and automated checks cannot establish factual
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
