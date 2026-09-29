# Development

Use the Node.js, pnpm, and uv versions pinned by `mise.toml`:

```sh
mise trust
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm fonts:generate
```

Run repository commands through `mise exec --` unless the environment is already
active. Do not install tools globally. `pnpm dev` starts the editor; `pnpm build`
builds the static playground. Preview sessions are local capability-bearing file
editors; public hosting contains no file session, account, cloud sync, or AI.

`fonts:generate` converts the pinned Fontsource WOFF2s to TTFs and copies their
licenses. uv manages the Python 3.11+ conversion environment using the committed
`scripts/generate-fonts.py.lock`. Generated TTFs and license copies are ignored by
Git; the generator verifies every font's bytes and metrics against the committed
`fonts/manifest.json` before writing assets. A mismatch fails rather than updating
the manifest. `dev`, `test`, `build`, `konpeki`, `check:package`, and `npm pack`
also run generation, so they work from a fresh checkout. Installed users receive
the generated fonts and licenses and need neither Python nor uv.

## Owned scene

v2 composition JSON is lowered to one scene containing resolved geometry,
HarfBuzz glyph positions, clipping, and paint order. The React canvas renders
that scene's SVG. Node PNG rasterizes the same SVG with resvg. Browser PNG uses a
canvas to rasterize it. PDF writes the same geometry and embeds selectable font
subsets. The file-session export endpoint delegates to these writers and checks
the supplied document revision.

The CLI commands are:

```text
konpeki validate composition.json
konpeki check composition.json
konpeki inspect composition.json [--page N] [--details]
konpeki render composition.json [--page N] [--format png|svg|pdf] [--scale 2] [--output file]
konpeki preview composition.json [--host host] [--port port] [--json]
```

Pages are one-based. PDF includes all pages unless one is selected and supports
mixed dimensions. Scale applies only to PNG. Output uses exclusive creation and
defaults to the input basename plus extension. `check` returns JSON
`{ok, diagnostics}` and exits 1 on errors.

