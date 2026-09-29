# Authoring visuals

Make clear, visually compelling pages from the supplied brief and evidence. For
new work, author static HTML/CSS with inline SVG; the HTML is canonical. Follow
the structural and safety rules in [html/README.md](html/README.md).

## Requirements

- Preserve facts, sources, units, denominators, bounds, and meaningful caveats.
  Distinguish evidence from interpretation; never invent data or filler.
- Choose page dimensions for the destination and define them in CSS. Do not
  assume 16:9, stretch an existing design, or invent extra pages. Compose every
  page break explicitly; there is no automatic pagination.
- Keep essential content readable at its intended viewing size. Do not hide
  overflow, truncate required copy, or shrink type until it technically fits.
- Use licensed assets and real font weights. Keep images and stylesheets beside
  the document or embed them. Use Google Fonts or local/embedded fonts; verify
  that they load before export.
- Represent relationships honestly: correct arrow directions, clear label/value
  associations, appropriate chart scales, and zero baselines for amount bars.
  Do not rely on color alone to convey meaning.
- Preserve stable IDs and deliberate human edits. Give direct-body pages and
  targetable elements globally unique stable IDs.

## Writing tone

Write like a builder explaining work to a capable peer: plainspoken, concrete,
and concise. Give each page one identifiable audience question and state its main
point in the headline. Cut hype, repetition, and rhetorical framing. Keep names
consistent and explain unfamiliar terms.

Start reading order with the main headline. Omit redundant eyebrows, section
labels, and recurring metadata footers. Keep page-specific citations, units, and
caveats next to the evidence they qualify. Preserve legally required attribution.

## Taste and creative freedom

The brief, brand, palette, typeface, and visual references override taste defaults,
but never accuracy or readability. Without contrary direction, use a minimalist
light canvas, dark sans-serif text, and one restrained accent. Build hierarchy
through typography, placement, and whitespace rather than decorative containers.

Use diagrams, annotated artifacts, charts, or comparisons when they make the
actual relationships easier to grasp. Do not require one on every page or invent
causal, temporal, or quantitative meaning. Use arrows sparingly, keep semantic
colors consistent, and label distinctions that carry information.

Resolve conflicts in this order: accuracy/readability, explicit content and
delivery constraints, specific visual directions, then taste defaults. If fixed
page count and required content conflict, ask for a scope decision rather than
silently dropping content.

## Workflow and review

Ground the visual in audience, takeaway, source material, and delivery needs.
Return finished work by default rather than requiring a questionnaire, diagram
choice, or outline approval. Honor an explicitly requested checkpoint.

1. Write or revise the canonical HTML and nearby local resources.
2. Validate and inspect it. Repair overflow, clipped text, and missing resources.
3. Render affected pages at 2x and inspect them at intended size and enlarged.
4. Check factual fidelity, hierarchy, readability, clipping, relationships, and
   coherence. Inspect requested PDF output separately.
5. Repeat until sound, then deliver requested PNG/PDF artifacts. Keep source in
   the agent workspace; share it when useful or requested.

DOM diagnostics use text line boxes, not glyph ink. They cannot prove collision
freedom, contrast, factual correctness, or visual quality. Report consequential
findings and verification limitations honestly.

Human preview review is optional. People may comment, move, or delete; there is
no browser text editing, resizing, or presentation UI. Apply wording and design
changes in source. A small move is a visual translation, not DOM reordering;
deletion may reflow.

## Existing documents and showcases

Composition JSON and its engine remain for existing documents only. Do not choose
it as an equally recommended route for new work. See [examples](examples/README.md)
for representative HTML sources; former JSON examples remain as regression fixtures.

For a contributed showcase, preserve its exact brief and supplied sources without
private transcripts, credentials, model metadata, or invented history. Ordinary
deliveries do not need a showcase dossier.
