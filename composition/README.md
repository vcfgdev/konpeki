# Composition contract

Konpeki supports two composition schemas for bounded visual pages shared by a
person and coding agent. `konpeki-composition/v2` is the grid contract used by
new browser documents. `konpeki-composition/v1` remains supported and immutable;
its free-positioned details are retained below as legacy behavior. The composition
is a visual intent contract, while the Konpeki canvas is its editor and
presentation preview. Factual fidelity and readable required content win.

Schema identifiers are immutable compatibility boundaries and unknown versions
are rejected. v2 has its own JSON Schema and handoff behavior; it does not mutate
the v1 schema. The existing published skill blank and pinned release runtime still
use v1 compatibility until a v2-capable release is published.

Both contracts have five semantic component kinds: Text block, Diagram, Chart,
Image and Table. Structured lines, shapes, paths and text have stable IDs,
editable attributes and parent relationships. v1 components may own structured
vectors or self-contained SVG; opaque SVG remains its supported fallback. v2
components use theme-bound structured vectors only. The composition is
authoritative for both outer geometry and editable vector internals.

Diagram and Chart `appearance.selection` controls form choice: `auto` delegates
selection to the agent; `explicit` makes the diagram type or chart template
binding. Omission means explicit, never permission to switch. New canvas diagrams
and charts use auto. The agent must ask before changing an explicit form or
component kind, and may not silently reset it to auto. This is a handoff
requirement, not a runtime permission barrier against arbitrary external file edits.
The form picker remains available for finished vectors and opaque SVG as well as
drafts. Changing the requirement preserves existing artwork; it does not redraw it.
Sankey topology cannot be discarded by selecting another template, even in Auto.

## Grid contract (v2)

Each page selects one fixed preset in `grid.preset`: `presentation`, `portrait`,
`link`, `square`, `article`, `explainer` or `gallery`. A preset fixes the page
dimensions, margins, columns, gutters, baseline and seven-step type scale. It also
fixes the finite baseline-row count; rows do not grow to fit content. Changing a
preset does not stretch, crop or recompose the page. Revise areas and content
deliberately when the new grid does not fit.

| Preset | Page size | Columns × rows | Baseline |
| --- | --- | --- | --- |
| `presentation` | 1920×1080 | 12 × 78 | 12 px |
| `portrait` | 1080×1350 | 6 × 102 | 12 px |
| `link` | 1200×630 | 4 × 66 | 8 px |
| `square` | 1080×1080 | 6 × 80 | 12 px |
| `article` | 1600×600 | 8 × 63 | 8 px |
| `explainer` | 1200×1600 | 6 × 123 | 12 px |
| `gallery` | 1600×1000 | 12 × 72 | 12 px |

These are provisional destination choices, not results of a blind authoring
comparison. Rows use the available height inside the margins, rounded down to
whole baseline units. See `grid.ts` for margins, gutters and type sizes.

Every component has a one-based `area` with `column`, `span`, `row` and `rows`.
These authored values are authoritative; the canvas derives placement with CSS
Grid. Do not write v1 `canvas`, `innerPadding` or `preferredRect` fields in v2.
There is no automatic layout or topology solver. Topology records semantic nodes
and edges, not a second set of v2 node coordinates.

The seven hand-tuned text steps, from smallest to largest, are `fine`, `caption`,
`body`, `lead`, `heading`, `title` and `display`. Role defaults are footnote→fine,
caption→caption, body→body, subtitle→lead and title→title. `textStyle.step`
overrides that default. Each preset maps the named steps to its own pixel sizes;
authors do not write `textStyle.size` or `textStyle.lineHeight`. Optional
`textStyle.leading` overrides are positive whole baseline units. Without an
override, the preset supplies a hand-tuned line height for each step, in 4px
increments rather than rounding every line up to a layout row. Presentation
fine/caption/title are 20/24, 24/32 and 60/68 (type size/line height in pixels).
These defaults stay derived, not stored in the document; choose **Preset**
in the inspector to remove an override. Component `padding` is likewise measured
in whole baseline units on every side and must leave a positive
content area. Fixed-height text still requires rendered overflow checks.

