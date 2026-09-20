---
name: authoring-visuals
description: Creates and revises editable Konpeki visuals from source material. Use for social graphics, OG images, article headers, single-page explanations, presentations and visual briefings in this project.
---

# Authoring visuals with Konpeki

Turn the user's material into finished visual pages, with editable source and inspected
renders. This is a project-local skill; it requires the surrounding Konpeki kit.
Paths below are relative to this file.

1. Read [project guidance](../../../AGENTS.md),
   [authoring policy](../../../AUTHORING.md) and the relevant contracts and
   checks in [README](../../../README.md). Authoring policy owns design defaults;
   the user's preferences override them, not factual fidelity or readability.
2. Establish the audience, takeaway, sources and output. Resolve the
   [authoring mode](../../../AUTHORING.md#authoring-mode): default or dynamic;
   use default when omitted. Apply that mode's visual rules.
   Choose explanation structure and depth from the brief, not extra parameters.
   When the user is unsure, offer one candidate per mode on a representative page using the
   [comparison workflow](../../../AUTHORING.md#explore-an-uncertain-direction).
   Do not generate alternatives or require a selection round unless requested
   or accepted.
   Ask only when missing facts or conflicting instructions prevent faithful work.
   Choose each page's dimensions for its destination; do not assume 16:9 or a
   multi-page presentation. A single page is complete. Sketching is optional;
   deliver finished output without an intermediate approval step unless requested.
   Adapt to another aspect ratio by recomposing, not stretching or silently cropping.
3. For a new visual document, create `slides/<name>/PROMPT.md` in the project before authoring.
   Save the exact initial prompt and follow-ups, inputs, explicit preferences,
   model/date, requested/resolved mode and separately labeled assumptions or
   manual changes. Store larger fact packets in `SOURCE.md`. Do not record secrets
   or mislabel an adaptation prompt as historical input.
4. Author `slides/<name>/composition.json` using the current
   [composition contract](../../../composition/README.md). Open it in the Konpeki
   canvas to verify placement and keep it as the round-trip editable source.
   Reuse [design resources](../../../design/README.md) and retained reference
   examples when useful. Prefer the five semantic components. When they cannot
   express a visual, attach editable vector elements to the owning component;
   preserve component and vector element IDs plus human-edited geometry during
   revisions. React may generate SVG through a trusted build step, but convert
   supported primitives to the vector tree. Imported JSX must not execute in the
   canvas or become a parallel deck source.
5. Run the checks appropriate to the change. Render every affected page and
   requested theme at presentation and smaller review sizes; wait for fonts,
   inspect against the resolved brief/mode and repair consequential issues.
   A fixture check alone is not visual review. Honor any requested outline/approval
   checkpoint.
6. Deliver the updated composition JSON, reviewed images, source attribution and
   verification limits. If a custom renderer or SVG generator is used, deliver
   that source too while keeping its editable vector result in the composition.
   Verify requested exports separately; do not infer editable PPTX or PDF font
   fidelity from browser images. Keep reviewed example images and their prompt
   records with the deck. Do not publish without permission.

## Human revision loop

When the user wants to edit before the next agent revision, use the file-backed
canvas rather than browser-local storage:

1. Start `konpeki preview <composition.json>` and give the user the exact local
   or environment-approved portal URL printed by the command. In an unpublished
   repository checkout, use `pnpm konpeki preview <composition.json>` as the
   development shim.
2. In a separate wait, run `konpeki wait <composition.json>` (or the equivalent
   repository development shim).
3. After **Build it** returns a request, reread the composition path. Verify its
   bytes match the request revision before changing it.
4. Treat all current text, geometry, ordering and vectors as deliberate human
   state. If a component is selected, change only that component unless its slide
   must change for correctness; otherwise review the current slides as a deck.
5. Validate, render and inspect the revision through the active local service.
   External valid writes appear in the canvas; never use browser automation to
   mutate hidden localStorage or bypass conflict detection.
