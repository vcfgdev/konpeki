# Content and visual patterns

Read only the sections that occur in the work, after the
[shared guidance](../SKILL.md#before-authoring) and [authoring floor](../floor.md).
Choose by the audience's question, not a favorite layout. Plain text or an image
may be enough. Infer the form without asking the user to choose a diagram taxonomy;
preserve an explicitly requested form unless a change is agreed.

## Text with visuals

Use when text shares a composition with photography, screenshots, illustrations,
charts, diagrams, or other graphic elements, in any output format.

- Decide the visual's role: evidence, explanation, main subject, or atmosphere.
  A chart remains evidence even when it looks decorative. A screenshot may
  contain text the reader needs to read; budget for that at delivery size.
  Keep supporting text that adds meaning, not a caption just to fill a region.
- Plan the crop, focal subject, and text region together before filling the
  page. Keep text clear of faces, subjects, meaningful details, and data marks.
  Do not finish the visual and squeeze required copy into the remaining space.
- Use side-by-side regions when text and visual explain each other and both
  remain readable. Stack them when the format is narrow or the visual needs
  full width. Overlay text when the image has a suitable text region or its
  atmosphere should fill the composition. These are choices, not fixed templates.
- For two columns, give text the claim and interpretation, and the visual the
  evidence or explanation; avoid repetition. Allocate width for readable visual
  details and a useful text measure, not an automatic 50/50 split. Align meaningful
  anchors such as the headline and plot area, accounting for whitespace inside
  an image. Keep captions, units, legends, and sources with their visual. Recompose
  into stacked regions rather than squeezing both columns in a narrow format.
- First find a readable text region through placement: beside the visual or
  in quiet image space. Add an opaque field over an image only when needed for
  required text, not to demonstrate a treatment. Separate regions need not be
  cards, and white is only one field color. Set its ink explicitly, including
  nested type roles; a contrast field should not obscure meaningful content.
- Use local darkening or lightening to support text when the image can retain
  its meaning. Use an edge gradient or mask when an atmospheric image needs to
  blend into the surrounding field; a clean edge is equally valid. Apply the
  effect to the image or a separate overlay, never to the text or a shared
  parent. Do not use text shadows as a substitute for a readable region.
- Keep informational visuals intact. Do not fade chart marks or axes, hide
  screenshot details, or turn a meaningful diagram into background texture.
  Place explanations near what they qualify, with clearance from marks and
  labels. Preserve aspect ratio and meaningful relative scale; identify crops
  and alterations when they could change how evidence is interpreted.
- Review the final crop at delivery size and reduced size, not just enlarged.
  Include captions, sources, and qualifications in that review. Check local
  contrast under every line, subject visibility, effect boundaries, and whether
  the visual still communicates its purpose. Solid-color contrast checks cannot
  establish readability over images, gradients, or masks.

## Charts and quantities

- Choose the encoding for the question: comparison, change over time,
  distribution, or parts of a whole. Preserve units, denominators, time windows,
  uncertainty, missing values, and sources.
- Apply the floor's `honest-encoding` rule. Make scales explicit; distinguish
  a truncated axis from a complete magnitude. Keep scales consistent across
  charts meant to be compared.
- Derive mark lengths, areas, and positions from the supplied values, not visual
  guesses. For parts or branches, reconcile totals and explain any remainder.
- Keep labels near their marks and give annotations clearance from marks and
  axes. Do not turn uncertain or illustrative data into apparently measured
  precision.

## Tables

- Use a table for exact lookup or repeated attributes, not merely to position
  unrelated paragraphs. Name columns and units; align comparable numbers and
  use consistent precision. Distinguish zero, unavailable, and not applicable.
- Align short row labels with the first line of multiline descriptions. Let
  rows grow with content; do not hide a long cell to maintain equal heights.
- Use rules or fills when they clarify rows, groups, or totals. A table-ending
  rule belongs to the table, not the page footer. Keep notes clear of that rule.
- On continued tables, preserve complete rows and repeat the information needed
  to interpret the next page.

## Comparisons and decisions

- Compare options against the same criteria, units, and scope. Preserve material
  drawbacks and unknowns; do not invent scores to create a neat ranking.
- Align corresponding rows or measures so the reader need not reconstruct the
  mapping. Different evidence lengths do not require identical box heights.
- Make a recommendation distinguishable from the evidence. Keep its conditions
  near it rather than presenting a conditional choice as universally best.

## Processes and sequences

- Show inputs, actors or steps, outcomes, and meaningful blockers. Label branches
  and return paths; pending is not approved and retrying is not completed.
- Use arrows only for supported direction, dependency, or order. Preserve message
  order and named participants when time is the story. Label asynchronous work,
  failure paths, and guarded transitions when those distinctions matter.
- Give every connector an identifiable source and destination. Route it clear
  of labels and unrelated nodes; near-touches must not imply junctions. Useful
  elbows are preferable to diagonal fans or detached endpoints. Check arrowheads
  and shafts at delivery size, not just coordinate bounds.

## Systems and hierarchies

- Name entities, connections, and meaningful boundaries. Use enclosure only for
  actual containment, ownership, or scope; proximity alone must not invent one.
- Keep parent-child meaning consistent. Use a system map rather than a tree
  when shared ownership or cross-links are central to the explanation.
- Label connection meaning and direction. A static dependency map is not an
  execution trace; use a sequence when event order is the reader's question.
- Preserve specialized notation when requested. Draw it directly in HTML/SVG;
  do not invent a component schema or convert every relationship to one box type.

## Annotated details

- Retain enough context to locate the detail. Put labels near the relevant
  evidence and make crops or mockups explicit.
- Verify what the artifact actually demonstrates; do not add unsupported
  specifications or measurements. An annotation should clarify, not obscure.

Inspect the rendered pattern: are relationships, quantities, and labels clear
without narration? Browser overflow checks cannot establish their truth.
