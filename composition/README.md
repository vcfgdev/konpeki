# Composition contract

Konpeki 0.4 authors `konpeki-composition/v2`. Composition JSON is the editable
intent contract; the owned scene produced by `lower.ts` is the rendering contract
shared by the canvas, checks, SVG, PNG, and PDF writers. Unknown schema versions
are rejected. There is no supported v1 migration command.

## Grid and type

New pages choose a fixed preset with `grid.revision: 2`:

| Preset | Size | Columns × rows | Baseline |
| --- | --- | --- | --- |
| `presentation` | 1920×1080 | 24 × 78 | 12 px |
| `portrait` | 1080×1350 | 12 × 102 | 12 px |
| `link` | 1200×630 | 8 × 66 | 8 px |
| `square` | 1080×1080 | 12 × 80 | 12 px |
| `article` | 1600×600 | 16 × 63 | 8 px |
| `a4` | 210×297 mm | 12 × 252 | 4 px |
| `explainer` | 1200×1600 | 12 × 123 | 12 px |
| `gallery` | 1600×1000 | 24 × 72 | 12 px |

`a4` uses exact millimetres converted to CSS pixels at 96 dpi (approximately
793.70×1122.52 px), with roughly 15 mm margins and 16 px gutters. PDF preserves
210×297 mm; PNG uses a rounded 794×1123 base raster, or 1588×2246 at 2×. Its
fine-through-display sizes are 10/12/14/18/24/32/44 px, with leading
14/16/20/24/30/38/50 px. Body text is 10.5 pt in PDF. Use `custom` as its
`intendedViewingSize`. Pages remain explicitly composed; A4 does not add
automatic text flow or pagination.

Omitted `revision` or explicit `1` retains the original grid: half as many
columns, with the same rows, margins, preset gutters, and typography. Loading and
saving never upgrades a page implicitly. Revision is independent of destination
and is preserved when switching presets. New pages in an existing document
inherit its first page's grid.

The editor's **Use finer grid** action upgrades one page and supports undo.
`konpeki refine-grid input.json --output refined.json` upgrades all pages into a
new file; it never overwrites a file. It maps numeric column `c` to `2c − 1` and
span `s` to `2s`, preserving `"center"`, rows, IDs and all other content. Group
areas convert too. Applying it again does nothing. Do not change the revision
without converting areas. This halves horizontal placement steps (150 → 75 px
on presentation, 282 → 141 px on link) without changing existing page pixels.

Components use `area: {column, span, row, rows}`. Starts are one-based integers
or `"center"`; spans are positive integers. Center placement requires the span
and the grid count to have the same parity on that axis. For example, a
24-column grid accepts centered spans 2, 4, 6…; the article preset's 63 rows
accept centered heights 1, 3, 5…. Invalid spans suggest the nearest valid sizes.
No fractional starts or pixel offsets are supported. Spare height after the
last full baseline row is split equally above and below the grid.

Authored areas are authoritative. Preset changes never stretch or automatically
recompose content. Component padding is measured in baseline units. Dragging or
nudging converts centered placement to a numeric start only on the changed axis.

The type steps are `fine`, `caption`, `body`, `lead`, `heading`, `title`, and
`display`. Role defaults are footnote→fine, caption→caption, body→body,
subtitle→lead, and title→title. `textStyle.step` overrides the role default.
`textStyle.leading` is a positive whole number of baseline units; without it,
each preset's leading table supplies the line height. Leading is derived rather
than stored as arbitrary pixels and must not be smaller than the type size.
Native text accepts `appearance.verticalAlignment: "start" | "center" | "end"`.
The default is `end` for titles and `start` for other roles. Start and end align
the line boxes; overlong end-aligned text starts at the top and reports overflow.
Center aligns the first line's cap top through the last baseline, using the
font manifest's cap height. It excludes half-leading and descenders, applies
within each padded text region, and adds no optical lift. Overlong centered
text remains centered and reports clipping.

Groups may pair an `area` with `verticalAlignment` to translate their members
together. Group alignment uses text glyph ink and shape geometry, rather than
empty component cells; strokes use half-width envelopes (not exact miter/dash
outlines), and SVG arcs use the path library's cubic approximation. It preserves
paint order, member clips, relative authored positions and IDs. It is not a
stack layout: changing copy recomputes the offset but does not reflow neighbours.
Selection, editing overlays and pins use the translated scene geometry; saved
member areas never contain the derived offset. The GitHub cover demonstrates a
centered `brand-stack` group on the link preset.

During pointer drags, resizes and held arrow-key edits, the editor freezes the
group's offset and outlines its target area. It recomputes alignment on release
or interruption, so edge members track the gesture instead of moving at half
speed. The override is transient; saved documents and exports use settled
alignment. Ink-based offsets may be fractional, so aligned members need not sit
on baseline rows. Use group alignment deliberately where centering matters more
than matching neighbouring rows.

Page numbers are opt-in: omitting `pageNumber` or choosing `style: "none"` hides
them. Set `style: "01"` or `"01/02"` to show them. This differs from the old
canvas's implicit `"01"` default.

## Components and artwork

The semantic kinds are Text block, Diagram, Chart, Image, and Table. Components,
vector elements, topology nodes, and edges have stable IDs. `readingOrder` and
`paintOrder` are independent exact orders. Relationships and all recorded edges
must remain visible; nearby prose is not a substitute.

