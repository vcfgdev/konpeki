---
name: konpeki
description: Creates, checks, renders, and revises static HTML visuals. Use for landscape slides, résumés, multi-page documents, one-pagers/cards, and covers/social graphics, including charts and diagrams within them.
compatibility: Requires Node.js 24+, file and command access, and a matching Konpeki runtime installed in the workspace or a prepared checkout. Inspection and export require pinned Chromium.
---

# Konpeki

Turn a brief and evidence into a finished visual with HTML as editable source and
PNG/PDF as delivery artifacts. Infer a suitable form and complete the work rather
than requiring an outline or design checkpoint, unless the user requests one.

## Before authoring

1. Resolve the runtime. From an installed skill, run
   `node scripts/ensure-runtime.mjs` with no arguments; it reports a compatible
   checkout or locally installed package. Its `root` locates the guides below;
   run its `cli` path with Node. See `SETUP.md` if no runtime is found.
2. From that root, read `AUTHORING.md` for accuracy and editorial judgment and
   `html/README.md` for all HTML, file, theme, diagnostic, preview, and CLI
   rules. Do not duplicate or override those rules here.
3. Ground the work in the requested audience, takeaway, supplied evidence,
   destination, and output format. Ask only when missing facts or conflicting
   constraints prevent faithful work.
4. Infer the format and read its guide below. Read only the relevant sections
   of [content patterns](references/patterns.md) when the work mixes text with
   visuals or includes a chart, table, comparison, process, system map,
   hierarchy, or annotated detail.

## Choose the output guide

These guides cover content, layout, and review decisions, not fixed templates
or a placement grid. The brief overrides format defaults, never accuracy,
readability, or the floor's bans. Do not ask the user to choose a taxonomy.

| Requested output | Read |
| --- | --- |
| Landscape presentation or deck | [Slides](references/slides.md) |
| Résumé or CV | [Résumé](references/resume.md) |
| Report, essay, proposal, or other sustained multi-page reading | [Long document](references/long-document.md) |
| Bounded brief, reference sheet, one-pager, or card at A4 or another size | [One-pager/card](references/one-pager.md) |
| Cover, thumbnail, link preview, or social graphic | [Cover/social graphic](references/cover.md) |

For a mixed-format request, read each applicable guide. A one-page résumé still
uses the résumé guide; a diagram within a report uses the long-document guide
and the relevant pattern section. Start freely when none fits exactly.

## Create or revise

1. Choose the user's document path. For a new document, run
   `node scripts/prepare-document.mjs <cli> <document.html>` to place a validated
   starter and theme stylesheets beside it without overwriting existing files.
   The default theme uses Google Fonts; use local or embedded fonts for offline
   or reproducible rendering.
2. Reread any existing source before changing it. Preserve stable IDs, facts,
   provenance, deliberate human edits, and unrelated or newer changes.
3. Plan each page before writing HTML, in your working notes: its format and
   viewing size, the headline as a claim, the elements it carries in reading
   order, and what the format's budget forces out.
4. Read [floor.md](floor.md) immediately before writing or revising HTML. Its
   bans have no exceptions; its defaults yield only to an explicit brief.
5. Read `html/theme.md` for the theme API. Link the default Cobalt `theme.css`.
   When the brief brings its own look, adapt a copy using the same contract.
   Read CSS implementation only when changing a theme, not when using one.
   Author the HTML and page-specific composition; use complete type roles and
   theme tokens.
6. Run `node <cli> validate <document.html>` and fix source-contract errors.
7. Run `node <cli> inspect <document.html>`; use `--page N` or `--details` when useful.
   Use each page's resolved `theme.type` to plan type and line lengths.
   Resolve errors. Fix each warning, or keep it with a reason you will report;
   floor warnings use their rule ID as the diagnostic code.
8. Render every affected page at 2x PNG. `render` prints the floor's review
   checklist: check the page against it at intended size and enlarged, along
   with facts, readability, clipping and consistency.
9. Repeat editing, validation, inspection, and visual review until sound. Inspect
   a requested PDF separately because it is a distinct artifact.

Example focused loop:

```sh
node <cli> validate document.html
node <cli> inspect document.html
node <cli> render document.html --page 1 --format png --scale 2 --output page-1.png
```

## Human feedback

Use `node <cli> preview <document.html>` only when interactive review is useful. After
the reviewer uses **Copy & clear**, use the full local path in the prompt to
reread current source, then address feedback by stable target ID. If a target no
longer exists or feedback conflicts with newer work, report that instead of
guessing. Re-run the verification loop after source-backed moves, deletions, or
agent-authored revisions.

## Deliver

Deliver requested PNG/PDF artifacts first. Keep editable HTML and local resources
in the agent workspace; share them when useful or requested. Report every
warning you kept and why, and any review limitations. Do not claim checks you did
not run.

Do not publish, push, deploy, or create a release without explicit permission.
