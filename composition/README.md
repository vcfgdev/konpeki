# Composition contract

Konpeki 0.4 authors `konpeki-composition/v2`. Composition JSON is the editable
intent contract; the owned scene produced by `lower.ts` is the rendering contract
shared by the canvas, checks, SVG, PNG, and PDF writers. Unknown schema versions
are rejected. There is no supported v1 migration command.

## Source defaults

Canonical v2 documents use one top-level `pages` array. Do not author `slides`;
legacy documents with `slides` and no `pages` are accepted only at import, while
documents containing both keys are rejected. Components do not have an `intent`
field; legacy imports discard it, and subsequent saves use only `pages`.
Put visible wording in `content` and revision requests in the brief or review
comments, not in a replacement component field.

Use the single `default` authoring mode, or omit `authoringMode`. The removed
`dynamic` value is invalid; remove it or replace it with `default` in older files.
The brief or reference overrides aesthetic defaults, not factual fidelity or
readability requirements.

Omit unused page `contentSlots`, `groups`, and `relationships`, and component
`slotIds`; validation supplies empty arrays. Do not create semantic slots just
to duplicate visible copy. Keep slots when topology or other semantic references
need them.

Omitted `readingOrder` and `paintOrder` independently default to component-array
order. Supply an explicit order when reading and stacking differ, or when reading
order uses groups. Explicit values are never repaired or replaced: empty orders
with components, invalid values, and unresolved references remain errors.
Normalization does not mutate the input or invent content, relationships, or
topology. Validated documents contain the full arrays used by the renderer and
editor; saving may write those defaults back into the JSON.

## Text flow

Sequential native text belongs in a group with `layout: "stack"`. List existing
component IDs in `childIds` in top-to-bottom order; omit each member's `rect`.
The group fills the page's content margins unless it has its own `rect` for a
column or section. A paragraph needs content and appearance, not a guessed height
or vertical coordinate. For example, within a page:

```json
{
  "groups": [{ "id": "body", "layout": "stack", "childIds": ["intro", "detail"] }],
  "components": [
    { "id": "intro", "kind": "text-block", "content": "First paragraph.", "appearance": { "role": "body" } },
    { "id": "detail", "kind": "text-block", "content": "The next paragraph follows the measured text.", "appearance": { "role": "body" } }
  ]
}
```

Each block wraps at the group width minus twice its padding. Its height is the
measured line count × leading + twice the padding; later blocks move when text,
fonts, leading, padding, or the group width changes. This is the line-layout box,
including leading and padding, not a snug bound around visible glyph ink.
`inspect --details` exposes glyph `inkBounds` separately. The default gap is half
the preset body leading (10 px on A4), doubled
before `heading`, `title` and `display` steps. There is no default gap before the
first block or after the last. Optional group `gap` replaces the base gap;
optional member `flow.gapBefore` replaces the entire preceding gap, including on
the first block. Both are nonnegative page pixels and may be fractional.

Stack members must be native, single-region text without custom artwork or a
vertical-alignment override other than `start`. They may use text styles, horizontal
alignment, padding and borders/rules. Positioned components can coexist on the
same page, outside the stack. A component belongs to at most one group. Layout
order is independent of `paintOrder` and `readingOrder`; set those explicitly when
they differ from component-array order. Nested stacks and automatic pagination
are not supported. Stack overflow is a `group-overflow` error: no shrinking,
truncation, hidden extra page, or automatic redistribution of remaining space.

The canvas uses the measured boxes for selection, text correction and comment
pins. Deletion closes the gap. Moving a member saves `flow.offset: {x, y}` in page
pixels relative to its automatic position, using the normal 1 px correction step;
it preserves the member's place in the flow rather than inserting blank space.
Offsets survive copy changes and may need review for overlap. Remove `offset` to
restore automatic placement. Flow members have no fixed-height resize handles;
change the group's width in source to rewrap them. All writers and `inspect`
share the same layout. Derived boxes are never saved as member rectangles.

## Pixels and type

