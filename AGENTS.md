# Konpeki repository guidance

## Read by responsibility

- Authoring workflow: [skills/konpeki/SKILL.md](skills/konpeki/SKILL.md)
- HTML, local files, theme, diagnostics, preview, and CLI:
  [html/README.md](html/README.md)
- Editorial and visual taste: [AUTHORING.md](AUTHORING.md)
- Environment setup: [SETUP.md](SETUP.md)
- Implementation work: [docs/development.md](docs/development.md)

Use the toolchain pinned in `mise.toml`; run repository commands through
`mise exec --` unless it is already active. Use pnpm, preserve the lockfile, and
do not install tools globally.

Preserve unrelated work, supplied facts and provenance, stable IDs, and deliberate
human edits. Reread source before revising it. Automated checks do not replace
visual or factual review.

Never publish, push, deploy, or tag without explicit permission.
