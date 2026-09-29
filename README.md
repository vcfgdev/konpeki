![Konpeki — Create clear visuals with your coding agent](slides/github-cover/cover.png)

**Create finished visuals with your coding agent.** Give it a brief, source
material and any visual references. It creates, checks and renders the result,
then delivers editable composition JSON and the PNG, SVG or PDF files you need.

Use Konpeki for covers, social graphics, diagrams, charts, explainers, documents
and presentations. It provides:

- **Design guidance.** A restrained default that gives way to your brief or
  reference. The agent chooses the visual form and layout from your material.
- **A dedicated rendering engine.** Text measurement and layout checks, with
  one scene driving the browser preview and PNG/SVG/PDF exports.
- **Editable source.** Text, component placement and vector artwork stay in
  composition JSON for later revisions.

The agent delivers a finished visual whether or not you open the preview.
The optional browser canvas is for comments and small layout corrections.

## Use with your agent

Requires **Node.js 24+**, npm, and a coding agent that can edit files and run
commands.

Install once, choosing your agent when prompted:

```sh
npx skills add vcfgdev/konpeki -g
```

Start a new conversation or reload your agent's skills. **Send this to your agent:**

> Use Konpeki to create a one-page explainer of how a browser, API and database work together.

Replace the example with your own brief and materials. Your agent prepares the
runtime, creates editable JSON in your workspace, checks it, renders a 2x PNG,
and visually inspects the result before delivery. First use may require
installation permission. See [setup details](SETUP.md) for other install methods.

Keep revisions in the same conversation. Ask for wording and design changes
directly, or use the optional preview to point at what should change.

## Showcase

Each example includes composition JSON so your agent can revise its text and
vector artwork. Click an image to view it full-size, or download the JSON and
drop it into the [preview](https://vcfgdev.github.io/konpeki/).

<table>
  <tr>
    <td width="50%" align="center" valign="top">
      <a href="slides/gallery/architecture.png"><img src="slides/gallery/architecture.png" width="420" alt="Harbor Market order-platform architecture"></a><br>
      <strong>Explain a system</strong><br>
      Order handling, events and fulfillment<br>
      <a href="slides/gallery/architecture.json">Editable JSON</a>
    </td>
    <td width="50%" align="center" valign="top">
      <a href="slides/gallery/sankey.png"><img src="slides/gallery/sankey.png" width="420" alt="Proportional Sankey showing a fictional 1,000-user trial cohort"></a><br>
      <strong>Communicate data</strong><br>
      Trial users, activation and outcomes<br>
      <a href="slides/gallery/sankey.json">Editable JSON</a>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center" valign="top">
      <a href="slides/gallery/release.png"><img src="slides/gallery/release.png" width="420" alt="Clearpath 0.4 portrait release announcement in orange"></a><br>
      <strong>Announce a release</strong><br>
      A portrait social graphic for Clearpath<br>
      <a href="slides/gallery/release.json">Editable JSON</a>
    </td>
    <td width="50%" align="center" valign="top">
      <a href="slides/gallery/explainer.png"><img src="slides/gallery/explainer.png" width="420" alt="Folio one-page explainer showing accepted and rejected document saves"></a><br>
      <strong>Teach a concept</strong><br>
      One-page guide to preventing stale saves<br>
      <a href="slides/gallery/explainer.json">Editable JSON</a>
    </td>
  </tr>
</table>

[Browse the gallery](slides/README.md) for briefs, sources and more examples.

## Review in the browser

[Try the Konpeki preview](https://vcfgdev.github.io/konpeki/?example=introducing-konpeki).

All pages sit on one canvas, with arrows showing their order. Pan and zoom to
inspect the work. You can move, resize or delete components, with alignment
guides and undo. **Text and design changes go through your agent or source JSON;
there is no inline text editor.**

To request a revision:

1. Click **Comment**, then select a page or component. You can also double-click
   a component to open its nearby comment field.
2. Write what should change and click **Add**. Comments leave numbered markers.
3. Click **Copy & clear** in the review queue, then paste the prompt into your
   agent conversation. It includes the comments and their target IDs.

Copying clears the copied batch with an **Undo** option; it does not invoke the
agent or mean the changes are done. Comments stay in your browser, separate
from the composition and exports.

A file-backed preview saves layout corrections to the composition JSON and loads
valid agent revisions. The standalone playground keeps a browser-local copy;
download its JSON and share it with your agent when needed. Browser storage is
not a backup. See the [canvas workflow](docs/workflow.md) for shortcuts, saving
and comment recovery.

## Use the CLI directly

Install [Konpeki from npm](https://www.npmjs.com/package/konpeki)
in your workspace (run `npm init -y` first in a new, empty directory):

```sh
npm install --save-dev konpeki@latest
curl -fL https://raw.githubusercontent.com/vcfgdev/konpeki/main/slides/introducing-konpeki/composition.json -o introduction.json
npm exec --no -- konpeki inspect introduction.json
npm exec --no -- konpeki render introduction.json --page 1 --format png --scale 2 --output introduction-page-1.png
```

`inspect` reports measured layout and diagnostics. Rendered output still needs
visual review. `render` also supports SVG and PDF; PDF includes every page unless
`--page` is supplied. Output files must not already exist.

For an optional file-backed preview:

```sh
npm exec --no -- konpeki preview introduction.json
```

Open the exact URL printed by `preview`. It grants editing access to that file;
do not publish it. In a remote environment, use authenticated forwarding.

## Examples and guides

- [Native example gallery](slides/README.md): editable diagrams, data graphics,
  a social announcement and a one-page explainer, plus the product introduction
  and repository cover. Older React/SVG drawing references remain separate.
- [Agent-led setup](SETUP.md) and [authoring guidance](AUTHORING.md).
- [Canvas workflow](docs/workflow.md): page sizes, export and agent handoff.
- [Development](docs/development.md): architecture, demo hosting, packaging and checks.
- [Composition contract](composition/README.md) and [design resources](design/README.md).
- [Contributing](CONTRIBUTING.md) and [security policy](SECURITY.md).

Konpeki requires no account or hosted AI service. Your coding agent's pricing
and data handling still apply. Supply facts and approved assets; examples and
component placeholders are not evidence about real products.

## License

[Apache-2.0](LICENSE). Dependencies and bundled fonts retain their own licenses;
external design references are credited where used.
