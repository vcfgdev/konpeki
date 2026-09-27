# Introducing Konpeki

A seven-page `konpeki-composition/v2` deck introducing Konpeki. It was rebuilt
from the original one-line brief using the public README, skill and authoring
guide, then revised after comparison with the previous bundled deck. See
[PROMPT.md](PROMPT.md) for the brief and revision, and [SOURCE.md](SOURCE.md) for
claim provenance.

[composition.json](composition.json) is the editable document of record.
[author.mjs](author.mjs) regenerates it; the screenshots are Chromium captures
at exactly 2× the declared page size (3840×2160).

![Cover](screenshots/page-1.png)

## Pages

1. Create clear visuals with your coding agent — cover with the supported page sizes.
2. Give your agent a brief. It returns an editable page — four-step flow, plus
   the sketch-first path and first-use setup.
3. You and your agent edit the same file — browser canvas, `composition.json`
   and agent, with save/load/write/reread arrows.
4. Every page is built from five editable components.
5. Point at what to change, then choose Build it — notes, pins and the request loop.
6. Try it in the browser. Keep working with your agent — playground vs agent table.
7. Start with one install and a brief.

## Open, regenerate and review

Requires Node.js 24+. From the repository root:

```sh
mise exec -- node bin/konpeki.mjs preview slides/introducing-konpeki/composition.json
```

In an Amp orb, run the preview as a supervised service and share its portal URL
with the printed `?session=` query. Session URLs grant editing access.

To regenerate (this overwrites canvas edits in `composition.json`):

```sh
mise exec -- node slides/introducing-konpeki/author.mjs
mise exec -- node bin/konpeki.mjs validate slides/introducing-konpeki/composition.json
```

The Konpeki mark is read from `slides/github-cover/composition.json`.

With `agent-browser` installed and a preview running:

```sh
mise exec -- node slides/introducing-konpeki/review.mjs "<preview-url-with-session>" /tmp/intro-review
```

It enters Present, checks text overflow and clipped vector text, and saves a
capture of each page. Separately, all seven pages and the four gallery pages
passed `scripts/check-grid.mjs` geometry, overflow and overlap checks at
1920×1080 and 1024×768. It also checks page 2's circle/label alignment and samples
opaque vector text/fill contrast. This is not a complete contrast audit and does
not establish Night mode, other palettes, PDF/PPTX or cross-browser rendering,
blind preference, or first-attempt agent quality.

Known limitations: the Konpeki mark now follows the theme accent rather than a
fixed brand blue. Page 2 now gives each numbered drawing the same three-column
area as its heading and body, preserving vector IDs while eliminating the old
page-wide artwork pitch. Page 4 uses deliberate two-column spans and whitespace
for its five items; page 5's step numbers still occupy their own columns. v2
component padding is available, but fixed-height text still needs render checks.

## Authoring notes

Friction found while following the documentation as a new author:

- Apart from the target deck, `github-cover` is the only full example JSON in
  the npm package, so the format was inferred from it and `composition/types.ts`.
- The original v1 authoring pass found that a text block with `border: "filled"`
  had no inner padding and painted an opaque background, so boxed text needed a
  separate vector panel. v2 now provides baseline-unit component padding.
- Text blocks still do not grow to fit, so fixed heights need a render check.
