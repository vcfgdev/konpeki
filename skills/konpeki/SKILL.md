---
name: konpeki
description: Creates, checks, renders, and revises static HTML visuals. Use for covers, social graphics, charts, diagrams, explainers, documents, or presentations.
compatibility: Requires Node.js 24+, file/command access, and the unreleased Konpeki source checkout for HTML. CLI inspection/export requires explicitly installed pinned Chromium.
---

# Konpeki

Turn a brief and evidence into a finished static HTML visual, inspect it, revise
it, and deliver PNG/PDF artifacts. Infer the visual form rather than requiring a
questionnaire or outline approval. Ask only when missing facts or conflicting
constraints prevent faithful work.

## Availability

HTML-first authoring is unreleased checkout development. Published
`konpeki@0.4.0` is the legacy composition JSON runtime. Do not install or describe
the published package as if it already supports this workflow. Existing JSON
documents may continue using their engine, but choose HTML for new checkout work.

## Read the relevant guidance

- `AUTHORING.md`: factual fidelity, writing, design, and review.
- `html/README.md`: source contract and commands.
- `docs/workflow.md`: optional human preview and delivery.

## Create or revise

Author the user's chosen `document.html` path:

- static HTML/CSS with inline SVG;
- every explicit page is a direct child of `<body>` with `data-page`;
- page and targetable element IDs are globally unique and stable;
- CSS defines page dimensions, including mixed sizes;
- local images, stylesheets, and fonts are embedded or kept beside the HTML; and
- no authored JavaScript, embedded applications, controls, or remote resources.

The HTML is canonical. Do not create composition JSON or another scene/schema as
an intermediate source. Preserve facts, sources, caveats, IDs, unrelated edits,
and newer human changes. Compose page breaks explicitly; there is no automatic
pagination.

## Inspect and deliver

Repeat until sound:

1. `konpeki validate document.html`
2. `konpeki inspect document.html` (add `--page N` or `--details` as needed)
3. Repair errors and review warnings by stable ID.
4. Render affected pages:
   `konpeki render document.html --page N --format png --scale 2 --output page-N.png`
5. Visually inspect fidelity, hierarchy, readability, clipping, relationships,
   and consistency. Inspect requested PDF output separately.

`check` is available for diagnostics. DOM checks detect page overflow, clipped
text, and missing images/fonts. They measure line boxes rather than glyph ink and
cannot prove collision freedom, contrast, factual correctness, or visual quality.

PNG defaults to page 1. PDF includes all explicitly authored pages by default and
supports mixed sizes. Output is exclusive; choose a new path rather than
overwriting. Install the pinned browser explicitly with `konpeki browser install`
when CLI inspection/export needs it.

Deliver PNG/PDF first. Keep HTML and local resources in the agent workspace and
share source only when useful or requested. Artifact recipients do not need
Playwright or Chromium.

## Optional human preview

Run `konpeki preview document.html [--host ...] [--port ...] [--json]` only when
human review is useful. Preview itself does not need headless Chromium.

People can comment, make small moves, delete, and undo. Alignment guides are
visual and do not snap. Small drags persist visual translation without reordering
DOM; deletion may reflow. There is no text editor, resize, presentation UI, or
design control panel. Apply text and substantive design revisions in source.

Comments stay browser-local. **Copy & clear** copies comments and target IDs for
pasting into the agent conversation, with undo; failure leaves the queue intact.
There is no adapter, waiting process, sidecar, automatic invocation, or automatic
resolution. Reread source before applying a prompt and use stable IDs rather than
guessing from screenshots.

Do not publish, push, deploy, or claim release/test status without evidence and
permission.
