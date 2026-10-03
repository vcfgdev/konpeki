# Set up Konpeki

Use Node.js 24+ and the matching Konpeki 0.4.0 runtime and skill. A repository
version or locally packed tarball does not establish that the npm release exists.

## npm package

Check the exact version before installing:

```sh
npm view konpeki@0.4.0 version
```

If it returns `0.4.0`, install in the workspace that will author your documents:

```sh
npm install --save-exact konpeki@0.4.0
npx --no-install konpeki browser install
```

Run commands with `npx --no-install konpeki`. If the version is unavailable, use
one of the local paths below; do not substitute the incompatible 0.3.x runtime.

## Source checkout

With [mise](https://mise.jdx.dev/) installed, use the pinned toolchain:

```sh
git clone https://github.com/vcfgdev/konpeki.git
cd konpeki
mise trust
mise install
mise exec -- pnpm install --frozen-lockfile
```

The browser is needed for inspection and export, not preview or artifact viewing.
The checkout automatically uses installed Chrome or Chromium. If neither is
found, it uses Playwright's pinned headless shell. Only if you need that shell,
run `mise exec -- node bin/konpeki.mjs browser install`; this downloads the shell
and supporting tools, reusing matching versions in Playwright's shared cache.
On minimal Linux hosts, its system libraries may require administrator-approved
installation with `mise exec -- pnpm exec playwright install-deps chromium`.

Run the checkout CLI as `mise exec -- node bin/konpeki.mjs`. The authoring loop
is in the [skill](skills/konpeki/SKILL.md); CLI rules are in
[html/README.md](html/README.md).

### Reuse installed Chrome or Chromium

The source checkout discovers installed browsers automatically; the published
0.4.0 package still requires the pinned browser. With installed Chrome or Chromium,
skip `browser install` and run the checkout CLI normally:

```sh
mise exec -- node bin/konpeki.mjs inspect document.html
mise exec -- node bin/konpeki.mjs render document.html --format png --output post.png
mise exec -- node bin/konpeki.mjs render document.html --format pdf --output post.pdf
```

Detection checks standard macOS and Windows application locations and browser
names on `PATH`; see [browser selection](html/README.md#cli) for details. To select
a specific executable, append `--browser-executable "/path/to/chrome"` to
`inspect`, `check`, or `render`. This option is also checkout-only. Quote paths
containing spaces; relative paths resolve from the working directory.

Konpeki starts an isolated headless process and leaves your existing browser
session alone. A detected or explicitly selected browser failing to launch is an
error, not a request to install or switch browsers. Layout and font checks still
run; Lightpanda is not a compatible renderer. For reproducibility, select a known
browser binary explicitly and keep its version fixed.

## Local tarball

From a prepared trusted checkout, build and pack without publishing:

```sh
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm pack
```

Install the resulting `.tgz` by local path in the workspace that will author the
document, for example `npm install --no-save /path/to/konpeki-0.4.0.tgz`. This is
a local package install, not evidence of an npm release. Run its CLI with
`npx --no-install konpeki`; it uses the checkout's installed-browser-first behavior.

## Skill helpers

Install the authoring skill separately:

```sh
npx skills add vcfgdev/konpeki -g
```

`ensure-runtime.mjs` takes no arguments. It discovers either the containing
checkout or a compatible locally installed `konpeki` package and prints its CLI
location; it does not download or modify a runtime.

`prepare-document.mjs` takes `<cli> <document.html> [--template blank|x-post]`.
It creates the selected starter HTML (blank by default), `theme.css`, and
`theme-base.css` beside the document. It validates the result and never overwrites
existing files, even when a different template is requested. The default theme
loads IBM Plex Sans and Mono from Google Fonts, so preview and export need network
access. For offline rendering, adapt the document's theme to use licensed local
or embedded fonts.

```sh
node node_modules/konpeki/skills/konpeki/scripts/prepare-document.mjs node_modules/konpeki/runtime/konpeki.mjs document.html
```

From a source checkout, use
`mise exec -- node skills/konpeki/scripts/prepare-document.mjs bin/konpeki.mjs document.html`.
Append `--template x-post` for a light/dark post card with optional local media.
See the [post-card guide](skills/konpeki/references/cover.md#x-style-post-card)
for editing its content, appearance, size and attribution.
See [Upgrading from 0.3.x](README.md#upgrading-from-03x) before migrating old work.