New pages use free page-pixel placement, not a mandatory grid. Supply
`canvas: {width, height}` with each side from 256 through 4096, inclusive, or an
optional named `preset`. Values may be fractional. Presets provide dimensions,
default margins, and typography; when both are present, `canvas` overrides only
the preset dimensions. Available presets are `presentation`, `portrait`, `link`,
`square`, `article`, `a4`, `explainer`, and `gallery`.

`a4` uses exact millimetres converted to CSS pixels at 96 dpi (approximately
793.70×1122.52 px), with roughly 15 mm margins and 16 px gutters. PDF preserves
210×297 mm; PNG uses a rounded 794×1123 base raster, or 1588×2246 at 2×. Its
fine-through-display sizes are 10/12/14/18/24/32/44 px, with leading
14/16/20/24/30/38/50 px. Body text is 10.5 pt in PDF. Use `custom` as its
`intendedViewingSize`. Text flow is opt-in through stack groups; page breaks
remain explicitly composed. Legacy `grid`/`area` pages remain a lossless import
format. The loader converts them to page pixels, and subsequent saves use the
new `canvas`/`preset`, component `rect`, and group `rect` representation.

Positioned components use `rect: {x, y, width, height}` in page pixels. Native,
single-region text may omit `height`; its measured height is line count × leading
+ twice the padding. Custom visuals and multiregion text require height. Groups
use `rect`, not `area`. The editor moves and resizes by exactly 1 page pixel on
both axes and does not snap to columns, margins, or preset baselines. Preset
changes never stretch or automatically recompose content.

While dragging or resizing, reference lines mark nearby component edges and
centers, page centers, and margins. They are visual guides, not magnetic snaps,
and disappear on release. Moving or horizontally resizing auto-height text keeps
its height measured; explicitly resizing vertically saves a fixed height.

The type steps are `fine`, `caption`, `body`, `lead`, `heading`, `title`, and
`display`. Role defaults are footnote→fine, caption→caption, body→body,
subtitle→lead, and title→title. `textStyle.step` remains an optional named
override. `textStyle.size` accepts page-pixel values from 1 through 4096.
`textStyle.leading` and component `padding` are page
pixels, may be fractional, and leading must not be smaller than the type size.
Without an override, the preset's leading table supplies the line height for
named steps; an explicit size instead defaults to 1.4 × size.
Native text accepts `appearance.verticalAlignment: "start" | "center" | "end"`.
The default is `end` for titles and `start` for other roles. Start and end align
the line boxes; overlong end-aligned text starts at the top and reports overflow.
Center aligns the first line's cap top through the last baseline, using the
font manifest's cap height. It excludes half-leading and descenders, applies
within each padded text region, and adds no optical lift. Overlong centered
text remains centered and reports clipping.

Groups may pair a `rect` with `verticalAlignment` to translate their members
together. Group alignment uses text glyph ink and shape geometry, rather than
empty component cells; strokes use half-width envelopes (not exact miter/dash
outlines), and SVG arcs use the path library's cubic approximation. It preserves
paint order, member clips, relative authored positions and IDs. It is not a
stack layout: changing copy recomputes the offset but does not reflow neighbours.
Selection, editing overlays and pins use the translated scene geometry; saved
member rectangles never contain the derived offset. The GitHub cover demonstrates
a centered `brand-stack` group on the link preset.

During pointer drags, resizes and held arrow-key edits, the editor freezes the
group's offset and outlines its target rectangle. It recomputes alignment on
release or interruption, so edge members track the gesture instead of moving at half
speed. The override is transient; saved documents and exports use settled
alignment. Ink-based offsets may be fractional, so aligned members need not sit
on integer pixels. Use group alignment deliberately where centering matters.

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
font sizes use `scale:<step>` or a positive numeric page-pixel value. Supported primitives include groups, rectangles,
circles, ellipses, lines, polylines, polygons, paths, text, and tspans. Outlined
shapes remain outlines in SVG and PNG. Standard diagram, chart, and table artwork
is a draft until deliberately authored and may be flagged as such.
Unless `processFlow` is explicitly enabled, unauthored topology shows a neutral reserved area and node/edge counts, not an
inferred diagram. The topology remains in the document for authoring; the draft
is not a finished representation of its relationships.

