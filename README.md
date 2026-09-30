# Konpeki

Konpeki helps a coding agent turn a brief and source material into finished
visuals: covers, social graphics, diagrams, charts, explainers, documents, and
presentations. Ordinary HTML and CSS are the editable source. Konpeki validates
that source, inspects the rendered pages, opens a review preview, and exports PNG
or PDF.

PNG and PDF are the delivery artifacts; recipients do not need Konpeki,
Playwright, or Chromium to view them. Konpeki requires no account or hosted AI
service. Your coding agent's pricing and data handling still apply.

## How it works

The [Konpeki skill](skills/konpeki/SKILL.md) owns the authoring workflow. The
agent writes static HTML with fixed-size pages, then repeats a short loop until
the pages are sound:

1. `validate` checks the source contract: explicit pages, stable IDs, local
   resources, and no scripts.
2. `inspect` renders the pages in the pinned Chromium and reports overflow,
   clipping, text overlap, low contrast, small text, font fallback, theme
   compliance, and [authoring floor](skills/konpeki/floor.md) rules as JSON.
3. `render` exports a page or document and prints the review checklist for the
   judgment calls no check covers. It refuses to write output while errors
   remain and never overwrites an existing file.

`preview` opens a local board where a person can comment on elements and make
small source-backed moves, then copy that feedback back to the agent.

Automated checks do not establish factual correctness or visual quality. Supply
the facts and approved assets; examples and placeholders are not evidence about
real products.

## Quick start

Konpeki 0.4.0 runs from a source checkout or a locally packed tarball. With
[mise](https://mise.jdx.dev/) installed:

```sh
git clone https://github.com/vcfgdev/konpeki.git && cd konpeki
mise trust && mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- node bin/konpeki.mjs browser install
```

Create a starter with its theme and bundled fonts beside it, then run the loop:

```sh
node skills/konpeki/scripts/prepare-document.mjs bin/konpeki.mjs work/document.html
node bin/konpeki.mjs validate work/document.html
node bin/konpeki.mjs inspect work/document.html
node bin/konpeki.mjs render work/document.html --page 1 --format png --scale 2 --output work/page-1.png
node bin/konpeki.mjs render work/document.html --format pdf --output work/document.pdf
node bin/konpeki.mjs preview work/document.html
```

The browser is needed for `inspect`, `check` and `render`, not for `preview`. On
minimal Linux hosts, Chromium may need system libraries; see [SETUP.md](SETUP.md).

To let your coding agent do the authoring, install the skill separately:

```sh
npx skills add vcfgdev/konpeki -g
```

Installing the skill does not install the runtime. The skill's
`ensure-runtime.mjs` finds a Konpeki 0.4.0 checkout or a `konpeki` package
installed in the current workspace, and never downloads one.

## Status and installation

Konpeki 0.4.0 is not on npm. The `konpeki` package currently on npm (0.3.x) is an
earlier release that the 0.4.0 skill does not accept, so `npm install konpeki`
does not give you this version. Use a prepared source checkout, or pack a tarball
from a trusted checkout and install it by path:

```sh
mise exec -- pnpm pack
npm install --no-save /path/to/konpeki-0.4.0.tgz
```

See [SETUP.md](SETUP.md) for both paths.

The [public comment preview](https://vcfgdev.github.io/konpeki/) opens the
packaged starter. Use the CLI's `preview` to review your own document; local
changes stay local until a separately authorized release or deployment.

## Theme

Konpeki bundles one theme, Cobalt: cobalt blue on a light canvas with local IBM
Plex Sans and Mono. Its CSS contract lets a brief supply its own visual treatment
by adapting a copy; composition stays in HTML and page-owned CSS.

## Documentation

- [Konpeki skill](skills/konpeki/SKILL.md): the authoring and revision workflow
- [HTML, files, theme, and CLI](html/README.md)
- [Theme contract](html/theme.md) and [theme authoring](html/theme-authoring.md)
- [Authoring floor: bans, defaults and review checklist](skills/konpeki/floor.md)
- [Editorial and visual judgment](AUTHORING.md)
- [Setup](SETUP.md), [development](docs/development.md) and
  [contributing](CONTRIBUTING.md)

## License

[Apache-2.0](LICENSE). Bundled IBM Plex Sans and Mono files retain the SIL
Open Font Licenses in [`fonts/OFL.txt`](fonts/OFL.txt) and
[`fonts/plex-mono-OFL.txt`](fonts/plex-mono-OFL.txt).
