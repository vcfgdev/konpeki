# Canvas workflow

Konpeki 0.4 uses `konpeki-composition/v2`. Composition JSON is the editable
source; one owned scene drives canvas display, checking, and every export.

## Agent loop

1. Write or revise the composition IR from the brief and sources.
2. Run `konpeki check composition.json` and fix errors.
3. Render each affected page as a 2x PNG and inspect it.
4. Repair and repeat, then deliver the JSON and requested outputs.

`validate` performs structural validation. `check` prints JSON shaped as
`{ok, diagnostics}` and exits 1 for errors. Diagnostics include page IDs and,
where relevant, component and element IDs. Preview is optional for agents.

```sh
npm exec --no -- konpeki validate slides/example/composition.json
npm exec --no -- konpeki check slides/example/composition.json
npm exec --no -- konpeki render slides/example/composition.json --page 1 --format png --scale 2 --output slides/example/page-1.png
```

`render` accepts `png`, `svg`, or `pdf`. Pages are one-based. Scale applies only
to PNG. The default output is the input basename plus the format extension, and
an existing output is never overwritten. PDF renders every page unless `--page`
is supplied, supports mixed page sizes, and contains selectable subset text.

## Optional preview

`konpeki preview composition.json` opens a file-backed human editor. Use the exact
session URL; it is a capability and must not be published. Browser saves are
revision checked, valid external edits update the canvas, and the prior state
remains undoable. In remote environments use authenticated forwarding.

The canvas uses the same scene as CLI output. Browser PNG rasterizes its SVG;
PDF support is loaded only when needed. File-session exports use the same writers.
Revision notes and numbered pins can target a page, component, or vector element.
They persist beside the document, remain out of artwork and exports, and are
guidance for the next chat revision. Reread the current composition before
applying them so newer human edits survive.

## Pages and review

Presets are `presentation`, `square`, `portrait`, `link`, `article`, `explainer`,
and `gallery`. Each owns fixed dimensions, margins, columns, gutters, baseline
rows, and type steps. Recompose when changing presets; do not stretch content.

Bundled fonts cover Latin, accents, and symbols. Missing glyphs are reported as
errors. Contrast checks measure all solid glyph pixels at 2x, so their result has
a finite-resolution caveat. Scaled-chart diagnostics mean pixel-unit details
need review; they do not prove chart captions. Inspect every affected PNG and
every requested export separately.
