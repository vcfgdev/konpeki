---
name: konpeki
description: Creates, checks, renders, and revises editable Konpeki visuals. Use for covers, social graphics, announcements, charts, diagrams, explainers, article headers, or presentations.
compatibility: Requires Node.js 24+, npm, and file/command access. Preview is optional and runtime installation needs network access and host approval.
---

# Konpeki

Turn the user's brief into a finished visual with editable source, inspect it,
revise it, and deliver the requested outputs. A browser is optional for comments
and basic text corrections. Infer the visual form instead of requiring a
questionnaire, content/intent form, diagram/chart choice or outline approval.
Ask when missing facts or conflicting constraints prevent faithful work.

## Resolve the runtime

From the user's workspace, run:

```sh
node "<absolute-skill-path>/scripts/ensure-runtime.mjs"
```

If no runtime is found, obtain host approval and rerun with `--install`. The
script installs pinned `konpeki@0.4.0` in a user cache without changing project
dependencies. It prints absolute `root` and `cli` paths. Resource paths below
are relative to that `root`, not the installed skill. Keep documents outside
the runtime.

## Read only the guidance needed

Start with `AUTHORING.md` → **Requirements**, **Writing tone**, and **Taste and
creative freedom**. The sole default is restrained; explicit user direction or
a supplied reference takes precedence over taste, never fidelity or readability.
Consult other sections as needed:

| Task | Read |
| --- | --- |
| Create a page, change size, or repair placement/text | `composition/README.md` → **Pixels and type**; A4 is explicitly paginated |
| Compose paragraphs, letters, release notes or reports | `composition/README.md` → **Text flow**, when available in the resolved runtime; use measured stacks rather than fixed paragraph boxes |
| Choose a diagram, chart, or comparison | `design/semantic-patterns.md`, then `composition/README.md` → **Components and artwork** |
| Lay out a chain or one decision | `composition/README.md` → **Semantic process flows**, when available in the resolved runtime; preserve node position overrides |
| Author custom artwork | `composition/README.md` → **Components and artwork**; without an explicit layout opt-in, topology alone remains a draft |
| Repair a measurement or export issue | `composition/README.md` → **Agent layout report** or **Fonts, checks, and writers** |
| Open the canvas or apply comments/feedback | `docs/workflow.md` → **Optional preview** |
| Explore a direction or contribute a showcase | `AUTHORING.md` → **Explore an uncertain direction** or **Showcase records** |

## Create or revise

Use `konpeki-composition/v2` at the user's chosen path, or an unused
`slides/<name>/composition.json`. New pages use a 256–4096 px `canvas` or optional
named `preset`, pixel `rect` placement for positioned components, and measured
stack groups for sequential text. Presets provide default dimensions, margins,
and typography; an explicit canvas overrides dimensions. Reread the current file
before every edit and preserve stable
page, component, and vector IDs, deliberate human edits, and newer revisions.
Keep artwork editable in its owning component. Preserve required facts, sources,
caveats, relationships, and explicit chart/diagram choices.

Portable authoring contract: write page objects in the document's top-level
`pages` array. Never author `slides`, both top-level keys together, or a component
`intent` field. Legacy `slides` documents are import-only; after loading, save
the canonical `pages` form without component `intent`. Put visible wording in
`content` and revision requests in the brief or review comments, not in a
replacement component field.

Use `rect: {x, y, width, height}` in page pixels. Native single-region text may
omit height so Konpeki measures line count × leading + twice its padding; custom
visuals and multiregion text require height. This is a line-layout box, not snug
glyph ink; use `inspect --details` for separate `inkBounds`. Padding, leading,
stack gaps, and `flow.offset` are page pixels. Named type steps remain defaults;
positive numeric `textStyle.size` and vector `font-size` values are supported.
Editor movement and resize corrections are 1 px on both axes with no grid or
margin snap. Legacy grid pages import losslessly and save back as pixel geometry.

Omit unused `contentSlots`, `groups`, `relationships`, and component `slotIds`;
they default to empty arrays. Reading and paint order each default to component
array order. Override them only when meaning or stacking differs. See
`composition/README.md` → **Source defaults**; retain semantic references when needed.

Ordinary work needs the composition and requested exports, not a showcase dossier.
Keep substantial sources beside the document when needed for future revisions.

Use `scripts/prepare-document.mjs` only when a canonical blank is useful:

```sh
node "<absolute-skill-path>/scripts/prepare-document.mjs" "<cli>" "<composition.json>"
```

It exclusively creates the v2 blank when missing and only validates an existing
file. It never replaces invalid data.

## Review and deliver

Repeat this loop until the requested result is sound:

1. Write or revise the composition.
2. Run `node "<cli>" inspect "<composition.json>"` for the layout report and diagnostics.
3. Read the component summary; fix errors and review warnings by ID. Use `--page N --details` when exact geometry is needed.
4. Render each affected page to a new PNG:
   `node "<cli>" render "<composition.json>" --page N --format png --scale 2 --output <file>`.
5. Inspect the PNG for fidelity, hierarchy, clipping, contrast, relationships,
   and consistency; repair and repeat.
6. Inspect all pages before delivery. Deliver the composition and requested
   exports, identifying what was checked and any remaining limitations.

`inspect` includes the same checks as `check`; do not run both routinely.
Errors exit 1; warnings require review. Reports are evidence, not editable source,
and geometry checks do not establish visual quality or factual correctness.
Bundled fonts cover Latin, accents, and symbols; unsupported glyphs are errors.

`render` supports `png`, `svg`, and `pdf`. Pages are one-based; `--scale 2` is
PNG-only. Use fresh output paths: existing exports are never overwritten.
PDF includes all pages unless `--page` selects one. Inspect requested exports
separately; a PNG does not establish PDF fidelity. Do not promise unsupported formats.

## Optional human preview

Start `node "<cli>" preview "<composition.json>"` only when a human editor is
useful. Keep it alive with the host's supported service mechanism and share the
exact capability-bearing session URL through authenticated forwarding when
remote. Do not publish its token. All pages share one scrollable canvas, with
arrows showing their order and a single bottom-right comment button. The browser
and CLI use the same owned scene; delivery exports come from the CLI.

Click **Comment** to select a page or component, or open the queue when comments
already exist. Write feedback in the nearby composer, then **Add** to open the
queue with **Copy & clear** ready. Use **New comment** to select another target,
or the pencil to edit saved feedback. Paste the prompt into the agent conversation; it
includes all pending comments and their page/component/vector IDs. Clipboard
success clears the copied batch with an **Undo** notice; unsent drafts remain.
Clipboard or storage failure keeps the queue; clipboard failure also offers
selectable text for manual copying. Copying never invokes an agent, and clearing
does not mean the revisions were applied. **Cancel** returns to the queue, or
closes if it is empty. Clicking the launcher or Escape returns to editing.
Outside comment mode, people can move, resize, delete and correct native text
directly, with keyboard undo. Flowing text grows with its content rather than
showing fixed-height resize handles. No sidebars, design pickers or presentation mode.
Comments combine intent and revision requests; existing targeted notes remain
readable. Comments stay in that browser at the same preview address, outside the
composition and exports. No review sidecar, adapter, or waiting process is needed.
If the agent lacks the current standalone composition, share its downloaded JSON
as well as the prompt. Reread the current composition before applying pasted
feedback, preserve newer human edits, then repeat review. If a target disappeared
or is ambiguous, ask rather than guessing. Report addressed and unresolved
feedback; people remove their local comments themselves. There is no Resolve action.

Do not publish, push, or deploy without permission.
