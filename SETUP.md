# Set up Konpeki

Konpeki has not been published to npm. The repository's `0.4.0` version is not an
available npm release. Use a source checkout for HTML and legacy JSON commands;
do not use `npm install konpeki` or `konpeki@latest` for this setup.

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
`ensure-runtime.mjs --html` probes an available runtime without downloading one.
On minimal Linux images, Chromium also needs its system libraries;
`mise exec -- pnpm exec playwright install-deps chromium` installs them using the
host's package manager and may require administrator approval.

## Skill and legacy documents

Install the authoring skill separately from the runtime:

```sh
npx skills add vcfgdev/konpeki -g
```

The helper can find a prepared checkout when the skill is inside that checkout,
or a compatible local package. A standalone skill does not contain the runtime;
use the checkout's `bin/konpeki.mjs` if it cannot find one. The same checkout CLI
accepts existing composition JSON documents. JSON is a compatibility path, not
the recommended source format for new work.
