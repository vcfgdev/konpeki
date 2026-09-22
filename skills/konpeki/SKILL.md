---
name: konpeki
description: Opens the Konpeki editor with init, or generates and revises editable visuals with generate. Use when asked to use Konpeki or create covers, social graphics, product announcements, charts, diagrams, article headers or presentations.
compatibility: Requires Node.js 24+, npm, a coding agent with file and command access, and a browser. Runtime installation needs network access and the host's approval.
---

# Konpeki

Use one of two modes from the invocation or conversation:

- **init [composition.json]**: prepare the runtime and open a blank or existing
  file-backed editor. Stop when it is ready; do not generate artwork or claim to
  be listening for reviews.
- **generate [brief / materials]**: create or revise the visual, open its preview,
  inspect and repair it, then handle feedback in the same conversation. Prepare
  the runtime automatically; a separate init command is never required.

A creation brief without a mode, including “Use Konpeki to…”, means **generate**.
Bare “Konpeki” with no brief opens the editor as **init**. Follow-up feedback stays
with the current document; users need not repeat the skill or their materials.
Use existing chat, attachments, referenced files and canvas intent as inputs.
Ask only for missing information needed for faithful work, not a repeated brief.

Invocation belongs to the host: Codex CLI/IDE uses `$konpeki init` or
`$konpeki generate …`; a standalone Claude Code skill uses `/konpeki init` or
`/konpeki generate …`. Other clients may use skill selection or natural language;
plugin installations may namespace the skill. These are agent workflows, not
`konpeki init` / `konpeki generate` terminal commands.

## 0. Find the runtime once

From the user's chosen workspace, run the script bundled beside this skill:

```sh
node "<absolute-path-to-this-skill>/scripts/ensure-runtime.mjs"
```

It reuses a compatible workspace installation, the surrounding Konpeki checkout,
or a previously installed cache. If none exists, follow the host's permission
flow, then rerun with `--install`. This installs the pinned npm release in a
user cache, not in the user's project, and does not change their agent guidance.
If Node.js 24+ or npm is missing, report that prerequisite and follow the host's
toolchain setup rules; never claim the runtime is ready when setup failed.

The script returns JSON with `root` (runtime resources) and `cli` (the executable
path). In the instructions below, `<root>` and `<cli>` mean those returned absolute
paths. Quote paths in shell commands. They may be outside the skill directory;
do not assume a copied skill contains the runtime. Read resources from `<root>`
and keep authored documents in the user's workspace, outside the runtime/cache.

## init — open the editor without generating

Use the explicit document path, otherwise the document already active in this
conversation. With neither, use `slides/untitled/composition.json`. If several
documents are plausible, ask which to open instead of guessing.

Run the bundled helper with the resolved CLI and chosen destination:

```sh
node "<absolute-path-to-this-skill>/scripts/prepare-document.mjs" "<cli>" "<composition.json>"
```

It creates a validated blank page only when the file is missing. Existing files
are validated without rewriting them, and unreadable files are left untouched.
It returns `{ compositionPath, created }`; this means the document is prepared,
not that its browser is open. Do not replace a failed document with an example.

Follow **Open the file-backed preview** below. Verify the intended document loads,
then return its path and usable editor link. For a new document, verify an empty
page with editing controls. Stop here until the person asks to generate or revise.
Do not start an agent listener just because an editor is open.

## generate — interpret the brief

Read `<root>/AGENTS.md` and `<root>/AUTHORING.md`. Use the user's existing prompt as the
brief; do not ask them to repeat it in the canvas. Establish the source facts,
audience, takeaway and destination. Ask only when missing facts or conflicting
requirements prevent a faithful result.

Continue the document opened by init or the current conversation unless the
person requests a new one. Before changing an existing document, inspect
`node "<cli>" request "<composition.json>"`. Claim a `submitted` request with
`wait` and follow **Review handoff** below. A `working` request may belong to
another agent; coordinate ownership before resuming, rather than claiming it again.
With no active request, work from the brief and current composition normally.

Use `default` authoring mode unless requested otherwise. Explicit visual
preferences override taste defaults, not factual fidelity or readability. Use
the comparison workflow in `<root>/AUTHORING.md`
only when requested or accepted. A single page is a complete creation; choose
dimensions for its destination rather than assuming a slide deck.

