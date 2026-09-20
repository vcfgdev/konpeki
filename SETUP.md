# Set up Konpeki for your coding agent

Give your agent this document and your brief in the same conversation:

```text
Read Konpeki's SETUP.md and set it up in this workspace.
Use it to explain [source] to [audience], with the takeaway [idea].
Create [one visual / a short presentation]. Open the editable preview,
then render, inspect and fix the result.
```

Konpeki is a shared visual canvas, not an AI service. The coding agent creates
and revises composition files; the browser lets the person edit, review, present
and export them. Keep the initial brief and revision conversation in the coding
agent. An in-app browser is convenient but not required.

## 1. Prepare the environment

- Check for Node.js 24+ (`node --version`), pnpm (`pnpm --version`), and a browser
  the agent can use for visual inspection. Report missing prerequisites rather
  than claiming setup succeeded. Follow the host's rules for installing tools.
- Reuse an existing Konpeki checkout when available. Otherwise clone into a new
  directory; do not overwrite the user's project or replace its agent guidance.
- Konpeki is not yet published to npm. Do not substitute `npx konpeki` or install
  an unrelated package with the same name.

```sh
git clone https://github.com/vcfgdev/konpeki.git
cd konpeki
pnpm install --frozen-lockfile
```

Repository access is required. If cloning fails, report the access issue rather
than looking for a different distribution. Run subsequent commands from the
Konpeki checkout; copying the skill alone does not install the runtime.

## 2. Read the authoring instructions

Read [AGENTS.md](AGENTS.md), then use the
[authoring-visuals skill](.agents/skills/authoring-visuals/SKILL.md). If the agent
does not discover project skills, read that file directly. It links to the design
policy and composition contract; no special slash command is required.

Use the brief already supplied. Ask only for missing information that prevents
a faithful result. Do not ask the person to re-enter their intent in the canvas.
Create a new document without overwriting an example or existing work. By default,
save it as `slides/<name>/composition.json` with its brief and source notes beside
it. If the user specifies another destination, pass that file's absolute path to
the CLI.

## 3. Validate and open the result

For an installation check, validate the bundled introduction:

```sh
pnpm konpeki validate slides/introducing-konpeki/composition.json
```

After authoring the user's document:

```sh
pnpm konpeki validate slides/<name>/composition.json
pnpm konpeki preview slides/<name>/composition.json
```

Keep the preview process running using the host's supported service mechanism.
Open the exact printed session URL; do not drop its query string or expose its
token in public logs. For remote workspaces, use the host's authenticated preview
or port-forwarding mechanism, preserving the session query. Do not present a
remote machine's loopback address as a user-accessible link.

Verify that the browser loads the intended document, then render, inspect and
repair the result as directed by the skill. The file-backed canvas saves browser
edits to that document and loads valid external edits. Setup is complete when
validation succeeds and the intended composition opens—not merely when a server
process starts. If browser inspection is unavailable, report that limitation.

Return the document path, usable preview link and verification outcome. Continue
revisions in agent chat. The optional **Build it** / `wait` handoff is described in
[Canvas workflow](docs/workflow.md); the button cannot wake an agent by itself.
