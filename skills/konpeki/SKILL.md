---
name: konpeki
description: Creates, checks, renders, and revises editable Konpeki visuals. Use for covers, social graphics, announcements, charts, diagrams, explainers, article headers, or presentations.
compatibility: Requires Node.js 24+, npm, and file/command access. Preview is optional and runtime installation needs network access and host approval.
---

# Konpeki

Create or revise a v2 composition owned by the same scene used for validation,
preview, PNG/SVG export, and PDF export. Browser access is not required for an
agent; `preview` is an optional human editing surface.

## Resolve the runtime

From the user's workspace, run:

```sh
node "<absolute-skill-path>/scripts/ensure-runtime.mjs"
```

If no runtime is found, obtain host approval and rerun with `--install`. The
script installs pinned `konpeki@0.4.0` in a user cache without changing project
dependencies. It prints absolute `root` and `cli` paths. Read
`<root>/AUTHORING.md` and `<root>/composition/README.md`; keep documents outside
the runtime. Node.js 24+ is required.

## Author

Use the supplied brief, files, and prior conversation. Ask only when missing
facts prevent faithful work. For new work, use an unused
`slides/<name>/composition.json` path and `konpeki-composition/v2`. Preserve an
existing document's stable page, component, and vector IDs and reread it before
each revision. Never overwrite a newer revision.

Choose the destination preset and one-based grid areas. Use named type steps;
padding and leading are baseline units. Keep editable artwork as structured
vectors owned by its semantic component. Preserve required facts, relationships,
and explicit chart/diagram choices. Save substantial sources and caveats beside
the composition. Do not claim unsupported v1 migration.

Use `scripts/prepare-document.mjs` only when a canonical blank is useful:

```sh
node "<absolute-skill-path>/scripts/prepare-document.mjs" "<cli>" "<composition.json>"
```

It exclusively creates the v2 blank when missing and only validates an existing
file. It never replaces invalid data.

## Check, repair, and inspect

Repeat this loop until the requested result is sound:

1. Write the composition IR.
2. Run `node "<cli>" check "<composition.json>"`.
3. Fix every error and review warnings in context.
4. Render each affected page to a new PNG:
   `node "<cli>" render "<composition.json>" --page N --format png --scale 2 --output <file>`.
5. Inspect the PNG for fidelity, hierarchy, clipping, contrast, relationships,
   and consistency; repair and repeat.
6. Deliver the composition and requested exports with honest limitations.

`check` emits `{ "ok", "diagnostics" }`; diagnostic IDs identify the page and,
when applicable, component and element. It exits 1 when errors exist. Bundled
fonts cover Latin, accents, and symbols; unsupported glyphs are errors. Contrast
is measured from all solid glyph pixels at 2x and remains a finite-resolution
measurement. A scaled-chart warning requires visual review of pixel-unit details;
it is not proof that chart captions are correct.

`validate` checks structure only. `render` supports `png`, `svg`, and `pdf`;
pages are one-based, `--scale 2` applies only to PNG, and output creation is
exclusive. Without `--output`, the default is the input basename plus extension.
PDF includes all pages, including mixed page sizes, unless `--page` selects one;
its embedded subset text is selectable. SVG and PNG preserve outlined artwork.

## Optional human preview

Start `node "<cli>" preview "<composition.json>"` only when a human editor is
useful. Keep it alive with the host's supported service mechanism and share the
exact capability-bearing session URL through authenticated forwarding when
remote. Do not publish its token. Browser and file-session exports use the same
scene and writers as the CLI; browser PNG rasterizes the scene SVG and lazily
loads the PDF writer.

The canvas revision-checks every save, loads valid external edits, and retains
notes and pins separately from artwork. Notes and pins do not appear in exports.
Reread the file before applying feedback and preserve newer edits. Continue
revisions in the same conversation.

Do not publish, push, or deploy without permission.
