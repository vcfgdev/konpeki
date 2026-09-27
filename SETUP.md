# Set up Konpeki for your coding agent

Requires Node.js 24+, npm, and an agent with file and command access. A browser is
optional for the agent workflow.

```sh
npx skills add vcfgdev/konpeki -g
```

Reload skills, then ask the agent to use Konpeki with your brief. Install the
complete `skills/konpeki` directory when using a native installer; it includes
scripts and the canonical blank asset. The root `plugin.json` distributes the
same skill without hooks, credentials, or MCP servers.

The skill resolves pinned `konpeki@0.4.0` with:

```sh
node "<installed-skill>/scripts/ensure-runtime.mjs"
```

It reuses a matching project install, checkout, or cache. If none exists, approve
installation and rerun with `--install`; this uses a user cache and does not alter
project dependencies. The command prints absolute `root`, `cli`, and `version`
values. Keep authored documents outside that runtime.

To create the canonical v2 blank or validate an existing document without
rewriting it:

```sh
node "<installed-skill>/scripts/prepare-document.mjs" "<cli>" "slides/my-visual/composition.json"
```

Normal authoring follows a direct loop: write the IR, run `check`, fix, render a
2x PNG, inspect it, and repeat before delivery. Preview is optional:

```sh
node "<cli>" preview "slides/my-visual/composition.json"
```

If used, preserve the printed session query and use authenticated forwarding in
remote workspaces. The human can edit the same revision-checked composition and
leave notes or pins for a subsequent chat revision. See [the workflow](docs/workflow.md).
