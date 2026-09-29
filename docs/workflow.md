# HTML workflow

For new work, `document.html` is the canonical editable source. It contains
static HTML/CSS and inline SVG; there is no composition IR between source,
inspection, preview, and export. Existing JSON documents keep their existing
commands and engine but are a legacy path.

## Agent loop

1. Write or revise `document.html` from the brief and sources. Explicit pages are
   direct children of `<body>` with `data-page` and globally unique stable IDs.
   Give targetable elements stable IDs; define page dimensions in CSS.
2. Run `konpeki validate document.html` for the static source contract.
3. Run `konpeki inspect document.html`; use `--page N` or `--details` when useful.
4. Repair page overflow, clipped text, and missing images/fonts.
5. Render each affected page at 2x and visually inspect it. Repeat before delivery.

```sh
konpeki inspect document.html
konpeki render document.html --page 1 --format png --scale 2 --output page-1.png
```

`check` prints diagnostics for automation. DOM diagnostics use line boxes rather
than glyph ink. They are not collision, contrast, factual, or aesthetic proof,
and Konpeki does not paginate overflowing content automatically.

PNG defaults to page 1. PDF includes every explicitly authored page unless a page
is selected and supports mixed page dimensions. Output creation is exclusive.

## Optional human preview

Run `konpeki preview document.html [--host ...] [--port ...] [--json]` when a
human review surface is useful. Preview serves the source and does not itself
need headless Chromium.

People may:

- leave comments on pages or identified elements;
- make small drag corrections, saved to source as visual translation without
  changing DOM order;
- delete an element, which may allow normal document reflow;
- undo corrections; and
- use visual alignment guides, which do not snap.

There is no browser text editing, resizing, presentation mode, design control
panel, or authored application UI. Make wording and substantive design changes
in source.

Comments remain browser-local and separate from HTML and exports. **Copy & clear**
copies a prompt containing comments and target IDs for pasting into the agent
conversation. Clipboard failure must leave comments recoverable; undo can restore
a cleared batch. Copying does not invoke the agent. There is no adapter, waiting
process, automatic resolution, or review sidecar.

Before applying feedback, reread current source and address comments by stable ID.
Preserve unrelated and newer edits. If a target disappeared or a request conflicts
with newer work, report it rather than guessing.

## Delivery

PNG and PDF are artifact-first delivery. Keep canonical HTML and nearby images,
CSS, and fonts in the agent workspace; share source only when useful or requested.
Inspect each requested export independently and report unresolved warnings or
verification limits. Artifact recipients and reviewers do not need Playwright or
Chromium. A local preview is not a deployed or permanent artifact.

The [public comment preview](https://vcfgdev.github.io/konpeki/) uses three native
[HTML examples](../examples/README.md). Click an element to comment, then copy the
prompt into your agent conversation. Comments are scoped to each example and stay
in your browser; this static demo does not modify files on GitHub. Use the local
CLI preview for source corrections. The npm runtime remains unpublished.
