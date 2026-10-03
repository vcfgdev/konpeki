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
agent reads shared guidance, the matching [output guide](skills/konpeki/SKILL.md#choose-the-output-guide),
and relevant content patterns. Guides cover landscape slides, résumés, multi-page
documents, one-pagers/cards, and covers/social graphics without imposing fixed
layouts. The agent writes static HTML with fixed-size pages, then repeats a
short loop until the pages are sound:

1. `validate` checks the source contract: explicit pages, stable IDs, local
   resources, and no scripts.
2. `inspect` renders the pages in Chrome or Chromium and reports overflow,
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

Use Node.js 24+ and install the exact version in your document workspace.
Check availability with `npm view konpeki@0.4.0 version`; if the registry does not
have it, use a [source checkout or local tarball](SETUP.md) instead. The 0.3.x
runtime is incompatible with this workflow.

```sh
npm install --save-exact konpeki@0.4.0
npx --no-install konpeki browser install
```

Create a starter with its theme beside it, then run the loop:

```sh
node node_modules/konpeki/skills/konpeki/scripts/prepare-document.mjs node_modules/konpeki/runtime/konpeki.mjs work/document.html
npx --no-install konpeki validate work/document.html
npx --no-install konpeki inspect work/document.html
npx --no-install konpeki render work/document.html --page 1 --format png --scale 2 --output work/page-1.png
npx --no-install konpeki render work/document.html --format pdf --output work/document.pdf
npx --no-install konpeki preview work/document.html
```

The browser is needed for `inspect`, `check` and `render`, not for `preview`. On
minimal Linux hosts, Chromium may need system libraries; see [SETUP.md](SETUP.md).
The source checkout [uses installed Chrome or Chromium by default](SETUP.md#reuse-installed-chrome-or-chromium),
with the pinned headless shell as a fallback when neither is found. Published
0.4.0 still requires `browser install`.

To let your coding agent do the authoring, install the skill separately:

```sh
npx skills add vcfgdev/konpeki -g
```

Installing the skill does not install the runtime. The skill's
`ensure-runtime.mjs` finds a Konpeki 0.4.0 checkout or a `konpeki` package
installed in the current workspace, and never downloads one.

## Upgrading from 0.3.x

0.4.0 replaces JSON compositions and the previous editing engine with static
HTML/CSS. Old JSON files do not open in this version, and there is no automatic
conversion. Keep an isolated 0.3.x installation for old work, or recreate it in
HTML while preserving its facts, assets and intended layout.

- Delivery formats are PNG and PDF; SVG can be authored inline, but is not an
  export format. Inspection and export require Chromium.
- Review uses browser-local comments and **Copy & clear**, not the old
  `wait` / `request` / `finish` CLI protocol. Update the skill and runtime together.
- Cobalt is the single bundled theme. Its Google Fonts dependency requires
  network access unless you adapt the theme to local or embedded fonts.
- Review includes opt-in [Vim keyboard navigation and element hints](html/README.md#keyboard-review).

The [public comment preview](https://vcfgdev.github.io/konpeki/) opens the
packaged starter. Use the CLI's `preview` to review your own document; local
changes stay local until a separately authorized release or deployment.

## Theme

Konpeki bundles one theme, Cobalt: cobalt blue on a light canvas with IBM Plex
Sans and Mono from Google Fonts. Its CSS contract lets a brief supply its own
visual treatment by adapting a copy; composition stays in HTML and page-owned CSS.

The default theme needs access to Google Fonts during preview, inspection, and
export. Exports fail if fonts cannot load or glyphs fall back to installed fonts.
For offline or reproducible rendering, use licensed local or embedded fonts in
the document's theme. Finished PNGs and PDFs need no network access.

## Documentation

- [Konpeki skill](skills/konpeki/SKILL.md): the authoring and revision workflow
- [HTML, files, theme, and CLI](html/README.md)
- [Theme contract](html/theme.md) and [theme authoring](html/theme-authoring.md)
- [Authoring floor: bans, defaults and review checklist](skills/konpeki/floor.md)
- [Editorial and visual judgment](AUTHORING.md)
- [Setup](SETUP.md), [development](docs/development.md) and
  [contributing](CONTRIBUTING.md)

## License

[Apache-2.0](LICENSE). Fonts and other dependencies retain their own licenses.