Custom artwork is a structured vector tree owned by its component. Coordinates
are local to that component. Colors and fonts should bind to theme roles; vector
font sizes use `scale:<step>`. Supported primitives include groups, rectangles,
circles, ellipses, lines, polylines, polygons, paths, text, and tspans. Outlined
shapes remain outlines in SVG and PNG. Standard diagram, chart, and table artwork
is a draft until deliberately authored and may be flagged as such.
Unauthored topology shows a neutral reserved area and node/edge counts, not an
inferred diagram. The topology remains in the document for authoring; the draft
is not a finished representation of its relationships.

`customVisual.alignment: "start" | "center" | "end"` positions fitted artwork
horizontally inside its padded cell; the default is `center`. Contain uses spare
width, cover chooses which side to crop, and stretch fills the width regardless
of alignment. Shapes and labels move together; vertical fitting stays centered.
This is independent of native text's `appearance.alignment`. The cover combines
left-aligned text and artwork with a vertically centered group.

Labels allow `x`, `y`, `text-anchor`, `fill`, `font-family`, `font-size` (a type
step), `font-weight`, and `font-style`. Tspans are whole lines with explicit
`x`/`y`, their own IDs, and a text parent. `dx`, `dy`, transforms and
`dominant-baseline` are rejected. Labels stay in the vector tree and preserve
paint order; their step sizes are not scaled with the surrounding shapes.
Group `opacity` is unsupported because it requires isolated compositing;
inherited `fill-opacity`/`stroke-opacity` and individual shape opacity work.

`appearance.selection` is `auto` or `explicit`. Explicit chart or diagram forms
must not change without instruction. Auto permits the agent to choose and update
the form while preserving topology and required facts. Scaling chart artwork
produces a review warning for pixel-unit details; it is not evidence that chart
captions or semantics are correct.

## Fonts, checks, and writers

Bundled fonts cover Latin, accents, and symbols. Unsupported glyphs produce
`missing-glyph` errors rather than silent fallback. Text is shaped once and its
glyph stream is shared by the scene writers. PDF embeds deterministic subsets and
maps text for selection; pages may have mixed dimensions.

`validateComposition` checks the v2 structure and cross references.
`checkPage`/`checkPageNode` report stable diagnostics for overflow, clipped
labels, missing glyphs, draft artwork, scaled charts, and text contrast.
`group-overflow` names the group ID when aligned contents exceed its area;
alignment never enlarges or removes the member clips to hide overflowing copy.
Contrast examines all solid glyph pixels at 2x; it remains a finite-resolution
measurement and excludes effects it cannot establish reliably.

## Agent layout report

`konpeki inspect composition.json [--page N] [--details]` prints JSON to stdout without
modifying the file or starting a browser. It includes every page by default;
`--page` is one-based and limits both measurements and diagnostics. The envelope
is `{schema: "konpeki-inspection/v1", detail, revision, units: "page-pixels", ok, pages,
diagnostics}`. `revision` is the input bytes' SHA-256, matching file-session
revisions. Layout errors retain the report and exit 1; warnings alone exit 0.
Invalid input or arguments produce `ok: false`, empty `pages`, and an
`inspection-failed` diagnostic, without a revision or measurements.

The default `detail: "summary"` reports page size and grid counts, then one entry
per component in paint order: ID, kind, settled `box`, native `textLines` (an
array of regions, each containing its actual line strings), or artwork shape/
label counts. Drafts carry `draft: true`. Aligned groups report member IDs,
target boxes and combined bounds. Summary rectangles round to 0.01 px for
readability; layout and diagnostics are never rounded. All diagnostics and
their evidence remain present, even for artwork omitted from the summary.

Add `--details` for `detail: "full"` when repairing a particular page. Each page
then reports its ID, number, size, grid metrics, reading and paint orders:

- Components retain authored `area` and numeric `resolvedArea`, alongside `box`
  and padded `contentBox` from the scene, including settled group offsets.
  `draft` and `artworkScale` expose placeholders and fitted artwork.
- Groups retain member IDs, target `box` and combined content `bounds`.
  Geometry is null for groups without resolved alignment/painted content.
- `items` follow paint order. `paintIndex` is zero-based and report-local, not
  an editable ID. Page, component and vector element IDs locate authored data;
  generated decorations and draft items may share a component ID, and page
  numbers have no component ID.
- Shapes report their tag, page-space `bounds` and `clip`, without vector paths.
  Text reports its source, layout-origin `box`, `clip`, glyph `inkBounds`, type
  sizes, color and opacity. Every line includes its exact text, half-open UTF-16
  `start`/`end` in that item's source, advance-width `box`, absolute `baseline`,
  `inkBounds`, and actual `fontIds` from the font manifest. Empty lines remain;
  glyphless lines have null ink bounds. Multicolumn text has one item per region.

All rectangles and baselines are absolute page pixels at 1x, not viewport or
export pixels. Bounds precede clipping and later paint occlusion; they are not
visible-pixel bounds. Text ink uses glyph extents; shape/group bounds retain the
stroke-envelope and arc-approximation limitations described above. Diagnostics
are the same as `check`, including its finite-resolution contrast caveat. The
report is derived evidence, not a document to save back. Reread the composition
before repair, use stable IDs, and still render and inspect the PNG for appearance.

The implementation is in `grid.ts`, `schema-v2.ts`, `validate.ts`, `lower.ts`,
`scene.ts`, `text-layout.ts`, `inspect.ts`, `check.ts`, `svg.ts`, and `pdf.ts`. Generated
`draft-icons.json`, `schema-v2.json`, and the font manifest must stay synchronized
with their sources. Retained React/SVG files are drawing references only.
