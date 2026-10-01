# Multi-page long document

Use for reports, essays, field guides, proposals, and other sustained reading.
Apply the [shared guidance](../SKILL.md#before-authoring) and the
[authoring floor](../floor.md), not slide-density conventions.

- Start with the theme's portrait `a4` preset for an unspecified printable
  document; honor Letter or other destination sizes. Keep margins, body
  typography, and heading levels consistent across pages.
- Test the page structure before filling the document: a short page and a dense
  page, both with multiline source notes. Apply the floor's `page-footer` rule.
  A flex-column page with non-shrinking body and footer, and `margin-top: auto`
  on the footer, puts spare space above it rather than between its parts.
  Check the same bottom margin and body clearance on both pages; neither may
  rely on hiding overflow or shrinking text. Then reuse that structure.
- Organize the argument into sections before dividing it into pages. Use normal
  HTML text flow within each page, not separately positioned lines or sentences.
  Choose line measure and leading for continuous reading at the delivered size.
- Author every page explicitly. Konpeki will not flow an overflowing paragraph
  into a new page; CSS print-break hints do not replace `data-page` boundaries.
  Measure real text with the loaded fonts before deciding where to split it.
- Keep headings with their opening paragraph and captions with their figures.
  Avoid isolated first or last lines and stranded short list items. Split a long
  paragraph only at a readable boundary, preserving its wording and punctuation.
- Keep complete table rows together. When a table spans pages, repeat its
  column headings and make units and continuation clear. Do not silently drop
  rows, references, or qualifications to meet a page count.
- Use page numbers for navigation. Add running titles or a contents page only
  when the length and structure warrant them. Keep footnotes and citations with
  the claims they qualify; essential evidence is not decorative footer clutter.
- On revision, recheck the following pages: a changed paragraph can alter the
  best page breaks even when the edited page no longer overflows.

Inspect every PDF page, including the final page, for continuity, uneven density,
awkward breaks, missing text, and footer grouping and clearance. Compare page
endings across the document; a detached footer can pass overflow checks. Review
text extraction order when searchable or accessible reading is part of delivery.

The footer check comes from the VulcanBench SWE-v4 report: its source note floated
above an independently pinned page number despite passing overflow inspection.