v2 custom artwork is structured vector data only. Colors must use theme roles,
font families must use `theme:heading-font` or `theme:body-font`, and vector text
uses `font-size: "scale:<step>"`. Omitted vector sizes inherit the parent's step,
defaulting to `caption`; omitted fill and font inherit theme ink and body font.
The browser's SVG transform matrix keeps type height at the named page size,
including padded cells and nested transforms. Avoid nonuniform scaling or
`fit: "stretch"` for text-bearing artwork: these still distort glyph proportions.
Vector coordinates remain local to the owning component.
Mark components that intentionally overlap with `layer: "background"`
or `layer: "overlay"`; this documents intent but does not choose stacking.
`paintOrder` remains the authoritative back-to-front order.

The current examples need background layers for rules/panels and local vector
geometry for artwork. They need no off-grid component rectangles. Full-bleed
placement outside preset margins is not supported in this iteration. Charts and
tables still use the existing semantic drafts or authored artwork; data-driven
rendering and automatic topology layout remain separate decisions.

The implementation source is `grid.ts`, `schema-v2.ts`, `validate.ts`,
`compile.ts` and the canvas renderer. `schema-v2.ts` derives shared semantic
vocabulary from a clone of v1 rather than changing v1. Validation rejects areas
outside the preset grid, padding that consumes the content area, and leading
smaller than the type size. The handoff reports the selected preset and its exact
scale and requires deliberate recomposition rather than implying an automatic
one.

## Legacy free-positioned contract (v1)

Each page's `canvas.width` and `canvas.height` are integers from 256 to 4096.
`innerPadding` is nonnegative and must leave a content area. Component rectangles
must fit their owning page. `intendedViewingSize` accepts `presentation`, `social`,
`article` or `custom`.
The JSON key `slides` remains the ordered page collection for compatibility; it
does not restrict the document to presentations. Resizing does not transform content.

Ordinary Text blocks have plain `content` and optional `textStyle`: size
(8–240 slide pixels), weight (400/500/600), lineHeight (1–3), color
(ink/muted/accent), and font (heading/body). Newlines are preserved and lines wrap
inside the component. Missing content is empty; new manually added blocks start
with editable “Text”. `intent` is separate agent guidance and never supplies live
displayed copy. Custom visuals, when present, still own rendering. Ordinary text
should not use custom visuals. Layout and purpose metadata remains agent guidance
rather than displayed copy. Use separate Text blocks when independently positioned
copy is needed.

### Legacy theme-linked vector styles

`fill`, `stroke`, and `color` accept `theme:ink`, `theme:muted`,
`theme:background`, `theme:surface`, `theme:divider`, `theme:accent`,
`theme:on-accent`, and `theme:wash`. `font-family` accepts `theme:heading-font`
and `theme:body-font`. These resolve from the deck theme in every canvas view.
Use on-accent for text over an accent fill. `theme.typography` independently selects
`plex-sans` (IBM Plex Sans throughout), `noto-sans` (Noto Sans throughout),
`plex-serif` (IBM Plex Serif headings / IBM Plex Sans body), or `hanken-grotesk`
(Hanken Grotesk throughout). `theme.id` still selects the color palette and
`theme.mode` selects Paper or Night. For example:

```json
{ "id": "green", "mode": "paper", "typography": "noto-sans" }
```

Omitting typography preserves the legacy pairing: Precision uses Noto Sans;
Editorial uses Plex Serif headings and Plex Sans body; other palettes use Plex
Sans. When revising colors, retain the current typography explicitly so changing
the palette does not change fonts. The editor does this automatically. Older
runtimes that do not support `theme.typography` reject documents containing it;
use a compatible runtime rather than removing the field and changing appearance.

Literal values are fixed overrides. SVG conversion preserves literals; it never
guesses roles from colors. Legacy raw SVG stays inert, fixed artwork. In the
vector inspector, enter a theme binding (suggestions are provided) to link a
style, or a literal to fix it. Theme changes do not resize or reflow vectors:
review text bounds after changing typography, and revise geometry explicitly.

Legacy v1 documents created by the v1 blank define 112-unit left/right, 72-unit top, and zero bottom
`innerPadding`. The title bottom divider and footnote top divider use the same
inner width by default; the zero bottom value lets footer components use the same
placement rule as other components while ending at the page edge. Documents
created before this field remain valid and preserve their original geometry.

- For v1, `types.ts` defines the TypeScript API and `schema.ts` owns the constrained
  vocabulary and generates `schema.json` (JSON Schema draft 2020-12).
