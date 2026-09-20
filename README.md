# Konpeki

**An editable canvas for agent-made visuals. Create a single explanation or a
whole presentation, then revise it together.**

Give your coding agent notes, source material and a brief. Konpeki provides the
shared canvas, design guidance, typography and semantic components for social
graphics, article headers, visual explanations and presentations.

People and agents edit the same composition. Export a page as PNG, download its
editable JSON, or use **Present** for a chrome-free presentation.

## Start in your coding agent

Requires **Node.js 24+**, **pnpm**, a coding agent that can edit files and run
commands, and a browser. Konpeki is currently distributed as this repository,
not a published npm package.

For agent-led installation, give your agent [SETUP.md](SETUP.md) and your brief.
For a manual quickstart:

```sh
git clone https://github.com/vcfgdev/konpeki.git
cd konpeki
pnpm install --frozen-lockfile
pnpm konpeki preview slides/introducing-konpeki/composition.json
```

Open the exact URL printed by `preview`. Browser edits save to the composition
file; valid agent edits appear on the same canvas. In a remote environment, use
its authenticated preview mechanism rather than sharing a local address.

Open the repository in your coding agent and select the
[`authoring-visuals` skill](.agents/skills/authoring-visuals/SKILL.md), if supported.
Otherwise, ask the agent to read [AGENTS.md](AGENTS.md) and [AUTHORING.md](AUTHORING.md).
Give your brief in the agent's prompt field:

```text
Use Konpeki to turn these notes into a three-slide explanation for engineers.
Make the request flow and failure handling easy to follow. Preserve facts and
caveats. Save editable composition JSON, then render, inspect and fix the result.

[Paste notes or provide source files.]
```

Ask for revisions in the same conversation. Add “Stop after the outline for
approval” when you want a checkpoint. Supply a visual direction or leave it open;
[authoring modes](AUTHORING.md#authoring-mode) provide defaults without requiring
you to choose fonts, colors or layouts first.

## Examples and guides

- [Example gallery](slides/README.md): 18 fictional examples and an editable
  Konpeki introduction. Retained React/SVG examples are drawing references;
  new editable documents use composition JSON.
- [Agent-led setup](SETUP.md) and [authoring guidance](AUTHORING.md).
- [Canvas workflow](docs/workflow.md): page sizes, export and agent handoff.
- [Development](docs/development.md): architecture, demo hosting, packaging and checks.
- [Composition contract](composition/README.md) and [design resources](design/README.md).

Konpeki requires no account or hosted AI service. Your coding agent's pricing
and data handling still apply. Supply facts and approved assets; examples and
component placeholders are not evidence about real products.

## License

[Apache-2.0](LICENSE). Dependencies and bundled fonts retain their own licenses;
external design references are credited where used.