`customVisual.alignment: "start" | "center" | "end"` positions fitted artwork
horizontally inside its padded cell; the default is `center`. Contain uses spare
width, cover chooses which side to crop, and stretch fills the width regardless
of alignment. Shapes and labels move together; vertical fitting stays centered.
This is independent of native text's `appearance.alignment`. The cover combines
left-aligned text and artwork with a vertically centered group.

Labels allow `x`, `y`, `text-anchor`, `fill`, `font-family`, `font-size` (a named
type step or positive pixel number), `font-weight`, and `font-style`. Tspans are
whole lines with explicit
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

## Semantic process flows

For a chain or one two-way decision, a `diagram` with appearance type `process`
or `flowchart` may opt into `processFlow: {direction: "right" | "down"}`.
Keep the existing component rectangle, slot IDs, and explicit topology; omit
`customVisual`. Node text comes from the matching content slot's `label`, not its
instruction. Every node and edge needs a distinct stable ID within the component.
Both decision edges need distinct, nonempty labels. Edge order chooses branch
order (top/bottom or left/right); node-array order does not determine flow order.

```json
{
  "id": "approval", "kind": "diagram",
  "rect": {"x": 72, "y": 144, "width": 1776, "height": 576},
  "slotIds": ["request", "accept", "decline"],
  "appearance": {"type": "process"},
  "processFlow": {"direction": "right"},
  "topology": {
    "kind": "explicit",
    "nodes": [
      {"id": "decision", "slotId": "request"},
      {"id": "accepted", "slotId": "accept"},
      {"id": "declined", "slotId": "decline"}
    ],
    "edges": [
      {"id": "yes", "from": "decision", "to": "accepted", "label": "Yes"},
      {"id": "no", "from": "decision", "to": "declined", "label": "No"}
    ]
  }
}
```

This component example fits the presentation preset; its page must also
declare the three content slots and include `approval` in reading/paint order.
The renderer measures caption-step text, grows boxes vertically, and derives
orthogonal routes and open arrowheads. It never shrinks text or saves generated
vectors. Existing custom artwork and non-opted-in diagrams remain unchanged.
Only one connected, acyclic chain with at most one fork is supported: no joins,
loops, nested decisions, hidden nodes, or custom node primitives.

In the canvas, select the component and drag a step or use arrow keys. This saves
only that topology node's `position: {x, y}` in content-local page pixels, measured
from the component's padded top-left. Positions survive text edits, insertion of
other steps, component moves/resizes, and direction changes; they do not scale
or move automatically. Delete/Backspace on a focused step clears its override;
**Reset step positions** clears all overrides. Other steps remain derived.

`inspect` exposes `processNodes` with stable IDs, labels, absolute page-space boxes,
and `pinned` flags. Never save those derived boxes back into the composition.
`process-layout` errors identify overflowing/overlapping nodes, backward or
obstructed connections, and overflowing/overlapping edge labels. Recompose or
enlarge the rectangle instead of suppressing errors. These checks do not prove
general graph readability; visually review the rendered result and requested exports.

## Fonts, checks, and writers

Bundled fonts cover Latin, accents, and symbols. Unsupported glyphs produce
`missing-glyph` errors rather than silent fallback. Text is shaped once and its
glyph stream is shared by the scene writers. PDF embeds deterministic subsets and
maps text for selection; pages may have mixed dimensions.

`validateComposition` checks the v2 structure and cross references.
`checkPage`/`checkPageNode` report stable diagnostics for overflow, clipped
labels, missing glyphs, draft artwork, scaled charts, and text contrast.
`group-overflow` names the group ID when aligned contents exceed its rectangle;
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

The default `detail: "summary"` reports page size and metrics, then one entry
per component in paint order: ID, kind, settled `box`, native `textLines` (an
array of regions, each containing its actual line strings), or artwork shape/
label counts. Drafts carry `draft: true`. Aligned groups report member IDs,
target boxes and combined bounds. Summary rectangles round to 0.01 px for
readability; layout and diagnostics are never rounded. All diagnostics and
their evidence remain present, even for artwork omitted from the summary.

Add `--details` for `detail: "full"` when repairing a particular page. Each page
then reports its ID, number, size, page metrics, reading and paint orders:

- Components retain authored `rect` alongside `box`
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
