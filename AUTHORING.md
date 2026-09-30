# Authoring taste

This guide owns editorial and visual judgment. For workflow steps, use the
[Konpeki skill](skills/konpeki/SKILL.md); for source and tool rules, use the
[HTML reference](html/README.md).

## Accuracy and editorial judgment

- Preserve facts, sources, units, denominators, bounds, and meaningful caveats.
  Distinguish evidence from interpretation; never invent data or filler.
- Give each page one identifiable audience question and state its main point in
  the headline. State the takeaway once; subtitles, captions and notes should
  add evidence or qualifications rather than repeat it.
- Keep names consistent and explain unfamiliar terms. Put citations, units, and
  caveats next to the evidence they qualify; preserve required attribution.
- Represent relationships honestly: correct arrow directions, clear label/value
  associations, appropriate chart scales, and zero baselines for amount bars.
  Never rely on color alone to carry meaning.
- If fixed page count and required content conflict, ask for a scope decision
  rather than dropping content or making it illegible.

## Adapt content to the format

Specify required facts per format, not on every page of a multi-format set.
A link card carries a headline, one supporting line and a date; a slide carries
one idea. Put the full workflow, availability and limits on the one-pager.
Keep a qualification wherever its claim appears, and retain required disclosure.
Preserve the same headline wording across announcement formats; change its
line breaks, not the promise. Avoid breaks that strand articles or prepositions.

Review link cards at about 500px wide, slides at presentation distance and print
pages at actual size. The minimum-size diagnostic is a floor, not a target for
body text. Use print running heads, page numbers and recurring source references
when they help navigate a multi-page document; remove repetitive metadata from
standalone graphics.

## Visual judgment

The brief, brand, and references choose the visual language, but never override
accuracy or readability. The selected theme owns repeatable treatments; this
guide and other design skills own their use. Konpeki's bundled default is cobalt
ink on warm paper. A different theme is an equally valid starting point.

For the default look, use square corners, precise alignment and an asymmetric
layout led by a strong headline. Avoid pill badges and decorative card stacks.
These are this theme's taste, not restrictions on a brief-specific theme or
meaningful chart geometry. A custom theme may carry short companion `NOTES.md`
with its own look-specific guidance.

Use complete type roles rather than accumulating near-identical treatments.
Choose spacing by relationship: keep evidence and its qualification close,
separate changes of subject more clearly, and align true peers. Align new columns,
indents and rules with an existing edge. Use the same rule treatment for the same
purpose. Let hierarchy
and composition do the work before adding panels or ornament. Color distinguishes
roles: accent for the main claim or path, muted ink for supporting copy,
categorical colors for identity, sequential colors for amount. Token compliance
does not establish good composition or honest visual encoding.

Start reading order with the main headline. Remove redundant eyebrows, section
labels, repeated metadata, and ornament that does not clarify structure. Keep
essential content readable at the intended viewing size; do not solve fit by
hiding overflow, truncating required copy, or shrinking type excessively.

Budget space for the headline, chart or table, sources and caveats together.
Prefer flow or grid rows over absolute positions for text that can wrap after a
theme swap. On contrasting fields, explicitly set the ink of nested type roles
and code too: their defaults may replace the parent's color.

Use diagrams, annotated artifacts, charts, or comparisons only when they make
real relationships easier to grasp. Do not invent causal, temporal, or
quantitative meaning. Use arrows sparingly and keep semantic colors consistent.
Use at most three box styles in a diagram, each with a semantic purpose. Give
peer nodes the same label size and weight. Scale arrowheads with line thickness
(`markerUnits="strokeWidth"` in SVG), and keep them clear of labels.

Resolve conflicts in this order: accuracy and readability; explicit content and
delivery constraints; specific visual direction; then these taste defaults.
Finished work is the default—do not impose a questionnaire, diagram choice, or
outline checkpoint unless the user asks for one.
