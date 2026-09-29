# Konpeki

Konpeki turns a brief into a finished agent-authored visual with editable source
and requested exports. The agent owns the conversation; composition JSON owns
the document; the browser supports review, comments, movement, resizing, and
deletion. Text and design revisions belong to the agent or source JSON.

## Choose the relevant guide

- First-time setup: [SETUP.md](SETUP.md).
- Opening the editor, creating or revising visuals: [Konpeki skill](skills/konpeki/SKILL.md)
  and [AUTHORING.md](AUTHORING.md), which owns design and factual-fidelity rules.
- Changing the application: [development guidance](docs/development.md) and
  the [composition contract](composition/README.md).
- Browser/file handoff: [canvas workflow](docs/workflow.md).

## Shared rules

- For repository development, use the toolchain pinned in `mise.toml`. Run
  commands through `mise exec --` unless the mise environment is already active.
  Use pnpm and preserve the dependency lockfile; do not install tools globally.
- Keep drafting, correction and review on the shared composition canvas.
  Retained React/SVG examples are drawing references, not a parallel deck runtime.
  Example geometry is not a design requirement.
- Preserve unrelated work, human edits and stable component/vector IDs. Reread
  the current composition before revising it; do not overwrite a newer revision.
- Complete requested implementation, rendering, inspection and repair unless
  the person requests a checkpoint. Ask when missing facts prevent faithful work.
- Infer the visual form from the brief and sources. Do not require browser users
  to choose diagram/chart types or complete content and intent forms; use comments
  for communication intent and revision requests.
- Scale checks using [verification guidance](docs/development.md#verification).
  Inspect affected renders for visual changes; tests alone are not visual review.
- Keep creative briefs and factual provenance with examples. Exclude private
  chat, coordination transcripts, workspace paths, credentials and agent/model
  or timezone metadata. Label excerpts, adaptations and redactions honestly.
- Do not push, publish or deploy without permission.
