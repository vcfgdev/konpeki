# Visuals review

Owns diagrams, charts, imagery and containers. Apply the existing
[accuracy requirements](../../AUTHORING.md#requirements): verify arrow direction,
label/value associations, chart scales, asset provenance and faithful crops.
Text review verifies the underlying claims; this review checks their visual encoding.
Leave page arrangement to layout and color assignments to color/theme.

Apply the [mode table](../../AUTHORING.md#authoring-mode) first. The allowances
below for emphasis fills, framing, reinforcing arrows and filled heads apply to
dynamic mode or an explicit user direction; they do not override default mode's
original restrictions. Geometry and factual checks apply in both modes.

| Check | Guidance |
| --- | --- |
| Visual explanation | Would a diagram, image or annotated artifact make the relationships easier to grasp? Do not accept prose-only treatment merely because it is in bounds, or require a diagram when it adds nothing. |
| Purposeful boundaries | Judge whether surfaces improve grouping, emphasis or reading order in the chosen direction. Remove competing layers, not all layers that could be replaced by whitespace. Keep meaningful object boundaries and actual controls. |
| Rules and frames | Dividers must stop at the region they separate, not cross shared copy or subsequent sections. Give text clearance from borders and accent rules. Frames and rails may support grouping or emphasis; distinguish intentional treatment from accidental-looking missing edges. |
| Paragraphs versus rows | Apply the authoring boundary policy: independent text groups can use whitespace; corresponding table or paired rows may benefit from rules. If rules establish the rows, check for a clear ending before notes, usually a bottom rule. Do not require borders merely because text has columns. |
| Table ending versus page footer | A closing rule belongs to the table it ends. Do not extend it to the page bottom or add a second separator for generic metadata or a standalone page number. |
| Canvas padding | Check preview and requested export for unintended padding around differently proportioned artwork. Use the intended aspect ratio where supported or compose the surrounding space deliberately; intentional color bands are not a defect. |
| Emphasis backgrounds | Does the fill help the audience notice, group or navigate the content? Hierarchy, rhythm and emphasis are valid uses alongside state and evidence. Check contrast and avoid competing emphasis; when color encodes meaning, check that labels or symbols agree. |
| Connector endpoints | Every arrow needs an identifiable source and destination: a node, participant, lane or explicit continuation. Boxes are optional; meaningful attachment is not. Check what each endpoint refers to, not just its coordinates or alignment. Connectors should meet their intended anchors without stray tails or gaps; extend beyond them only to convey meaning. |
| Connector routing | Optimize for a clear, coherent route, not the fewest bends. Orthogonal corners are welcome when they support reading order, aligned entry/exit points or label placement. Remove needless doglegs, but do not replace useful elbows with awkward diagonal fans or detach a sequence rail from its stages. Place turns deliberately, with clearance from nodes, labels, boundaries and other connectors; avoid near-touches or crossings that imply unintended junctions. |
| Corresponding bends | For equivalent or mirrored relationships, check that turn positions, offsets and spacing align or mirror consistently. Preserve asymmetry when different endpoints, obstacles or meanings require it; do not add bends merely to force symmetry. |
| Arrow purpose | Check that arrows make the intended relationship easier to follow without implying unsupported transitions or dependencies. Reinforcing a relationship stated in words is useful when it speeds understanding, not automatically redundant. |
| Arrowheads | Open and filled heads are valid. Check consistency with the chosen notation, alignment with shafts, and clean joins without spikes, gaps or protruding stems. Inspect at full and review size. |

Inspect the render: DOM nesting alone cannot establish whether a boundary helps,
and an HTML card detector can miss nested SVG shapes.
Use the shared [review process](../visual-review.md#independent-review).
