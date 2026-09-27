![Konpeki — Create clear visuals with your coding agent](slides/github-cover/cover.png)

**Create clear visuals with your coding agent.** Konpeki is an opinionated design
framework for covers, social graphics, visual explanations and presentations.

Give your coding agent notes, source material and a brief. Konpeki provides the
canvas, design guidance, typography and semantic components for the intended
format and dimensions.

People and agents edit the same v2 composition. The owned scene drives preview,
checks, PNG/SVG/PDF output, and **Present**.

## Use with your agent

Requires **Node.js 24+**, npm, and a coding agent that can edit files and run
commands. A browser is optional for human editing and presentation.

Install once, choosing your agent when prompted:

```sh
npx skills add vcfgdev/konpeki -g
```

Start a new conversation or reload your agent's skills. **Send this to your agent:**

> Use Konpeki to create a one-page explainer of how a browser, API and database work together.

Replace the example with your own brief and materials. Your agent prepares the
runtime, creates editable JSON in your workspace, checks it, renders a 2x PNG,
and inspects the result. A browser preview is optional. First use may require
installation permission.

Keep revisions in the same conversation. Optional canvas notes and pins remain
attached to the revision-checked file session for the next agent edit. See
[setup details](SETUP.md) for other install methods.

## Try the editor in your browser

[Open the editable Konpeki example](https://vcfgdev.github.io/konpeki/?example=introducing-konpeki).

The browser-only playground lets you edit an example or start blank, keep a local
working copy, import/download editable JSON, export PNG/SVG/PDF and present. It requires
no account or AI service. Browser-local data is not cloud backup; download JSON
to keep or move your work. Continue with your coding agent using that file.

The playground does not connect to an agent. The agent-led workflow above is the
route from a prompt to a checked and visually inspected composition.

## Showcase

Illustrative examples with editable text and vector artwork. Click a preview to
view it full-size, or download its JSON and choose **Demo Mode → Import** in the
[playground](https://vcfgdev.github.io/konpeki/).

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

## Manual npm start

For a manual start, install [Konpeki from npm](https://www.npmjs.com/package/konpeki)
in your workspace (run `npm init -y` first in a new, empty directory):

```sh
npm install --save-dev konpeki@latest
curl -fL https://raw.githubusercontent.com/vcfgdev/konpeki/main/slides/introducing-konpeki/composition.json -o introduction.json
npm exec --no -- konpeki preview introduction.json
```

Open the exact URL printed by `preview`. Browser edits save to your downloaded file;
valid agent edits appear on the same canvas. In a remote environment, use its
authenticated preview mechanism rather than sharing a local address.

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
