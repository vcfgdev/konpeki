# Focused visual review

Choose the relevant categories for the work. Each owns its checks; shared
requirements remain in [AUTHORING](../AUTHORING.md). Apply judgment to the
content; no automatic bans or aesthetic score.

All categories apply the selected [authoring mode](../AUTHORING.md#authoring-mode)
and explicit brief. Default uses the original visual restrictions; dynamic
relaxes only the rules named in the mode table. That table takes precedence over
general suggestions below and in category guides. Do not impose default-only
restrictions on dynamic work or require dynamic work to add effects. Judge
explanation structure and depth against the source, audience and brief.
Correctness, readability and source fidelity remain non-negotiable in both modes.
Report a mode mismatch separately from a factual/access defect or taste preference.

| Category | Scope |
| --- | --- |
| [Text](review/text.md) | Meaning, claims, repetition and writing tone |
| [Typography](review/typography.md) | Font rendering, text hierarchy and reading comfort |
| [Layout](review/layout.md) | Composition, grouping, spacing and comparisons |
| [Color / theme](review/color-theme.md) | Deck-wide direction, contrast and semantic color roles |
| [Visuals](review/visuals.md) | Diagrams, charts, imagery and meaningful boundaries |

## Independent review

For a small change, review directly. When useful and subagents are available,
assign independent categories concurrently. Give each reviewer the same brief,
chosen direction, source and full/half-size renders, plus its category file.
Reviewers inspect their scope without editing files or reading each other's findings.

Return only meaningful findings: **priority · page/element · evidence · reader
impact · suggested fix**. Distinguish observed defects from design suggestions;
list checks not performed as **Not verified**, not as defects or passes.
An empty finding list is valid.
The coordinator deduplicates cross-category issues, resolves conflicting fixes
against the brief, and checks narrative flow and deck coherence. Report a shared
root cause once, naming affected pages. Apply fixes in one editing pass,
then re-render affected pages and repeat relevant checks.

## Repair order

1. **Accuracy:** factual errors, misleading scales, missing qualifications and
   incorrect relationships.
2. **Access to content:** unreadable, missing or clipped essential content,
   color-only meaning and inaccessible interactions when present.
3. **Understanding:** grouping, reading order, hierarchy and deck coherence.
4. **Polish:** optical alignment, decorative details and surface consistency.

Judge whether the treatment helps the audience, not whether it could be removed.
A repair may add a diagram, color field or annotation, or remove competing
material. Reuse existing primitives where useful; never delete required evidence to improve fit.
Repair upstream causes first: a cramped region may need recomposition rather
than separate font-size, line-break and padding changes.

### Repair examples

These are diagnostic examples, not measured findings or mandatory layouts.
Render the repair with real content to judge whether it helps.

| Before | After | Why |
| --- | --- | --- |
| A heading sits equally far from the preceding section and its own paragraph. | Move it nearer its paragraph and increase separation from the preceding section. | Proximity makes ownership clear without another box. |
| A wide diagram leaves its evidence and caveat in tiny side text. | Give the evidence a larger region or split the page while retaining the qualification. | Essential context becomes readable without shrinking the diagram's labels. |
| A large value dominates a faint unit and denominator. | Keep unit and denominator adjacent and readable; reduce the value's dominance if needed. | The reader can interpret the number rather than just notice it. |
| Every sentence sits in an equally prominent nested panel. | Reduce competing layers; retain surfaces that support grouping, emphasis or the chosen direction. | The audience can distinguish the main point from supporting material. |
| A prose list makes readers reconstruct a request journey. | Draw the named participants and labeled connections, retaining useful explanatory copy. | Relationships become easier to follow even though words already describe them. |

## Accessibility and delivery

Apply checks to the requested format, at its actual viewing size. These are
delivery checks, not a claim of full accessibility conformance.
The author (or coordinator when review is delegated) owns this checklist and
records evidence or **Not verified** for every applicable check.

- Check captions, sources, units and caveats as carefully as the headline.
  Keep category and state meanings available through labels, shapes or patterns,
  not color alone. Measure contrast on actual surfaces; see [color review](review/color-theme.md).
- For browser slides, provide meaningful accessible descriptions or a text
  equivalent for visual content. Check reading order and that chart alternatives
  convey the conclusion and relevant values, not merely “chart.” Confirm the
  content is exposed in the accessibility tree; source markup alone is insufficient.
- When controls or motion are included, exercise keyboard navigation, visible
  focus and accessible control names. Check the reduced-motion path and ensure
  state changes remain understandable without animation. Keep runtime fixes
  upstream rather than building a second navigation or export system.
- Inspect each requested export for text, fonts, reading order and alternatives
  as applicable. Browser/PNG success does not establish accessible PDF/PPTX or
  cross-application fidelity. Report unsupported or untested delivery properties.
