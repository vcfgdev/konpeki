---
name: konpeki
description: Creates, checks, renders, and revises static HTML visuals. Use for covers, social graphics, charts, diagrams, explainers, documents, or presentations.
compatibility: Requires Node.js 24+, file and command access, and a prepared Konpeki checkout or locally packed installation. Inspection and export require pinned Chromium.
---

# Konpeki

Turn a brief and evidence into a finished visual with HTML as editable source and
PNG/PDF as delivery artifacts. Infer a suitable form and complete the work rather
than requiring an outline or design checkpoint, unless the user requests one.

## Before authoring

1. Read `AUTHORING.md` for taste and fidelity guidance.
2. Read `html/README.md` for all HTML, file, theme, diagnostic, preview, and CLI
   rules. Do not duplicate or override those rules here.
3. Resolve the runtime. From an installed skill, run
   `node scripts/ensure-runtime.mjs` with no arguments; it reports a compatible
   checkout or locally installed package. Use its `root` to locate the guides and
   run its returned `cli` path with Node. See `SETUP.md` if no runtime is found.
4. Ground the work in the requested audience, takeaway, supplied evidence,
   destination, and output format. Ask only when missing facts or conflicting
   constraints prevent faithful work.

## Create or revise

1. Choose the user's document path. For a new document, run
   `node scripts/prepare-document.mjs <cli> <document.html>` to place a validated
   starter, theme, bundled fonts, and font license beside it without overwriting
   existing files. For a different look, append `--theme editorial`, `--theme dark`
   or `--theme dense-data`. This option initializes new documents only; use a
   separate directory for each theme's assets.
2. Reread any existing source before changing it. Preserve stable IDs, facts,
   provenance, deliberate human edits, and unrelated or newer changes.
3. Read `html/theme.md` for the theme API. Link the default light-blue `theme.css`.
   When the brief brings its own look, adapt a copy using the same contract.
   Read CSS implementation only when changing a theme, not when using one.
   Author the HTML and page-specific composition; use complete type roles and
   theme tokens. Apply authoring guidance and any selected design skills without
   weakening factual fidelity or readability.
4. Run `node <cli> validate <document.html>` and fix source-contract errors.
5. Run `node <cli> inspect <document.html>`; use `--page N` or `--details` when useful.
   Use each page's resolved `theme.type` to plan type and line lengths.
   Resolve diagnostic errors and evaluate warnings rather than suppressing them
   mechanically.
6. Render every affected page at 2x PNG and inspect it both at intended size and
   enlarged. Check facts, hierarchy, readability, clipping, contrast,
   relationships, and consistency—not only automated diagnostics.
7. Repeat editing, validation, inspection, and visual review until sound. Inspect
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
in the agent workspace; share them when useful or requested. Report consequential
warnings and any review limitations honestly. Do not claim checks you did not run.

Do not publish, push, deploy, or create a release without explicit permission.
