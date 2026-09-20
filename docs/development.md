# Development

Clone `https://github.com/vcfgdev/konpeki.git` with the required repository access.
Use [mise](https://mise.jdx.dev/getting-started.html) to install the Node.js and
pnpm versions pinned in `mise.toml`. On macOS, install mise with `brew install mise`.
From the repository root:

```sh
mise trust
mise install
mise exec -- pnpm install --frozen-lockfile
```

Mise manages the toolchain; pnpm manages dependencies through `pnpm-lock.yaml`.
Run the commands below from that repository root with an activated mise shell,
or prefix them with `mise exec --` (for example, `mise exec -- pnpm test`).
No global Node.js or pnpm installation is required. npm for packing and publishing
comes with the pinned Node.js; use `mise exec -- npm pack` to select it explicitly.

Development and regression checks require a repository checkout, not an npm
tarball, which excludes tests and review scripts.

## Development server and demo hosting

```sh
pnpm dev
```

For a production preview, run `pnpm build` then `pnpm preview`. The build produces
a static site in `dist` for a root or subdirectory. Use
`?example=introducing-konpeki` or `?example=custom-visual` to open a bundled editable
example. Example links do not autosave; open a composition in a file-backed
session to preserve edits.

Hosting shares bundled examples, not private drafts, arbitrary documents or an
AI service. No deployment is automatic. In a remote environment, expose the
server through its authenticated preview mechanism; a local address is not a
shareable URL.

## Implementation reference

- `src/` contains the shared canvas application for editing and presentation.
  The [versioned composition contract](../composition/README.md) preserves
  content, relationships and visual intent across human and agent revisions.
- `bin/` contains the file-session CLI and its revision-checked persistence.
- [AUTHORING.md](../AUTHORING.md) owns design defaults, factual fidelity and review.
  [Design resources](../design/README.md) provide palettes, themes and semantic
  patterns; these are choices, not mandatory layouts.
- `lib/text.tsx` supplies measured `Text` and `Paragraphs` with string or rich-text
  runs. Overset content is flagged, not automatically shrunk or hidden. Await
  `fontsReady` from `lib/typeface.ts` before measuring.
- `lib/slide.tsx` supplies specimen `Panel`, `Relationship` and 1920×1080 `Sheet`
  components. `Panel` shares one heading/body size; `Relationship` is a short
  directional glyph. Convert their SVG output to composition vectors for the canvas.
- `lib/layouts.ts` supplies fixed-gutter regions, not a content-fitting solver.
- Retained React chart references use Nivo `Bar`, `Line` and `Sankey` with
  `chartDefaults(palette)` from `lib/charts.ts` spread before chart-specific props.
  Keep data, dimensions, scales and semantic colors in the deck. Use explicit
  label colors and `linkBlendMode="normal"` for Sankey.

### React/SVG drawing references

The retained `slides/*/index.tsx` files are presentation-runtime-independent
drawing references. They are checked as source but are not discovered as routes
or executed by a second presentation runtime. New decks use composition JSON;
a trusted build may render React to SVG, then convert supported elements into
the owning component's editable vector payload.

To migrate the retained architecture reference into the shared canvas:

```sh
pnpm example:migrate-page slides/architecture/index.tsx all /tmp/architecture-composition.json
```

Drag the resulting JSON onto the canvas, edit its vectors, and use **Present**.
Replace `all` with a zero-based page index for one page. This command executes
trusted local React source; never use it on untrusted JSX. It rejects unsupported
SVG elements rather than silently flattening them. Review converted typography
and geometry in the browser; conversion is not a fidelity guarantee.
The bundled `?example=react-page-migration` preview uses the same format.
Example previews do not autosave; use a file-backed session to save edits.

## Package contents

`package.json` explicitly allowlists the npm payload: the source-based Vite
runtime and file-session CLI, authoring guidance and design resources, and named
curated examples with editable source and prompts. New example directories are
not included automatically. Gallery screenshots, tests, research fixtures,
browser review scripts, original branding assets, lockfiles and UI build output
stay in the repository.

`npm pack` builds the JavaScript CLI in `runtime/` automatically because Node
cannot load its TypeScript source from inside `node_modules`. That generated
CLI is included in the package.

Run `pnpm check:package` before preparing a release. It checks npm's file selection,
required resources, excluded development files and relative imports. For an
installation smoke test, use `npm pack --pack-destination <temporary-dir>`, install
the tarball in an empty project, then run its `konpeki validate` and `konpeki preview`
commands against a composition outside the installed package. Do not publish
until that isolated preview works. Publish the tested tarball rather than
rebuilding during publication. Packing locally does not publish anything.

## Tag releases

`.github/workflows/publish.yml` stages releases on bare version tags such as `0.1.1`
(no `v` prefix). The tag must equal `package.json`'s version.
The workflow installs the mise toolchain and frozen dependencies, runs typecheck,
tests, build and package checks, then installs a tarball in an isolated directory
to validate a composition and build the packaged canvas. It stages that same
tarball for maintainer approval; it does not publish directly. Browser review
remains a pre-release responsibility.

Before the first tag release, configure **Trusted publishing → GitHub Actions**
in the `konpeki` package settings on npmjs.com:

- Organization or user: `vcfgdev`
- Repository: `konpeki`
- Workflow filename: `publish.yml`
- Environment name: leave empty
- Leave **Allow npm publish** unchecked (staged publishing only)

The workflow uses GitHub-hosted runners and OIDC (`id-token: write`); no npm
token secret is needed. Staged publishing requires npm 11.15.0 or newer and
Node 22.14.0 or newer; the pinned toolchain meets both requirements.
npm generates provenance automatically for public repositories;
private repositories do not receive provenance.

After updating the package version, completing release checks and pushing the
release commit, explicitly create and push its matching tag:

```sh
git tag 0.1.1
git push origin 0.1.1
```

Replace `0.1.1` with the new version. `0.1.0` is already published and cannot be
republished. Pushing a matching tag submits the tested package to npm's staging
area. After the workflow succeeds, review the release in npmjs.com's **Staged
Packages** tab and click **Approve**, completing 2FA to publish it. Alternatively,
use an authenticated local CLI:

```sh
mise exec -- npm stage list konpeki
mise exec -- npm stage view <stage-id>
mise exec -- npm stage approve <stage-id>
```

Approval makes the version public. Reject an incorrect staged release instead
of approving it (`npm stage reject <stage-id>`).

## Verification

```sh
pnpm check
pnpm test
pnpm build
pnpm check:package
```

With the dev server running and `agent-browser` installed:

```sh
node scripts/check-canvas.mjs http://localhost:4318 .amp/in/artifacts
node scripts/check-pages.mjs http://localhost:4318 .amp/in/artifacts/pages
```

For the Build it lifecycle, `node scripts/check-build.mjs` starts its own
disposable file session. It checks pending requests, agent refresh, failure
recovery and reduced motion, and captures the affected states. Add an output
directory and `--record` to also record the animation.

These checks exercise all five component kinds, empty slides, JSON round trips,
vector editing/history and fitted line dragging. They capture editor and
presentation states at two sizes; inspect the images because assertions alone
do not establish visual correctness.

Documentation changes need link and instruction checks. Deck changes need
typecheck, build, relevant fixture checks and actual visual inspection. Shared
component, theme or dependency changes also need the full test suite and
representative affected decks. A build can report a large-framework-chunk advisory.

Render affected pages at presentation and review sizes after fonts load. Inspect
text, clipping, relationships, contrast and cross-page consistency. Repair issues
and inspect fresh captures. Keep browser checks scoped to factual and layout
contracts, not universal taste. Record untested outputs and limitations with
the example; screenshots do not prove PDF/PPTX or cross-application fidelity.

When adding examples, preserve the exact creative requests, editable source,
source facts and reviewed images as described in [AUTHORING.md](../AUTHORING.md).
Examples demonstrate capabilities; there is no separate benchmark suite or
aesthetic score. Check font language subsets and license notices when
redistributing assets; dependencies retain their own licenses.
