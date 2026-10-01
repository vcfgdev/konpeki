# Authoring floor

Read this immediately before writing or revising HTML. These are the rules
agents break when working from habit. Each has an ID. `inspect` reports the
`(inspect)` rules as diagnostics under the same code, and `render` prints the
`(review)` rules as the checklist for looking at the page.

Fix every floor warning or justify keeping it in your final report. An opt-out
attribute such as `data-kp-allow="label-above-headline"` needs that
justification too.

## Bans

No brief, theme or habit earns these back.

- `label-above-headline` (inspect): No label, kicker, eyebrow or metadata line
  above a headline or section heading. Put the product, date, series or source
  in the headline, the supporting line, a caption or the footer. Running heads
  repeated across multi-page print are exempt. A label the brief requires, such
  as Before/After, sits outside the headline's column.
- `stranded-word` (inspect): No headline line holds one stranded word after a
  fuller line, including the line before a `<br>`. Reword it or change its
  measure; break with `<br>` only where the meaning divides. Never shrink type
  to fit.
- `restated-takeaway` (review): State the takeaway once: a subtitle, caption,
  callout or note adds evidence, a qualification or a next step, never the
  headline in other words.
- `slogan-copy` (review): No slogan contrasts ("Not a feature. A platform.",
  "a signal, not proof") and no chains of em dashes. Keep a "not X" clause only
  where it corrects a likely misreading, such as concentrations, not emissions.
- `decorative-container` (review): No panel, card, badge or pill unless it marks
  a distinct object, state or contrasting field, and never a panel inside a
  panel. Use space, alignment and rules first.
- `honest-encoding` (review): Amount bars start at zero, arrows point the true
  direction, and nothing implies causal, temporal or quantitative meaning the
  source lacks. Colour never carries meaning alone; pair it with a label, shape
  or position.

## Defaults

The brief or a theme's `NOTES.md` may override these, explicitly.

- `headline-first` (review): Reading starts with the headline, and the headline
  states the claim. "Cold starts fell 62%" is a claim; "Q3 results" is a topic.
- `one-focus` (review): Accent marks the headline and at most one other element:
  the main claim, path or data point. Everything else uses ink, muted ink or
  categorical colour.
- `format-budget` (review): Fit content to the viewing size: a link card holds a
  headline, one supporting line and a date, and a slide holds one idea. Full
  detail belongs on the one-pager or report.
- `grouping` (review): Space shows grouping: an item sits closer to what it
  qualifies than to the next subject, and true peers share size, weight and
  treatment. New edges align with existing ones.
- `page-footer` (review): Keep page-level source notes and page numbers together
  in a reserved footer, clear of body content. Reserve that space in the first
  layout, not after filling the page. Do not pin the page number independently
  while leaving its source note in body flow. Citations that explain a specific
  figure or claim still belong beside that content.
- `diagram-economy` (review): A diagram uses at most three box styles, each with
  a meaning. Arrowheads scale with the stroke (`markerUnits="strokeWidth"`) and
  stay clear of labels.

## Verify

`inspect` enforces these as errors or warnings; read the diagnostic message.

- `small-text` (inspect): Text is at least 24 CSS px on screen presets and 11 on
  A4. These are floors for small print, not sizes for body text.
- `low-contrast` (inspect): Text contrast is at least 4.5:1, or 3:1 for large
  text, including nested roles and code on contrasting fields.
- `text-overflow`, `clipped-text`, `text-overlap`, `page-overflow` (inspect):
  Nothing leaves the page, hides behind a clip or collides. Recompose; do not
  hide, truncate or shrink required copy.
- `font-fallback` (inspect): Every glyph comes from a bundled font. The bundled
  Plex subsets lack arrows (→), comparison signs (≥) and check marks (✓): draw
  them in SVG or write them out.
