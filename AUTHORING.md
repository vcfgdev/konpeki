# Authoring visuals

Make visually compelling pages that explain the material clearly.
This file owns design guidance. The brief overrides taste defaults; preserve
accuracy and readability. Components, specimens and historical studies are
resources to adapt freely.

For ordinary work, deliver the editable composition and requested exports.
Read Requirements, Writing tone and Taste and creative freedom for new designs; consult
the remaining sections when the task needs them. Showcase records apply only
to contributed examples or an explicitly requested reproducibility record.

## Destination and surface

A single page is a complete creation. The brief may request a social graphic,
Open Graph preview, article header, standalone explanation, print document or presentation.
Choose page dimensions for that destination, within 256–4096 pixels per side;
do not assume 16:9 or invent extra pages. Record the destination in
`intendedViewingSize` (`social`, `article`, `presentation` or `custom`).
For another aspect ratio, recompose deliberately rather than stretching artwork,
silently cropping evidence or shrinking essential text. Each page can have its own size.

New documents use `grid.revision: 2` with one of the v2 presets: `presentation`,
`portrait`, `link`, `square`, `article`, `a4`, `explainer` and `gallery`. Choose
`a4` and destination `custom` for 210×297 mm print documents, including résumés,
one-pagers, letters and reports. It has print-scale typography and exact PDF
dimensions; compose each page explicitly, since text does not auto-paginate.
When reproducing a reference, preserve its destination, content and page count
unless an adaptation is requested. Revision 2
doubles columns, not rows. Existing pages without a revision retain their
original grid. Use `konpeki refine-grid`
to convert existing areas losslessly; never change the revision alone. Place each
component with an explicit `area` (`column`, `span`, `row`, `rows`). Starts are
one-based integers or `"center"`; centered spans must match the grid's parity.
Preset changes never recompose a page; adapt areas and copy deliberately. Baseline
rows are fixed, so more content does not make a component grow.

Declare alignment rather than calculating offsets. Native text accepts
`appearance.alignment` and `appearance.verticalAlignment`; artwork accepts
`customVisual.alignment` for horizontal fitting. Values are `start`, `center`,
or `end`. A group with an `area` and `verticalAlignment` aligns its members as
one unit, preserving their relative positions without reflowing them. Left
alignment and vertical centering are independent choices.

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
- In v2, use the seven named type steps (`fine`, `caption`, `body`, `lead`,
  `heading`, `title`, `display`) rather than arbitrary sizes. Role defaults may be
  overridden with `textStyle.step`; padding and leading use baseline units.
  Render-check fixed-height text after copy, font, padding or leading changes.
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
- For v2 vectors, bind colors and fonts to theme roles and use `scale:<step>` for
  vector font sizes. Keep geometry local to its component. Mark intentional
  overlap with `layer`, while treating `paintOrder` as authoritative stacking.
  Do not claim the grid automatically lays out topology or recomposes presets.

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

Use the single `default` authoring mode, including when the setting is omitted.
Without contrary direction, use a minimalist white canvas, dark sans-serif text
and one restrained main accent; additional semantic chart or status colors are
allowed. Build hierarchy through typography, placement and whitespace. Keep
containers restrained and purposeful, give subheadings clear typographic
emphasis, and keep text and data crisp. Use arrows only when relationships are
not already clear, with open stroked heads by default. Do not add decorative
top or bottom ribbons or side rails; compose surrounding space deliberately.

An explicit brief, brand, palette, typeface or visual reference overrides these
taste defaults, but never accuracy, factual fidelity or readability. Choose
explanation structure and depth from the source, audience and brief, not extra parameters. Tinted text cards
alone do not constitute a visual explanation. Never invent relationships or
supporting facts to satisfy a style.

Palette/background, font pairing, illustration style, audience, tone, delivery
format, viewing size and page count are brief choices or constraints. They are
not additional numeric knobs.
Do not expose separate container-count, arrow-count, hue, corner-radius or
"creativity" sliders: choose these implementation details to serve the brief.

Resolve conflicts in this order: accuracy/readability requirements, explicit
content and delivery constraints, specific visual directions, then taste defaults.
With a fixed page count, recompose or remove optional repetition
rather than shrinking text to fit; ask for a scope/page-count decision if required
content cannot fit legibly. Never silently drop it or add pages.

### Palette, type and visual explanation

For font-family choices, consider IBM Plex Sans for technical explanations,
Noto Sans for neutral typography or Hanken Grotesk for a product-oriented feel.
Reuse the project's established typeface when one exists. Inter is acceptable;
choose for readability, language coverage and fit with the brief rather than
novelty. These are suggestions, not a closed list. Keep font roles consistent
and verify the required weights load.

Choose a coherent deck-wide palette and treatment within the default taste or
explicit user direction. Keep font roles consistent and the reading order clear.
Keep chart and status meanings stable, and provide labels or other cues when a
distinction carries information. Keep emphasis and containers restrained unless
the brief directs otherwise.

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
centering it against a multiline paragraph. Verify that headings are
distinguishable from their supporting text.

Use arrows sparingly with open stroked heads by default. Keep their meaning and
treatment consistent, and
align anchors and labels with the objects they refer to. Do not imply a transition
or dependency that the evidence does not support.

Avoid decorative rails and framing; do not add recurring metadata strips merely
to fill space. Use the intended ratio where supported. Inspect both the preview
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

A completed visual includes editable source and inspected requested exports.
Keep substantial source facts and caveats alongside the document when needed;
do not require a prompt transcript or a saved review report for ordinary work.
Inspect renders at the intended viewing size and enlarged where needed. Check factual fidelity,
readability, clipping and visual relationships, plus coherence across pages and
any requested variants. Before delivery, inspect each page's reading order and
apply the [text review](design/review/text.md), including redundant hierarchy.
Readable, in-bounds text can still repeat the headline unnecessarily. Record
consequential findings and verification limitations in the delivery response.
Repair consequential issues and inspect fresh renders
before delivery. Use [development checks](docs/development.md#verification) for relevant code checks
and [focused visual review](design/visual-review.md) for applicable review guidance.
Specimen geometry assertions and aesthetic scores are not design requirements.
Do not add an aesthetic linter.

Report verification limitations and only behavior actually tested. Browser
images do not establish PDF/PPTX or cross-application fidelity. Inspect requested
exports separately; if a delivery target is unsupported, explain the limitation.

### Showcase records

For each new contributed example, save `slides/<name>/PROMPT.md` before authoring: the exact
initial prompt, supplied source material or links, and explicit visual preferences
(including none). Preserve creative follow-ups accurately and record material
assumptions and manual edits separately. Exclude private coordination transcripts,
agent/model identifiers, generation timestamps and environment metadata. Keep input
facts and datasets in `SOURCE.md` when substantial. These records explain why
the example looks and reads as it does, as well as supporting reproduction.
Mark adaptation prompts and reconstructed history honestly; do not invent an
original prompt for an inherited specimen. Never commit secrets or private
material without permission; record any redaction.

### Explore an uncertain direction

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
