# Development

Use the versions pinned by `mise.toml` and preserve the lockfile:

```sh
mise trust
mise install
mise exec -- pnpm install --frozen-lockfile
```

Run repository commands through `mise exec --` unless the environment is active.
Do not install project tools globally.

## HTML-first architecture

The new path treats static HTML as canonical source. Pages are explicit direct
children of `<body>`, marked with `data-page`, and sized by CSS. Page and target
IDs are globally unique and stable. Local images, CSS, and fonts live beside the
HTML or are embedded. Authored JavaScript, embedded applications, controls, and
remote resources violate the contract.

The intended CLI surface is:

```text
konpeki validate document.html
konpeki inspect document.html [--page N] [--details]
konpeki check document.html
konpeki render document.html [--page N] [--format png|pdf] [--scale 2] [--output file]
konpeki preview document.html [--host host] [--port port] [--json]
konpeki browser install
```

`browser install` explicitly installs the pinned Chromium used by CLI inspection
and export. Playwright/Chromium run on the agent or runtime machine, not on artifact
recipient or reviewer machines. Preview serves the document and does not require
headless Chromium.

Validation enforces the static contract. Inspection and checking use DOM geometry
to report page overflow, clipped text, and missing images/fonts. Text bounds are
line boxes, not visible glyph ink. Diagnostics do not prove collision freedom,
contrast, factual correctness, or visual quality. There is no automatic pagination.

PNG defaults to the first page. PDF exports every explicit page by default and
supports mixed sizes. Output files use exclusive creation.

## Preview boundary

Preview is a narrow review/correction surface: comments, small moves, delete,
undo, and non-snapping alignment guides. A move persists visual translation and
does not reorder source; deletion may reflow. Do not add inline text editing,
resize, presentation UI, an agent adapter, a waiting process, or a comment
sidecar. Comments are browser-local and leave through Copy & clear prompts.

## Legacy compatibility

Composition JSON commands, engine code, and examples remain for existing
documents. They are not an equal new-authoring recommendation. The checked-in
gallery remains legacy JSON and must not be described as converted HTML.

## Verification and release status

For documentation-only work, check links, command spelling, and consistency with
the implemented CLI. For implementation work, run the focused checks covering
the changed path and visually inspect affected renders; automated diagnostics
are not visual acceptance.

```sh
mise exec -- pnpm exec playwright install chromium
mise exec -- pnpm check
mise exec -- pnpm test
mise exec -- pnpm build
mise exec -- pnpm check:package
```

Before release, install the tarball in a disposable directory and exercise HTML
validation, inspection, PNG/PDF export, and preview there. Checkout imports can
hide missing package resources. Verify drag/save/undo, stale revisions, comments,
clipboard failure, and diagnostic states in a real browser as well.

This HTML path is unreleased checkout development. The published package remains
0.4.0. Do not claim packaging, tests, npm publication, converted examples, or a
deployed HTML preview unless those actions actually happen. Never publish, push,
deploy, or tag without explicit permission.
