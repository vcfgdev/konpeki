# GitHub repository cover

[composition.json](composition.json) holds the editable v2 text and vectors,
recomposed for the 1200×630 `link` preset; [cover.png](cover.png) is its exact 2×
Konpeki PNG export (2400×1260).
The varied canvas sizes illustrate possible formats, not a fixed workflow.

Check and render from the repository root without a browser:

```sh
mise exec -- pnpm konpeki check slides/github-cover/composition.json
mise exec -- pnpm konpeki render slides/github-cover/composition.json --format png --scale 2 --output /tmp/cover.png
```

For human editing, use `pnpm konpeki preview slides/github-cover/composition.json`.
[public/og.png](../../public/og.png) is the 1× export for the playground's social
cards. Uploading the cover to GitHub's repository social-preview setting and
deploying the playground are separate actions.

[Brief and sources](PROMPT.md). [author.ts](author.ts) reconstructs the v2
composition using Node.js and ImageMagick; **it overwrites canvas edits**.
The port retains all five component IDs and existing artwork IDs. Validation
and scene diagnostics cover the packaged document, not only its presence.
