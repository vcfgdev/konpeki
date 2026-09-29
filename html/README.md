# HTML document contract

New Konpeki documents are static HTML/CSS. The source HTML is canonical; there
is no intermediate composition JSON representation.

## Required structure

- Every page is explicitly authored as a direct child of `<body>`.
- Every page has `data-page` and a globally unique, stable `id`.
- Every targetable page element has a globally unique, stable `id` across the
  document. Give targetable inline SVG elements stable IDs too.
- CSS defines each page's fixed width and height (up to 8192 CSS px per side).
  Pages may have different sizes; their content can use normal flex/grid flow.
- Use ordinary HTML and CSS with inline SVG.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <style>
      #page-cover { width: 1200px; height: 630px; }
      [data-page] { position: relative; overflow: hidden; }
    </style>
  </head>
  <body>
    <main id="page-cover" data-page>
      <h1 id="cover-title">A clear headline</h1>
      <svg id="cover-diagram" aria-label="…">…</svg>
    </main>
  </body>
</html>
```

## Static and portable

Keep images, CSS, and fonts beside the HTML using relative paths, or embed them.
Do not use authored JavaScript, embedded applications, interactive controls, or
remote resources.

Page breaks are explicit. Konpeki does not paginate overflow automatically. Make
every intended PDF page a separate direct-body page.

## Diagnostics and limits

`inspect` and `check` use DOM geometry to detect page overflow, clipped text, and
missing images or fonts. Text geometry is based on line boxes, not visible glyph
ink. These checks do not prove collision freedom, contrast, factual correctness,
or visual quality. Inspect rendered output.

CLI inspection also reports failed stylesheet and background-image requests.
It uses a viewport the size of each page, matching the preview iframe, and
exports the screen layout with animations disabled. Whole-page SVG export is
not available. Preview translation does not reorder document flow; percentage
or 3D translations and transformed ancestor coordinates are not supported for
dragging. Make those corrections in source.

## Commands

```text
konpeki validate document.html
konpeki inspect document.html [--page N] [--details]
konpeki check document.html
konpeki render document.html [--page N] [--format png|pdf] [--scale 2] [--output file]
konpeki preview document.html [--host host] [--port port] [--json]
konpeki browser install
```

Pages are one-based. PNG defaults to page 1. PDF includes all explicitly authored
pages by default and preserves mixed sizes. Output creation is exclusive. Install
the pinned browser explicitly for CLI inspection/export; preview does not need
headless Chromium.
