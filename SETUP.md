# Set up Konpeki

The HTML-first workflow is currently unreleased local-checkout development. The
published npm version remains **0.4.0** and uses the legacy composition JSON
workflow. Do not use `konpeki@latest` expecting the HTML commands below.

## Source-checkout HTML workflow

Use Node.js and pnpm versions pinned by `mise.toml`:

```sh
mise trust
mise install
mise exec -- pnpm install --frozen-lockfile
```

Run the checkout CLI directly. Install the pinned CLI browser explicitly when
inspection or export needs it:

```sh
mise exec -- node bin/konpeki.mjs browser install
```

That Chromium is for the agent/runtime machine. It is not required by artifact
recipients or human preview reviewers, and preview itself does not require
headless Chromium.

Create `document.html` in the agent workspace and follow [html/README.md](html/README.md).
Keep its local images, stylesheets, and fonts beside it. A normal loop is:

```sh
mise exec -- node bin/konpeki.mjs validate document.html
mise exec -- node bin/konpeki.mjs inspect document.html
mise exec -- node bin/konpeki.mjs render document.html --format png --scale 2 --output page-1.png
```

Use `preview` only when human review is useful. See [docs/workflow.md](docs/workflow.md).

The bundled starter is `skills/konpeki/assets/blank.html`. To create it without
overwriting an existing document, run
`mise exec -- node skills/konpeki/scripts/prepare-document.mjs bin/konpeki.mjs document.html`.
`ensure-runtime.mjs --html` probes HTML support without downloading a legacy
runtime. On minimal Linux images, Chromium also needs its system libraries;
`mise exec -- pnpm exec playwright install-deps chromium` installs them using the
host's package manager and may require administrator approval.

## Released legacy workflow

The runtime helper without `--html` still resolves pinned `konpeki@0.4.0` for
existing JSON documents. This is a compatibility path; the current skill's
authoring instructions describe the unreleased HTML workflow:

```sh
npx skills add vcfgdev/konpeki -g
node "<installed-skill>/scripts/ensure-runtime.mjs"
```

This released path remains available for existing documents and gallery examples;
it is not the recommended source format for new checkout-based HTML work.
