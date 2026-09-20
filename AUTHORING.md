# Authoring visuals

Make visually compelling pages that explain the material clearly.
This file owns design guidance. The brief overrides taste defaults; preserve
accuracy and readability. Components, specimens and historical studies are
resources to adapt freely.

## Destination and surface

A single page is a complete creation. The brief may request a social graphic,
Open Graph preview, article header, standalone explanation or presentation.
Choose page dimensions for that destination, within 256–4096 pixels per side;
do not assume 16:9 or invent extra pages. Record the destination in
`intendedViewingSize` (`social`, `article`, `presentation` or `custom`).
For another aspect ratio, recompose deliberately rather than stretching artwork,
silently cropping evidence or shrinking essential text. Each page can have its own size.

Return finished, inspected output by default. Do not require people to sketch,
choose component types or approve an outline unless they ask for that checkpoint.
Treat supplied sketches as partial direction and preserve deliberate human edits.
The slide-oriented guidance below also applies to single visual pages where relevant.

## Requirements

- Preserve facts, sources, units, denominators, bounds and meaningful caveats.
  Distinguish evidence from interpretation; never invent data or filler.
- Keep all essential content readable at the intended viewing size. Check
  captions and sources as carefully as body text. Do not hide overflow, truncate
  required copy or automatically shrink text to fit.
- Represent relationships honestly: correct arrow directions, clear label/value
  associations, appropriate chart scales and zero baselines for amount bars.
  Do not rely on color alone to distinguish meanings.
- Use licensed assets and real font weights; verify fonts load before measuring
  text.
- Keep slide order, outer component geometry, reading/paint order and semantic
  relationships in the Konpeki composition document. Use the same canvas for
  editing and presentation preview.
- When standard components cannot express the artwork, attach editable vector
  elements to the owning component. The composition owns both the component's
  outer geometry and stable IDs for its internal lines, shapes, paths and text.
  React may generate SVG in a trusted build step, but convert supported SVG
  primitives into the vector tree rather than making React a second deck source.

## Writing tone

Write like a builder explaining their work to a capable peer: plainspoken,
concrete and concise. Give each slide a main point and state it in the headline.
Cut hype, repetition and rhetorical “not X, but Y” framing. Keep names consistent,
explain unfamiliar terms and retain enough context to make sense without narration.

Start the slide's reading order with its main headline. By default, omit brand
eyebrows above it and section labels that repeat it. Do not add a numbered
micro-heading merely because the slide belongs to a sequence; retain numbers
when they explain actual steps or provide useful page navigation.
Keep an extra label only when removing it would lose necessary context,
navigation or required attribution, or when the user explicitly requests it.
Apply this test when composing shared slide frames as well as individual pages.

Omit recurring metadata footers by default. Put deck-wide product names,
generic source descriptions and provenance in the example's README/source record
or introduce them once where useful. Keep page-specific citations, units and
meaningful caveats next to the evidence they qualify; preserve legally required
attribution and make fictional data clear where it is presented. Useful page
numbers may stand alone without a footer strip or separator. A table's closing
rule ends the table, not the page; do not add a page-bottom rule for metadata.

Make each page answer one identifiable audience question. In a worked example,
carry named actors, current state and consequences through the explanation.
Explain what a choice changes: abstract labels such as “keep, revise or replace”
are not enough without their concrete outcomes. Place implementation requirements
with the mechanism they constrain and limitations with the claims they qualify;
do not turn an action-oriented page into an equal-weight collection of steps,
requirements and unrelated caveats. Preserve essential limitations visibly,
redistributing them across the deck rather than hiding them in notes. Use names
instead of pronouns when multiple actors make the reference ambiguous.

## Taste and creative freedom

### Authoring mode

Offer exactly two modes: `default` and `dynamic`. Use `default` when omitted.
Default preserves the pre-revision visual rules; dynamic removes the specific
restrictions listed below. It grants freedom, not a requirement to add decoration,
more colors or more diagrams. This is an authoring instruction, not a runtime
switch or a model-specific setting.

