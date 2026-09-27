# Composition contract

Konpeki 0.4 authors `konpeki-composition/v2`. Composition JSON is the editable
intent contract; the owned scene produced by `lower.ts` is the rendering contract
shared by the canvas, checks, SVG, PNG, and PDF writers. Unknown schema versions
are rejected. There is no supported v1 migration command.

## Grid and type

Each page chooses a fixed preset:

| Preset | Size | Columns × rows | Baseline |
| --- | --- | --- | --- |
| `presentation` | 1920×1080 | 12 × 78 | 12 px |
| `portrait` | 1080×1350 | 6 × 102 | 12 px |
| `link` | 1200×630 | 4 × 66 | 8 px |
| `square` | 1080×1080 | 6 × 80 | 12 px |
| `article` | 1600×600 | 8 × 63 | 8 px |
| `explainer` | 1200×1600 | 6 × 123 | 12 px |
| `gallery` | 1600×1000 | 12 × 72 | 12 px |

Components use `area: {column, span, row, rows}`. Starts are one-based integers
or `"center"`; spans are positive integers. Center placement requires the span
and the grid count to have the same parity on that axis. For example, a
12-column grid accepts centered spans 2, 4, 6…; the article preset's 63 rows
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

The implementation is in `grid.ts`, `schema-v2.ts`, `validate.ts`, `lower.ts`,
`scene.ts`, `text-layout.ts`, `check.ts`, `svg.ts`, and `pdf.ts`. Generated
`draft-icons.json`, `schema-v2.json`, and the font manifest must stay synchronized
with their sources. Retained React/SVG files are drawing references only.
