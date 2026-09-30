# Set up Konpeki

Konpeki is not published to npm yet. Use a
source checkout or a tarball packed locally from a trusted checkout. Do not
describe the repository version as a published release.

## Source checkout

Use the versions pinned by `mise.toml`:

```sh
mise trust
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- node bin/konpeki.mjs browser install
```

The browser is needed for inspection and export, not preview or artifact viewing.
On minimal Linux hosts, its system libraries may require administrator-approved
installation with `mise exec -- pnpm exec playwright install-deps chromium`.

Run the checkout CLI as `mise exec -- node bin/konpeki.mjs`. The authoring loop
is in the [skill](skills/konpeki/SKILL.md); CLI rules are in
[html/README.md](html/README.md).

## Local tarball

From a prepared trusted checkout, build and pack without publishing:

```sh
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm pack
```

Install the resulting `.tgz` by local path in the workspace that will author the
document, for example `npm install --no-save /path/to/konpeki-0.4.0.tgz`. This is
a local package install, not evidence of an npm release. Run its CLI with the
workspace package runner and install its browser before inspection or export.

## Skill helpers

Install the authoring skill separately:

```sh
npx skills add vcfgdev/konpeki -g
```

`ensure-runtime.mjs` takes no arguments. It discovers either the containing
checkout or a compatible locally installed `konpeki` package and prints its CLI
location; it does not download or modify a runtime.

`prepare-document.mjs` takes `<cli> <document.html>`. It creates the starter HTML,
`theme.css`, the three IBM Plex Sans font files, and `fonts/OFL.txt` beside the
document. It validates the result and never overwrites existing files:

```sh
node skills/konpeki/scripts/prepare-document.mjs bin/konpeki.mjs document.html
```