- `validateComposition(unknown)` returns `{ ok, document }` or `{ ok, issues }`.
  `assertComposition` throws on invalid input. The runtime uses the public schema
  and adds cross-reference, order, geometry and topology checks that standard
  JSON Schema cannot express.
- A deck contains at least one named slide with a unique slide ID. A slide may be
  empty. Within each slide, the five top-level component kinds are Text block,
  Chart, Diagram, Image and Table. Agents derive table rows, columns and headers
  from supplied content; the canvas's standard table illustration is a draft,
  not a cell-data renderer. Konpeki presents four structural rule templates and density;
  table highlights remain an agent decision grounded in the content and prompt.
  The underlying optional header, grid, border and color fields remain compatible
  with imported v9–v13 documents. Any of the five kinds may carry a `customVisual`
  vector tree when its standard preview cannot express the needed artwork.
  The tree supports groups, rectangles, circles, ellipses, lines, polylines,
  polygons, paths, text and tspans. Parents precede their descendants. Groups
  contain shapes/text/groups; text and tspans contain only tspans. Array order
  determines sibling paint order. Empty vector arrays are valid after deleting
  the final element. Raw v13 SVG remains inert, never executes JSX,
  and should be converted when revised. The declared view box plus fit mode
  determine how either representation fills the preserved outer rectangle. The slide-level page-number setting,
  edited through the Slide inspector, supports hidden,
  `01` and `01/02` plus semantic ink, muted and accent colors. Text blocks cover narrative,
  comparison and emphasis purposes with plain, subtle or strong treatments. They
  support single, two-, three- and four-column layouts, a two-plus-two grid, and
  horizontal or vertical one-plus-three and three-plus-one block arrangements.
  Text blocks record a typography role (title, subtitle, body, caption or
  footnote) and an independent logical order: none, parallel,
  progressive, cyclical, general-to-specific or hierarchical.
  `readingOrder` is an array of `{ kind: 'component' | 'group', id }`; expanding
  non-nested group `childIds`
  must visit each component once. `paintOrder` is an independent exact
  permutation of component IDs. Groups mean move together, not containment.
- Relationships preserve kind, direction and component/optional slot endpoints.
  Diagram retains its existing type vocabulary plus explicit `nodes`/`edges`.
  Auto is the default in the inspector; selecting a type sets selection to explicit.
  Returning to Auto is a deliberate action. The serialized `appearance.type`
  remains required for rendering in both modes. In Auto, the agent infers the
  form from the goal and updates its type while retaining auto. Explicit notation
  in the intent or brief must also be honored, even in Auto.
  Each starting point supplies expression guidance and derives one of six
  internal layout engines. Nodes may carry editable shape or icon primitives.
  Explicit nodes may carry slide-coordinate preferred rectangles, which must
  remain within the parent Diagram rectangle.
  Node slots must exactly cover their component slots. Node IDs and node slots
  are unique, endpoints exist, self-edges and duplicate labeled edges are
  rejected. Different labels on parallel edges are intentional (request/poll).
  **Render every recorded edge as a visible connection; nearby prose is not a
  substitute.** Topology has 1–24 nodes and 0–48 edges.
- Sankey is Chart-owned because ribbon width encodes quantity. Sankey Charts may
  carry the same explicit node/edge topology so imported flow structure remains
  lossless. Interim v12 Sankey Diagrams normalize to Charts during validation.
- Theme (`plex` by default, `paper`/`night`) and authoring mode (`default` or
  `dynamic`) are independent.
- `compileHandoff(unknown)` validates then emits deterministic Markdown with
  a concise per-slide plan, guidance only for component kinds in the deck, and
  recursively sorted canonical JSON. Arrays retain their exact semantic order.
  The plan derives placement from preferred geometry but uses explicit groups,
  reading order, paint order, relationships and topology as authoritative.
  The handoff is self-contained and states the exact four-block meaning of
  horizontal/vertical one-plus-three and three-plus-one Text layouts.
  It requires an agent to return an updated current-schema composition so its
  layout draft can be opened, previewed and revised on the same canvas. A custom
  polished render may accompany that document and may exceed its vocabulary.
  It adds no timestamps, generated facts, hidden guides or execution side effects.

Run `pnpm composition:generate` after changing schema or fixtures; `pnpm test`
checks generated files against source. The five fixtures are clearly labeled
reconstructions of fictional scenarios, not original experimental outputs or
evidence of authoring performance. Use them to exercise the composition contract.
