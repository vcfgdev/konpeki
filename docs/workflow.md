# Canvas workflow

Konpeki 0.4 uses `konpeki-composition/v2`. Composition JSON is the editable
source; one owned scene drives canvas display, checking, and every export.

## User workflow

1. Give your coding agent the brief, source material, and intended use.
2. Review the visual it returns. Ask for revisions in the same conversation,
   or open the optional canvas to edit directly and leave notes or pins.
3. Ask the agent to apply your canvas feedback; adding a note does not invoke it.
4. Keep the editable JSON and use the requested PNG, SVG, or PDF for delivery.

No outline approval, diagram taxonomy, or browser session is required unless
it helps your task. Ordinary documents need no showcase prompt records. Keep
substantial sources and caveats with the document so later revisions remain faithful.

## Agent loop

1. Write or revise the composition IR from the brief and sources.
2. Run `konpeki inspect composition.json`, read the resolved layout and fix errors.
3. Render each affected page as a 2x PNG and inspect it.
4. Repair and repeat, then deliver the JSON and requested outputs.

`inspect` prints a compact JSON summary with the file revision, page/component
IDs, resolved boxes, native text lines, artwork counts, aligned groups and all
diagnostics. Add `--details` for exact geometry, baselines, clips, font IDs and
individual vector elements. Use `--page N` to limit both layout and diagnostics.
Measurements are in page pixels, independent of export scale. Reread the document
before edits; the report describes one revision, not a replacement document.

`validate` performs structural validation. `check` prints JSON shaped as
`{ok, diagnostics}` and exits 1 for errors. Diagnostics include page IDs and,
where relevant, component and element IDs. `inspect` includes the same checks
and exit behavior, so a separate `check` run is unnecessary when inspecting all
pages. Preview is optional for agents; PNG inspection remains required.

```sh
npm exec --no -- konpeki inspect slides/example/composition.json
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

When applying feedback, read the current notes and pins as well as the composition.
Use their target IDs rather than guessing from an old screenshot. If a target
no longer exists or feedback conflicts with a newer edit, report that instead
of silently applying stale instructions. Review the changed pages and tell the
user which feedback was addressed and what remains unresolved. This is an agent
workflow, not an automatic comment-resolution or agent-invocation feature.

## Delivery

Return the editable composition and requested exports, with a preview when useful.
Inspect all pages with `inspect` and visually review affected renders and requested
exports before delivery. State remaining warnings and limitations; successful
machine checks alone do not prove factual correctness or visual quality.
Recipients can view PNG/SVG/PDF without the authoring runtime, or import the JSON
into the browser playground to continue editing. A file-session preview URL is
not a permanent published artifact. Publishing or deployment needs permission.

## Pages and review

Presets are `presentation`, `square`, `portrait`, `link`, `article`, `a4`, `explainer`,
and `gallery`. Each owns fixed dimensions, margins, columns, gutters, baseline
rows, and type steps. Recompose when changing presets; do not stretch content.

Bundled fonts cover Latin, accents, and symbols. Missing glyphs are reported as
errors. Contrast checks measure all solid glyph pixels at 2x, so their result has
a finite-resolution caveat. Scaled-chart diagnostics mean pixel-unit details
need review; they do not prove chart captions. Inspect every affected PNG and
every requested export separately.
