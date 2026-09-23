# Introducing Konpeki

A six-page introduction covering creation, shared editing, components, revision
notes, browser/file sessions and a first brief. Uses default authoring mode and
Precision Paper with theme-linked colors and fonts.

## Open and revise

Open the [playground example](https://vcfgdev.github.io/konpeki/?example=introducing-konpeki)
and select **Present**. Edits save to a separate browser-local copy; use
**Browser → Download JSON** to keep them. **Reset example** restores the bundled
version, so download your work first. Browser storage is not a backup or agent sync.

For agent revisions, follow [setup](../../SETUP.md) and open a copy of
[composition.json](composition.json) in a file-backed preview. Notes, **Build it**
and **Copy prompt** work there, not in the standalone playground. See the
[canvas workflow](../../docs/workflow.md) for handoff details.

The JSON is the editable source: double-click text to edit it; diagrams contain
editable vector elements. [author.ts](author.ts) reconstructs the original deck:

```sh
mise exec -- node slides/introducing-konpeki/author.ts
```

Run from the repository root. **This overwrites canvas edits.**
[Brief](PROMPT.md) · [Sources](SOURCE.md) · [Reviewed screenshots](screenshots/)

## Review

With a dev/preview server and `agent-browser`, run from the repository root:

```sh
mise exec -- node slides/introducing-konpeki/review.mjs <preview-url> /tmp/konpeki-intro Precision paper
```

The script checks text bounds and vector alignment at 1920×1080 and 1024×768,
DPR2. Repeat with `Precision night` and `Editorial paper`, then inspect captures.
An optional final font ID overrides the palette's default, e.g. `Green paper plex-serif`.
These 36 states passed the original visual review, alongside validation, typecheck,
tests and build. Browser review does not verify agent-client installation,
PDF/PPTX, mobile, reduced motion, focus styling or cross-application fidelity.

![Title slide](screenshots/page-1.png)
