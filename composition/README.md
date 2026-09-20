# Composition contract

`konpeki-composition/v18` describes one or more bounded visual pages
shared by a person and coding agent. It is a visual intent contract, while the
Konpeki canvas is its editor and presentation preview. Component rectangles are
preferences; factual fidelity and readable
required content win. Every component supports an outer border treatment whose
default is `none`; rules/dividers are separate appearance parameters. Editor
guides never enter the contract. The contract is tool-agnostic: no Konpeki
package, repository checkout, or separate authoring kit is required.

Schema identifiers are immutable compatibility boundaries. New fields or
vocabularies that an older reader could reject require a new identifier. Konpeki
migrates compatible v1–v4 single-slide documents to a one-slide deck on import
or load. V1 and v2 obsolete
authoring-kit targets are removed; v3 callouts and comparisons become configured
Text blocks without changing component IDs, geometry, slots, relationships or
orders. V5 Evidence becomes Visual; Process and System map become a typed
Diagram; and the Page-number component becomes a slide setting. V7 makes the
Headline optional while retaining its singleton and reading-order constraints
when present. V8 adds standalone Image, Icon and Shape primitives, Pie visuals,
Text-block logical order and empty slides; v7 Image visuals migrate to Image
components. V9 adds a first-class Table primitive with content-derived dimensions,
header placement, grid treatment, density and color scheme. V10 adds optional
slide-coordinate preferred rectangles to explicit diagram nodes so circular,
branched and asymmetric topology can preserve authored geometry. V11 merges
Headline and Footnote into Text-block roles, renames Visual to Chart, moves Icon
and Shape into Diagram nodes, and renames Diagram `template` to `layout`. Schema
v12 replaces Diagram's coarse process/system and layout pair with 32 semantic
grammars adapted from the MIT-licensed Diagram Design taxonomy. The previous six
layouts become derived implementation engines; all v11 combinations migrate
deterministically. Diagram owns structural grammars while Chart owns the six
scale-based historical grammars (bar, line, radar, treemap, scatter and Sankey).
Pie and Annotated detail are additional Konpeki Chart grammars. V13 lets any of
the same five semantic components own an optional self-contained SVG interior.
V14 adds a structured vector interior: lines, shapes, paths and text have stable
IDs, editable attributes and parent relationships. Legacy SVG remains an opaque
compatibility fallback. The composition is authoritative for both outer geometry
and editable vector internals. V15 adds explicit theme bindings to vector styles;
v14 documents migrate with their literal styles unchanged. Current exports are
always v18. Consumers must reject unknown future versions rather than interpreting them as v18. The JSON
Schema `$id` and deterministic compiler version are versioned with this contract.

V18 adds Diagram and Chart `appearance.selection`: `auto` delegates form selection
to the agent; `explicit` makes the diagram type or chart template binding. Omission
means explicit, never permission to switch. New canvas diagrams and charts use auto.
Older documents migrate to explicit because their selection provenance is unknown.
Type/template, artwork and geometry remain
unchanged. The agent must ask before changing an explicit form or component kind,
and may not silently reset it to auto. This is a handoff requirement, not a runtime
permission barrier against arbitrary external file edits.
The form picker remains available for finished vectors and legacy SVG as well as
drafts. Changing the requirement preserves existing artwork; it does not redraw it.
Sankey topology cannot be discarded by selecting another template, even in Auto.

V17 makes each page's `canvas.width` and `canvas.height` integers from 256 to 4096.
`innerPadding` is nonnegative and must leave a content area. Component rectangles
must fit their owning page. `intendedViewingSize` accepts `presentation`, `social`,
`article` or `custom`. Existing v16 decks migrate without geometry or content changes.
The JSON key `slides` remains the ordered page collection for compatibility; it
does not restrict the document to presentations. Resizing does not transform content.

V16 gives ordinary Text blocks plain `content` and optional `textStyle`: size
(8–240 slide pixels), weight (400/500/600), lineHeight (1–3), color
(ink/muted/accent), and font (heading/body). Newlines are preserved and lines wrap
inside the component. Missing content is empty; new manually added blocks start
with editable “Text”. `intent` is separate agent guidance and never supplies live
displayed copy. Legacy non-vector blocks copy their formerly displayed intent to
content once on import; legacy custom visuals remain untouched. Custom visuals,
when present, still own rendering. Ordinary text should not use custom visuals.
Layout/purpose metadata from older drafts remains agent guidance rather than fake
placeholder lines. Use separate Text blocks when independently positioned copy is needed.

### Theme-linked vector styles

`fill`, `stroke`, and `color` accept `theme:ink`, `theme:muted`,
`theme:background`, `theme:surface`, `theme:divider`, `theme:accent`,
`theme:on-accent`, and `theme:wash`. `font-family` accepts `theme:heading-font`
and `theme:body-font`. These resolve from the deck theme in every canvas view.
Use on-accent for text over an accent fill. Heading fonts are IBM Plex Serif for
Editorial, Noto Sans for Precision, and IBM Plex Sans otherwise; body fonts are
Noto Sans for Precision and IBM Plex Sans otherwise.

Literal values are fixed overrides. SVG conversion preserves literals; it never
guesses roles from colors. Legacy raw SVG stays inert, fixed artwork. In the
vector inspector, enter a theme binding (suggestions are provided) to link a
style, or a literal to fix it. Theme changes do not resize or reflow vectors:
review text bounds after changing typography, and revise geometry explicitly.

New Konpeki documents define 112-unit left/right, 72-unit top, and zero bottom
`innerPadding`. The title bottom divider and footnote top divider use the same
inner width by default; the zero bottom value lets footer components use the same
placement rule as other components while ending at the page edge. Documents
created before this field remain valid and preserve their original geometry.

- `types.ts` defines the TypeScript API. `schema.ts` owns the constrained
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