| Rule | `default` — original rules | `dynamic` — relaxed rules |
| --- | --- | --- |
| Unspecified theme | Minimalist white canvas, dark text, sans-serif and one restrained main accent. Beige and light violet only when requested. Additional semantic chart/status colors are allowed. | Same background, font and main-accent defaults. Expressiveness comes from composition and visual explanation, not an automatic theme change. |
| Emphasis and containers | Prefer typography, placement and whitespace. Keep containers restrained; use fills for state, meaningful boundaries or highlighted evidence, not decorative emphasis. | Color fields, tinted panels and shapes may also provide hierarchy, grouping, rhythm and emphasis. Remove competing layers, not containers as a category. |
| Subheadings | Give subheadings enough typographic emphasis to distinguish them from supporting text. | Hierarchy may also come from placement, color or grouping without extra type contrast. |
| Drawing style | Keep text/data crisp; Rough.js is opt-in by user or template choice. | Choose crisp or hand-drawn treatment to suit the direction; text/data remain legible. |
| Arrows | Use arrows for relationships that placement and wording do not already make clear. Default to open, stroked heads unless the user or notation calls for another form. | Arrows may reinforce prose when useful; open or filled heads are valid. |
| Framing | No decorative top/bottom ribbons or side rails. Match surrounding padding to differently proportioned artwork rather than adding contrasting bands. | Bands and rails may support composition or emphasis; compose surrounding space deliberately. |

Dynamic does not imply a dark or colored canvas. Make the composition more
expressive before changing the theme. Keep the white canvas and sans-serif
fallback unless the user supplies another direction; use accent fills locally
for emphasis, grouping or visual explanation rather than recoloring the page.

In both modes, explicit brand, palette, typeface and visual references override
taste defaults, never accuracy or readability. Choose explanation structure and
depth from the source, audience and brief, not extra parameters. Tinted text cards
alone do not constitute a visual explanation. Never invent relationships or
supporting facts to satisfy a mode.

Palette/background, font pairing, illustration style, audience, tone, delivery
format, viewing size and page count are brief choices or constraints. They are
not additional numeric knobs.
Do not expose separate container-count, arrow-count, hue, corner-radius or
"creativity" sliders: choose these implementation details to serve the brief.

Resolve conflicts in this order: accuracy/readability requirements, explicit
content and delivery constraints, specific visual directions, then authoring mode
and its default. With a fixed page count, recompose or remove optional repetition
rather than shrinking text to fit; ask for a scope/page-count decision if required
content cannot fit legibly. Never silently drop it or add pages.

Apply the mode deck-wide, with page-level variation where content warrants it.
Record the requested setting (or `unspecified`) and resolved setting in the adaptation
record in `PROMPT.md`, separately from verbatim user wording. Do not retroactively
label historical outputs as if they were generated with this parameter.

The parameter is usable through the existing authoring workflow, but its
reliability has not been established by earlier examples. Compare actual renders
on the same brief, not counts of shapes or an aesthetic score.

### Palette, type and visual explanation

For font-family choices, consider IBM Plex Sans for technical explanations,
Noto Sans for neutral typography or Hanken Grotesk for a product-oriented feel.
Reuse the project's established typeface when one exists. Inter is acceptable;
choose for readability, language coverage and fit with the brief rather than
novelty. These are suggestions, not a closed list. Keep font roles consistent
and verify the required weights load.

Choose a coherent deck-wide palette and treatment within the selected mode or
explicit user direction. Keep font roles consistent and the reading order clear.
Keep chart and status meanings stable, and provide labels or other cues when a
distinction carries information. Apply the mode table to emphasis and containers.

Consider a diagram, annotated artifact or visual comparison when relationships
are central to the point. Use it when it makes those relationships easier to
grasp, even if prose could describe them. Supporting words and visuals can
reinforce each other. Do not require a diagram on every page or invent causal,
temporal or quantitative meaning to justify one.