### Author or revise the composition

Read `<root>/composition/README.md`. For a new visual,
create `slides/<name>/composition.json` unless the user supplies another path.
Use an unused destination; do not overwrite a different document at that path.
Save the creative brief in `PROMPT.md` and substantial facts, citations and asset
provenance in `SOURCE.md`. Separate assumptions from supplied facts. Preserve
creative requests accurately, but omit private coordination and environment or
agent metadata; label excerpts and redactions rather than calling them verbatim.

For revisions, reread the current file first. Preserve unrelated content,
component/vector IDs and human-edited geometry. Honor explicit chart or diagram
choices. Recompose for a new aspect ratio instead of stretching or cropping.

Prefer native text and semantic components. When standard drafts cannot express
the visual, use editable vectors inside their owning component. Reuse
`<root>/design/README.md` and reference examples as needed.
Trusted React may generate SVG for conversion, but imported JSX must not execute
in the canvas or become a second document source.

### Validate, render and repair

```sh
node "<cli>" validate "<composition.json>"
```

Follow **Open the file-backed preview** below, then inspect
every affected page and requested theme at presentation and smaller review sizes
after fonts load. Check factual fidelity, text bounds, contrast, reading order
and relationships. Repair consequential issues and inspect fresh renders.

Follow `<root>/docs/development.md` verification guidance for
code changes. Validation alone is not visual review. If a required check cannot
run, state the limitation; do not claim it passed. Honor requested checkpoints;
otherwise continue to finished output.

### Deliver and continue revisions

Return the composition path, usable preview, reviewed images or requested
exports, source attribution and verification limitations. Verify exports
separately; browser images do not prove editable PDF/PPTX or font fidelity.
Include any generator source while keeping composition JSON authoritative.

Accept follow-up chat feedback without requiring another generate invocation.
Reread the current composition each time, preserve human edits, and repeat the
render/repair checks. For canvas feedback, the person submits notes with **Build
it**. A submitted request can be handled by invoking generate again or by an
agent already waiting for it. Do not treat unsent notes as a submitted request.

## Open the file-backed preview

Reuse a known live preview for the same absolute document path; verify it still
loads that document. Otherwise start:

```sh
node "<cli>" preview "<composition.json>"
```

Keep the process alive using the host's supported service mechanism. Open the
exact printed session URL in the host's in-app browser when available, otherwise
the person's regular browser. For a remote workspace, use its authenticated
preview or port forwarding and preserve the session query; a remote loopback URL
is not a usable handoff. Session URLs grant editing access: do not publish them.
Verify the intended document actually loads before calling setup complete. If
browser access is unavailable, return the usable link and state it was not checked.
Do not substitute the standalone playground: it cannot save to the agent's file
or submit canvas review requests.

## Review handoff

When explicitly waiting for ongoing canvas reviews, run
`node "<cli>" wait "<composition.json>"` alongside the preview using the host's
supported long-running tool. Report whether a listener is actually running.
**Build it** cannot wake an idle agent. Without a listener, use its **Copy prompt**
handoff or ask the person to resume generate in agent chat; do not claim a permanent
connection. On receiving a request,
reread the named file and compare its revision with the request. If it changed,
reconcile against the latest document instead of applying a stale rewrite.
Apply every attached note to its named page, component or vector-element ID;
without notes, respect the selected scope. Preserve unrelated edits and stable
IDs. A request is already marked working when `wait` returns; it is not deleted.
Validate, render, inspect and repair the result, then run
`node "<cli>" finish "<composition.json>" <request-id> --message "Updated and checked"`.
File changes alone do not resolve notes. If blocked, finish with
`--status needs-clarification --message "..."` or `--status failed --message "..."`;
unresolved notes remain for retry. Never mark a partially handled batch done.
Use `node "<cli>" request "<composition.json>"` to recover an interrupted request and
verify it is still active before further writes. Cancellation does not stop your
process: stop work if the request is no longer active. Do not edit the feedback
sidecar directly. Return to `wait` only when the person requested a continuing loop.

See `<root>/docs/workflow.md` for the full handoff contract.
Never bypass revision checks or mutate hidden browser storage to replace the
document. Do not publish without permission.
