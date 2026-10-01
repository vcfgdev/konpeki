# Content and visual patterns

Read only the sections that occur in the work, after the
[shared guidance](../SKILL.md#before-authoring) and [authoring floor](../floor.md).
Choose by the audience's question, not a favorite layout. Plain text or an image
may be enough. Infer the form without asking the user to choose a diagram taxonomy;
preserve an explicitly requested form unless a change is agreed.

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
