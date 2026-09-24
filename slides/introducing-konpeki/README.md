# Introducing Konpeki

A seven-page `konpeki-composition/v1` deck introducing Konpeki. It was rebuilt
from the original one-line brief using the public README, skill and authoring
guide, then revised after comparison with the previous bundled deck. See
[PROMPT.md](PROMPT.md) for the brief and revision, and [SOURCE.md](SOURCE.md) for
claim provenance.

[composition.json](composition.json) is the editable document of record.
[author.mjs](author.mjs) regenerates it; the screenshots are Chromium captures.

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

It enters Present, checks every page at 1920×1080 and 1024×768 for text-block
overflow and clipped vector text, and saves a capture of each page. All seven
pages passed at both sizes. It does not check contrast, Night mode, other
palettes, PDF/PPTX or cross-browser rendering.

Known limitations: the Konpeki mark keeps its brand blue, which differs from the
Plex accent. Page layouts 2, 4 and 5 share a column rhythm.

## Authoring notes

Friction found while following the documentation as a new author:

- Apart from the target deck, `github-cover` is the only full example JSON in
  the npm package, so the format was inferred from it and `composition/types.ts`.
- A text block with `border: "filled"` gets no inner padding, and text blocks
  paint an opaque background; boxed text needs a separate vector panel behind it.
- Text blocks do not grow to fit, so heights need a render check.
