# GitHub repository cover

[composition.json](composition.json) holds the editable text and vectors;
[cover.png](cover.png) is its 1280×640 Konpeki PNG export.
The varied canvas sizes illustrate possible formats, not a fixed workflow.

Open from the repository root, edit, then choose **Export PNG**:

```sh
mise exec -- pnpm konpeki preview slides/github-cover/composition.json
```

Refresh [public/og.png](../../public/og.png) for the playground's social cards.
Uploading the cover to GitHub's repository social-preview setting is separate.

[Brief and sources](PROMPT.md). [author.ts](author.ts) reconstructs the initial
composition using Node.js and ImageMagick; **it overwrites canvas edits**.

Original review: validation, typecheck and build passed; all five components and
IBM Plex Sans loaded. Inspected the 1280×640 export and a 640×320 copy for alignment,
clipping and legibility.
