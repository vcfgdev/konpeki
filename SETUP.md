# Set up Konpeki for your coding agent

Requires **Node.js 24+**, npm, a coding agent with file and command access, and a browser.

Install once, choosing your agent when prompted:

```sh
npx skills add vcfgdev/konpeki -g
```

Start a new conversation or reload your agent's skills. **Send this to your agent:**

> Use Konpeki to create a one-page explainer of how a browser, API and database work together.

Or use your own brief and materials. The agent prepares the runtime, creates the
document, opens the canvas and checks the result; no separate `init` step is
needed. Allow any required installation/browser permissions. Remote workspaces
need authenticated preview forwarding. Keep revisions in the same conversation.

## Other installers

For an unattended install, select a single agent (Amp example):

```sh
npx skills add vcfgdev/konpeki -g -a amp -y
```

This avoids auto-selecting unrelated agent targets when no terminal prompt is available.

You can also use your agent's native skill installer:

```text
Install the konpeki skill from vcfgdev/konpeki, at skills/konpeki.
```

Install the complete [`skills/konpeki`](skills/konpeki/) directory, including
`scripts/` and `assets/`. Follow the host's documented skill location; if it does
not discover skills, read the installed `SKILL.md` directly. Do not overwrite
existing agent guidance.

If you previously installed `authoring-visuals`, replace that installed skill
with `konpeki` rather than keeping both copies. The runtime package is unchanged.

## Optional commands

| Mode | Codex CLI / IDE | Claude Code standalone skill |
| --- | --- | --- |
| Open the editor without generating | `$konpeki init [composition.json]` | `/konpeki init [composition.json]` |
| Create or revise from your materials | `$konpeki generate [brief]` | `/konpeki generate [brief]` |

`generate` automatically prepares the runtime when needed. It uses materials
already supplied in chat, referenced files and the current canvas; it does not
require `init` first or a repeated brief. Natural-language “Use Konpeki to…”
creation requests also select generate. Follow-up feedback continues the same
document without another command. Other GUIs may use skill selection, and plugin
installations may namespace the skill. These modes are not terminal subcommands.

For `init`, choose the supplied path or the document already active in the
conversation; otherwise use `slides/untitled/composition.json`. After resolving
the runtime below, run:

```sh
node "<installed-skill>/scripts/prepare-document.mjs" "<cli>" "<composition.json>"
node "<cli>" preview "<composition.json>"
```

The helper validates existing files without rewriting them. For a missing file,
it validates and writes the bundled blank document without overwriting a file
created concurrently. Invalid data is preserved, not replaced with a sample.
Reuse an already running preview for the same file. Open and verify its exact
session URL as described below, then stop: init does not generate or start a
review listener. The starter works with the pinned published runtime; it does
not import TypeScript from `node_modules` or require an unreleased `init` CLI.

### Optional Codex plugin packaging

The root `plugin.json` packages that same skill, without MCP servers, hooks or
credentials. `.agents/plugins/marketplace.json` exposes it as a repo marketplace.
On a compatible Codex client, add the repository marketplace with:

```sh
codex plugin marketplace add vcfgdev/konpeki
```

Then install Konpeki from that source in the desktop plugin directory and test it
in a new conversation. Install either the standalone skill or the plugin, not
both. This is repository distribution, not a listing in OpenAI's public directory.
It becomes available from the remote repository after these files are published.
Native Codex GUI installation needs a separate client smoke test; package checks
alone do not establish host compatibility.

## Agent setup reference

The installed skill handles these steps; the person does not need to run them manually.

### Prepare the runtime

Check Node.js 24+, npm, command/file access and the host's browser capabilities.
Follow host approval and toolchain rules if prerequisites are missing.

From the user's document workspace, run:

```sh
node "<installed-skill>/scripts/ensure-runtime.mjs"
```

The script reuses a compatible workspace installation, surrounding Konpeki
checkout, or cached runtime. If none exists, obtain any required host approval
and rerun with `--install`. It installs the pinned `konpeki@0.3.1` release in a
user cache, without adding project dependencies or changing project guidance.
Missing/incompatible runtimes are never reported ready. The script prints JSON
with `root`, `cli` and `version`; installation diagnostics go to stderr.

Use the returned absolute `root` for resources and `cli` for commands. Do not rely
on repo-relative paths from a copied skill. Keep documents outside the runtime.
For manual project-local npm installation, see [Manual npm start](README.md#manual-npm-start).
Repository contributors instead use the [mise setup](docs/development.md); users
of the published package do not need mise.

### Generate, validate and open the visual

Follow the installed skill and the runtime's `AUTHORING.md`, composition contract
and design resources. Use the brief already supplied; ask only for information
needed for faithful work. Do not ask the person to repeat their prompt in the
canvas. Continue the current document when revising or following init. Save new
work to an unused `slides/<name>/composition.json`, with brief/source notes,
unless the person chooses another destination. Preserve existing documents.

For an installation check, validate the bundled example:

```sh
node "<cli>" validate "<root>/slides/introducing-konpeki/composition.json"
```

After authoring the user's document:

```sh
node "<cli>" validate "slides/<name>/composition.json"
node "<cli>" preview "slides/<name>/composition.json"
```

Reuse an existing preview for that file when available. Keep the process running
using the host's supported service mechanism. Open the exact printed session URL
in the in-app browser when supported, otherwise the regular browser. Preserve its
query string and never publish its capability token. In remote workspaces, use
authenticated preview/port forwarding, not a remote loopback address.

Verify that the browser loads the intended document, then render, inspect and
repair the result as directed by the skill. The file-backed canvas saves browser
edits to that document and loads valid external edits. Setup is complete when
validation succeeds and the intended composition opens—not merely when a server
process starts. If browser inspection is unavailable, report that limitation.

Return the document path, usable preview link and verification outcome. Continue
revisions in agent chat. For submitted canvas reviews, generate checks `request`,
claims a `submitted` request with `wait`, applies the notes against the latest
document, and acknowledges it with `finish` only after validation and inspection.
Coordinate ownership before resuming an already `working` request.

An ongoing listener runs only when explicitly requested and supported by the host.
Otherwise, use **Copy prompt** after **Build it**, or resume generate in agent chat.
The [canvas workflow](docs/workflow.md) describes this handoff; the button cannot
wake an idle agent, and an open preview is not a live agent connection.