`inspect` prints a versioned layout report with the input file's SHA-256 revision,
component boxes, explicit native text lines, and the same diagnostics as `check`.
The default is a component-level summary; `--details` adds unrounded geometry,
baselines, fonts, clips and per-element scene items. Summary boxes round to 0.01 px.
It lowers each selected page once; inspection and checking read that scene.
Without `--page` it includes all pages. Errors exit 1 but layout diagnostics do
not suppress the report. See the [report contract](../composition/README.md#agent-layout-report).

New documents use pixel rectangles. The loader converts legacy grid pages
losslessly; a normal subsequent save writes canonical pixel geometry.

The browser is a review and geometry-correction surface. Native and vector text
both open comments on double-click or Enter; wording changes belong to the agent
or source JSON. Browser text editing is deferred, with no WIP editor or feature
flag. Keep shaping, measured text layout, source updates, and export support
independent of that UI boundary.

Bundled fonts currently cover Latin, accents, and symbols; unsupported glyphs
are diagnostics. Contrast is measured from all solid glyph pixels at 2x and has
a finite-resolution caveat. Scaled chart artwork only triggers review of
pixel-unit details; it does not prove captions. Type leading comes from explicit
per-preset tables unless a positive page-pixel override is authored.

## Packaging

`skills/konpeki` is the canonical portable skill. Its runtime pin, `plugin.json`,
and `package.json` move together at 0.4.0. The npm allowlist includes the scene,
font, layout, draft, check, and PDF modules; generated draft icons; the font
manifest, 26 TTFs and licenses; the linebreak declaration; and every split CLI
runtime chunk. Obsolete v1 schema output, migration preview asset, and old PNG
export module are excluded.

`npm pack` generates and verifies the fonts, then runs `scripts/build-cli.mjs`;
dynamic imports may produce multiple files under `runtime/`, all of which are
package resources. Run:

```sh
pnpm check
pnpm test
pnpm build
pnpm check:package
```

The package check validates npm's file selection, every bundled composition,
and relative imports. An isolated tarball install should additionally exercise
validate, check, all three render formats, and preview. Do not infer rendering
fidelity from a browser screenshot or a structural test.

Retained React/SVG examples remain supported drawing references, not a second
runtime. Do not present the retained trusted-source conversion helper as a v1
document migrator. Never publish, push, deploy, or tag without explicit permission.

## Verification

The test suite requires Poppler (`pdftotext`, `pdftoppm`) and ImageMagick
(`compare`). On Debian/Ubuntu install `poppler-utils imagemagick`. These are test
dependencies only; end users need no browser, Poppler, or ImageMagick to render.
The full writer harness additionally uses ImageMagick 7's `magick` command.

With the dev server running and `agent-browser` installed:

```sh
node scripts/check-text-layout.mjs
node scripts/check-scene-writers.mjs
node scripts/check-grid-editing.mjs http://localhost:4318 /tmp/konpeki-editing
node scripts/check-page-zoom.mjs http://localhost:4318 /tmp/konpeki-zoom
node scripts/check-process-flow.mjs http://localhost:4318 /tmp/konpeki-process-flow
node scripts/check-notes.mjs /tmp/konpeki-comments
node scripts/check-grid.mjs /tmp/konpeki-gallery
```

Inspect the captured all-page canvas, comment, night, and export states. Assertions
do not establish visual correctness. `check-grid` uses the scene checks and
renders all 11 pages without a browser; chart scale is a review warning.

`check-grid-editing` exercises the correction canvas: text comments, movement, resize,
undo, repeated component IDs across pages, mixed page sizes, group alignment,
imports (including during a drag), and export. Component moves translate the
existing SVG, hit targets, handles and comment markers once per animation frame;
they commit the source only on release. Keyboard movement and resizing use a
1-page-pixel step on both axes without column or margin snapping. Group offsets
stay held until drop. Edge and center reference lines follow the preview without
changing its coordinates, then disappear on release. Standalone auto-height text
checks cover padding, rewrapping during horizontal resize, explicit fixed-height
resize, and Undo. Text-flow coverage checks measured hit boxes, source-driven reflow, deletion/undo,
persisted correction offsets and comment pins following reflow. Flow heights come
from shaped line boxes, not visible glyph ink; detailed inspection reports ink
separately. Page overflow stays a measured diagnostic.
Design changes such as theme and artwork alignment now arrive through source
imports rather than browser settings. `check-notes` starts a disposable file session and verifies
page/component comments, legacy import, browser-local persistence across preview
restarts, actual clipboard contents, denied/unavailable clipboard fallback,
no-duplicate retry, no sidecar writes, export isolation, failed-storage draft
preservation, the launcher and pending count, selection-first entry,
saved-comment editing and keyboard submission, reduced-motion support,
draft preservation across dialogs, page-order arrows, and empty/narrow layouts.
It also verifies comment drafts surviving external text edits and target removal, copying during GET/PUT
failures, and malformed legacy imports without blocking composition saves.
Copy & clear coverage includes automatic dismissal, persisted removal, Undo without reverting newer
composition edits, unsent drafts, clipboard/storage failure, comments restored
while permission is pending, and imports during an outstanding copy.
Older scripts for the pre-scene
editor and presentation UI are historical; use the checks listed above for the
current canvas.

`check-page-zoom` verifies native Chromium Ctrl+wheel input, pointer anchoring,
two-axis wheel scrolling, zoom limits, delta units, a synthetic Safari gesture
sequence, and corrections/comments while zoomed. It checks frame-batched input,
easing, reduced motion, aligned page headers and the removed status subtitle.
Drag checks include pixel movement, unchanged SVG identities and source during
preview, release before a queued frame, handle alignment, and exact Undo.
It also checks near-full-page default sizing, left-to-right order on narrow
screens, wheel navigation along the fitted row, fixed right gutters, centered
zoomed-out pages, and the seven-page overview.
It does not replace a physical trackpad check in macOS Safari.

`check-process-flow` exercises node drag/nudge, undo/redo, reset, reload, and a
subsequent JSON revision preserving the human's position override. It captures
horizontal, vertical, night, and crowded states; compares PNG/PDF rasters and
checks PDF text extraction. Inspect its captures as well as its assertions.

The original 3,719-case layout harness was not supplied. The reconstructed
45-case corpus is regression coverage, not a replacement for that acceptance
dataset. All 94 native blocks retain their captured Chromium line breaks, and
79 artwork labels retain their captured baselines within 0.5 px relative to
their grid origin. Centering leftover baseline space intentionally moves the
portrait/link grids down 3 px, explainer 2 px, and gallery 4 px. The 11 scene
snapshots include every item, target ID, glyph, fit and clip.

The font baseline check independently measures 78 Chromium positions. Nine
known cases differ by 0.58–0.76 px: all six Noto Sans faces at 20 px, Symbols 2 at
44/76 px, and Symbols at 76 px. These are explicit exceptions, not a global
tolerance increase. Blink's `FontMetrics::AscentDescentWithHacks` rounds ascent
and descent to integer pixels; `CalculateLeadingSpace` floors ascent-side
half-leading. Konpeki intentionally retains fractional OpenType metrics. The
manifest records OS/2 typo metrics when `USE_TYPO_METRICS` is set, otherwise hhea.

`check-scene-writers` compares Chromium SVG rasterization, resvg PNG and Poppler
PDF rasterization for the 11 example pages plus the GitHub cover at 2x, with raw
and blurred RMSE limits for raster edge coverage. It also checks extracted PDF
characters per page. These pixel limits
are regression alarms, not proof that only antialiasing can differ; inspect the
pairs when a writer changes. `--keep` retains the comparison output.

Regenerate bundled resources with `pnpm composition:generate`,
`pnpm fonts:generate`, and `node scripts/generate-draft-icons.mjs`. For an
intentional font or converter update, update the dependency locks, run
`pnpm fonts:generate --update-manifest`, review the manifest diff, and rerun the
text and writer conformance checks. Commit the manifest and locks, not the
generated fonts or license copies. resvg is pinned to 2.5.0: 2.6.2 can panic or
exhaust memory on cropped, offscreen clipped groups used by the paint-aware
contrast check.

## Release and playground deployment

The portable skill, plugin and package versions move together. After checks and
an isolated tarball preview succeed, push the release commit to `main` and its
matching bare version tag (for example `0.4.0`), only with authorization.
`.github/workflows/publish.yml` tests and packs that revision, smoke-tests all
export formats, and stages the tested tarball with `npm stage publish`.

Trusted publishing on npm must name `vcfgdev/konpeki`, workflow `publish.yml`,
with no environment and **Allow npm publish** unchecked. The workflow uses OIDC,
not an npm token. Staging is not publication: a maintainer must approve the
release in npm's **Staged Packages** tab and complete 2FA. Published versions
cannot be replaced. Reject an incorrect stage rather than approving it.

The public playground at [vcfgdev.github.io/konpeki](https://vcfgdev.github.io/konpeki/?example=introducing-konpeki)
deploys only when `pages.yml` is explicitly dispatched on `main`. Package
release and ordinary pushes do not deploy it. Deploy only static `dist`, never
a capability-bearing file-session server. Existing browser working copies
survive deployment; download edits before resetting an example.
