# GitHub repository cover

`cover.png` is the 1280 × 640 GitHub social-preview image. It was exported with
Konpeki's PNG exporter from `composition.json`, not rasterized from a separate
design runtime. The document retains native editable text and vector artwork.

Open for editing:

```sh
mise exec -- pnpm konpeki preview slides/github-cover/composition.json
```

Use **Export PNG** after editing.

`PROMPT.md` records the brief, assumptions and asset sources. `author.ts`
reconstructs the initial composition with Node.js and ImageMagick; running it
overwrites the JSON, so do not run it over subsequent human edits.

Verified: composition validation, TypeScript check and application build;
the real canvas loaded all five components and IBM Plex Sans. Inspected the
1280 × 640 PNG and a 640 × 320 review copy for alignment, clipping and legibility.
Corrected the logo's vertical alignment after the first export. The current
illustration uses differently sized canvases to show the breadth of the visual
framework without prescribing one workflow or fixed set of outputs.
Uploading the PNG as the repository social preview remains a separate GitHub
setting.
