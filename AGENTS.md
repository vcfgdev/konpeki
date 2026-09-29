# Konpeki

Konpeki turns a brief into an agent-authored visual. For new work, static HTML
and CSS are canonical; PNG and PDF are the primary delivery artifacts. Existing
composition JSON commands and examples remain supported for legacy documents,
not as an equally recommended authoring path.

## Choose the relevant guide

- First-time setup: [SETUP.md](SETUP.md).
- Creating or revising visuals: [Konpeki skill](skills/konpeki/SKILL.md),
  [AUTHORING.md](AUTHORING.md), and [HTML contract](html/README.md).
- Browser review and handoff: [workflow](docs/workflow.md).
- Changing the application: [development guidance](docs/development.md).

## Shared rules

- Use the toolchain pinned in `mise.toml`; run repository commands through
  `mise exec --` unless that environment is active. Use pnpm, preserve the
  lockfile, and do not install tools globally.
- Author static HTML/CSS with inline SVG. Explicit pages must be direct children
  of `<body>`, use `data-page`, and have globally unique stable IDs. Editable
  elements also need globally unique stable IDs. CSS owns page dimensions.
- Keep images, CSS, and fonts beside the HTML or embed them. Do not author
  JavaScript, embedded applications, controls, or remote resources.
- Preserve unrelated work, human edits, facts, provenance, and stable IDs.
  Reread source before revision; do not overwrite a newer revision.
- Complete requested authoring, inspection, rendering, and repair unless a
  checkpoint is requested. Tests and DOM diagnostics do not replace visual or
  factual review.
- Keep source in the agent workspace by default. Deliver PNG/PDF and share source
  only when useful or requested. Never publish, push, or deploy without permission.
