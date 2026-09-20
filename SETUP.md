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

- Check for Node.js 24+ (`node --version`), npm (`npm --version`), and a browser
  the agent can use for visual inspection. Report missing prerequisites rather
  than claiming setup succeeded. Follow the host's rules for installing tools.
- Reuse an existing workspace when requested, or create a new directory. Do not
  overwrite the user's files or replace their agent guidance.
- Install the pinned release locally so the agent can find its resources and
  reuse the same CLI version. Do not edit files inside `node_modules`.

```sh
npm install --save-dev konpeki@0.1.0
```

In a new empty directory, run `npm init -y` first. Run subsequent commands from
the workspace where Konpeki was installed. Its resources are under
`node_modules/konpeki/`: `AGENTS.md`, `AUTHORING.md`, `composition/`, `design/`,
and `.agents/skills/authoring-visuals/SKILL.md`. If the package/version cannot be
resolved, report the installation issue rather than substituting another package.
Copying the skill alone does not install the runtime.

For repository development instead, clone `https://github.com/vcfgdev/konpeki.git`
with the required access, run `pnpm install --frozen-lockfile`, and use
`pnpm konpeki` in place of `npm exec --no -- konpeki` below.

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
npm exec --no -- konpeki validate node_modules/konpeki/slides/introducing-konpeki/composition.json
```

After authoring the user's document:

```sh
npm exec --no -- konpeki validate slides/<name>/composition.json
npm exec --no -- konpeki preview slides/<name>/composition.json
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