Use whitespace and alignment for independent paragraphs and heading–description
pairs; columns alone do not require borders. Use horizontal rules when they help
readers track corresponding items across columns. When rules establish table
rows or paired rows, give the group a clear ending before notes or conclusions,
usually a closing bottom rule. Do not add separators to every paragraph.
Align a short row heading with the first line of its description, rather than
centering it against a multiline paragraph. Apply the mode's subheading guidance
and verify that headings are distinguishable from their supporting text.

Use the mode's arrow policy. Keep arrow meaning and treatment consistent, and
align anchors and labels with the objects they refer to. Do not imply a transition
or dependency that the evidence does not support.

Use the mode's framing policy; do not add recurring metadata strips merely to
fill space. Use the intended ratio where supported. Inspect both the preview
and requested export.

Find optional themes, palettes and semantic patterns in the
[design index](design/README.md). Choose visuals for the audience's question
and the relationships to explain.

## Workflow and review

Ground the story in the brief and sources: audience, takeaway and delivery needs.
Use lightweight page drafts when they help resolve story, density or pacing;
they are not a required deliverable for every edit. State material assumptions
and proceed with reasonable composition choices within the design defaults.
Ask when missing evidence or conflicting requirements prevent a faithful result.
Honor an explicit draft-review checkpoint; otherwise continue to the requested output.

Reuse the kit where useful. Use deck-local SVG/React as trusted drawing source
when existing components weaken the explanation, then convert its supported
primitives to composition vectors. Do not replace the editable composition with
framework source. No new runtime or template framework is needed.

A completed slide implementation includes runnable source, source notes and
inspected captures at presentation and review sizes. Check factual fidelity,
readability, clipping and visual relationships, plus coherence across pages and
any requested variants. Before delivery, inspect each page's reading order and
apply the [text review](design/review/text.md), including redundant hierarchy.
Readable, in-bounds text can still repeat the headline unnecessarily. Record
the page-level evidence and repair findings without waiting for user feedback.
Repair consequential issues and inspect fresh renders
before delivery. Use [README](README.md#verification) for relevant code checks
and [focused visual review](design/visual-review.md) for applicable review guidance.
Specimen geometry assertions and aesthetic scores are not design requirements.
Do not add an aesthetic linter.

For each new example, save `slides/<name>/PROMPT.md` before authoring: the exact
initial prompt, supplied source material or links, and explicit visual preferences
(including none). Append follow-up prompts verbatim and record the agent/model,
generation date, material assumptions and manual edits separately. Keep input
facts and datasets in `SOURCE.md` when substantial. These records explain why
the example looks and reads as it does, as well as supporting reproduction.
Mark adaptation prompts and reconstructed history honestly; do not invent an
original prompt for an inherited specimen. Never commit secrets or private
material without permission; record any redaction.

Report verification limitations and only behavior actually tested. Browser
images do not establish PDF/PPTX or cross-application fidelity. Inspect requested
exports separately; if a delivery target is unsupported, explain the limitation.

### Explore an uncertain direction

When the user is unsure about the mode, offer two candidates of one representative
page: `default` and `dynamic`. Generate them when requested or accepted, not
automatically for every deck. Keep wording, evidence, caveats and viewing size
fixed. Honor the same explicit visual constraints; otherwise let each mode's
theme policy apply. Render and inspect both, label the modes and explain the
differences. Let the user choose before applying the mode across the deck.

When a design choice matters and the brief does not settle it, choose one page
and one primary axis: composition, density, hierarchy or wording. Render two or
three named alternatives with the same facts, evidence and chosen theme.
Vary the answer, not just the tint. For architecture, an ownership map, request
journey and failure-boundary view can test which structure explains the point.
Keep required relationships visible in every candidate.

Show candidates at the same viewing size and explain what each makes easier
and what it sacrifices. For an exploration-only request, recommend a direction
and let the user choose. When implementation is requested, choose and carry it
through unless the user requested a selection checkpoint.
Promote the selected direction and remove temporary comparison scaffolding;
retain alternatives only when requested. This is optional exploration, not a
required extra round for every deck.
