# Konpeki

Konpeki helps a coding agent turn a brief and source material into finished
visuals. The new, **unreleased** workflow authors ordinary HTML and CSS directly;
the HTML file is the editable source used for inspection, preview, and export.

Use it for covers, social graphics, diagrams, charts, explainers, documents, and
presentations. Authors keep control of the facts, wording, visual hierarchy, and
page breaks. Konpeki supplies diagnostics, rendering, and an optional review
surface for small geometry corrections and comments.

## Current status

**Konpeki has not been published to npm.** `0.4.0` is the version in the repository,
not an available npm release. Run the commands below from a prepared source checkout.
Existing composition JSON documents remain supported for compatibility; choose
HTML for new work.

## HTML-first authoring

Create `document.html` with static HTML/CSS and inline SVG. The source HTML is
canonical—there is no intermediate composition JSON. Each explicitly authored
page is a direct child of `<body>`, has `data-page`, and has a globally unique,
stable `id`. Give every editable page element a globally unique, stable `id` as
well. Define page dimensions in CSS.

Keep images and stylesheets beside the HTML, or embed them. Fonts may be local,
embedded, or loaded from Google Fonts. Do not author JavaScript, applications,
controls, or other remote resources. See
[HTML authoring](html/README.md) and [authoring guidance](AUTHORING.md).

The intended checkout CLI is:

```sh
konpeki validate document.html
konpeki inspect document.html [--page N] [--details]
konpeki check document.html
konpeki render document.html [--page N] [--format png|pdf] [--scale 2] [--output file]
konpeki preview document.html [--host host] [--port port] [--json]
konpeki browser install
```

PNG defaults to page 1. PDF includes all explicitly authored pages, including
mixed page sizes. Output creation is exclusive and will not overwrite a file.
Playwright and the pinned Chromium are agent/runtime dependencies for CLI
inspection and export only; preview itself does not require headless Chromium.

## Review and delivery

The optional preview lets a person comment, move, or delete elements. It has
undo and visual alignment guides without snapping, but no text editing, resize,
or presentation UI. Small drags save a visual translation to source rather than
reordering markup; deletion may reflow the document. Comments stay browser-local.
**Copy & clear** creates a prompt to paste into the agent conversation; there is
no adapter, waiting process, or review sidecar.

PNG and PDF are the primary delivery artifacts. Keep editable HTML and its local
resources in the agent workspace and share source only when useful or requested.
Recipients do not need Playwright or Chromium to view exports.

Try the [comment preview](https://vcfgdev.github.io/konpeki/) with three
[HTML examples](examples/README.md): a cover, a data brief, and a two-page field
guide. The public demo keeps comments in your browser; use a local CLI preview
to save moves and deletions to source.

## Installation

Install the current authoring skill:

```sh
npx skills add vcfgdev/konpeki -g
```

Installing the skill does not install the runtime. Both HTML and legacy JSON
commands currently require a prepared source checkout. See [SETUP.md](SETUP.md).

## Guides

- [Setup](SETUP.md)
- [Authoring](AUTHORING.md)
- [HTML contract](html/README.md)
- [Workflow](docs/workflow.md)
- [Development](docs/development.md)
- [HTML examples](examples/README.md)
- [Contributing](CONTRIBUTING.md) and [security](SECURITY.md)

Konpeki requires no account or hosted AI service. Your coding agent's pricing
and data handling still apply. Supply facts and approved assets; examples and
placeholders are not evidence about real products.

## License

[Apache-2.0](LICENSE). Dependencies and bundled fonts retain their own licenses.
