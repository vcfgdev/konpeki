# Canvas workflow

Start with [Use with your agent](../README.md#use-with-your-agent) and give your
coding agent a brief in its prompt field. Install the complete skill directory;
its bootstrap script finds or installs the runtime separately. Skill discovery
varies by agent: Codex CLI/IDE uses `$konpeki`, while the standalone Claude Code
skill uses `/konpeki`. Other clients may use skill selection or natural language.
`init` opens a blank or existing file-backed editor without generating; `generate`
creates or revises a visual, opens its preview and inspects it, with setup implicit.
A creation brief without a mode selects generate. Follow-up reviews continue the
same document without repeating a command. These are skill modes, not terminal
subcommands. **Build it** is an optional revision handoff, not a required first-run
step; opening the editor does not start a review listener.

## Documents and exports

New browser documents use `konpeki-composition/v2`. Keep file-backed documents in
`slides/<name>/composition.json`, with `PROMPT.md`, source notes and reviewed
images alongside. Browser-local drafts stay in browser storage until exported.
Keep the editable composition under version control. The canvas is the source of
truth for editing and presentation; download
its JSON for handoff and drag returned JSON onto the canvas to continue.

One page is a complete creation. v2 presets are `presentation` (1920×1080),
`square` (1080×1080), `portrait` (1080×1350), `link` (1200×630), `article`
(1600×600), `explainer` (1200×1600) and `gallery` (1600×1000). Each fixes its
dimensions, margins, columns, gutters, baseline rows and seven-step type scale.
Components use one-based grid areas; padding and leading use baseline units.
Changing a preset never stretches or automatically recomposes content. Revise
areas and check fixed-height text at the destination size.

v1 documents remain valid and use their authored canvas, inner padding and pixel
rectangles. The currently published skill blank and pinned release runtime remain
on v1 compatibility until release; use a v2-capable repository runtime for new v2
documents rather than assuming the published runtime supports them.

**Export PNG** saves the active page at its declared dimensions without editor
controls. JSON remains the editable source; PNG is an image. Fresh documents and
added pages are empty. **Present** uses the same renderer for any page sequence.

Standard Chart, Diagram and Table illustrations are structural drafts. Finished
artwork can remain owned by its semantic component as editable vector elements.
Retained React/SVG examples are drawing references, not another deck runtime.

## File-backed editing with an agent

The CLI interface is `konpeki <command>`. After local installation, use
`npm exec --no -- konpeki <command>` from your workspace. In a repository checkout,
use the development shim `pnpm konpeki <command>` instead:

```sh
npm exec --no -- konpeki validate slides/my-visual/composition.json
npm exec --no -- konpeki preview slides/my-visual/composition.json
```

`preview` prints a capability-bearing local URL. Open that exact URL. Valid
browser edits are saved atomically to the composition file; a revision hash
prevents overwriting concurrent external changes. When an agent updates the same
file, the canvas loads the valid revision and keeps the previous document in Undo.

An agent waiting for a person's revision request runs:

```sh
npm exec --no -- konpeki wait slides/my-visual/composition.json
```

In the file-backed canvas, select a component or an inner vector element and
write a **Revision note** in the left panel's **Notes** tab. With nothing selected, the note targets
the page. **Add note** saves feedback without starting a build; add notes to several
targets, then choose **Build it** to submit them together. Numbered canvas pins
return to their note and selection. Pins and notes never appear in presentations
or PNG exports. Direct text, geometry and attribute edits still save normally.

**Build it** saves the composition and submits its exact revision, selected page,
component and optional vector-element ID, plus all unresolved notes. Without notes,
it requests a build from the saved composition and selected scope as before.
`wait` atomically claims one submitted request, marks it working, prints the
machine-readable v2 request and exits. It does not launch or wake an agent.
Until claimed, the canvas asks you to contact your coding agent and offers
**Copy prompt** for the handoff. “Agent working” means claimed, not a live
agent heartbeat. Only one request per document can be active. Connection errors
keep an active request locked until completion or cancellation.

The agent must reread the named composition and preserve newer human edits.
Follow each note's target IDs, not just the active page; never silently retarget
a deleted element. After validating, rendering and inspecting all requested
changes, explicitly finish using the ID returned by `wait`:

```sh
npm exec --no -- konpeki finish slides/my-visual/composition.json <request-id> --message "Updated and checked"
```

Only this acknowledgement resolves the submitted notes and unlocks editing.
File changes alone do not complete the request; explicit no-op completion is
valid when the requested result is already present. If blocked, finish with
`--status needs-clarification --message "What needs clarification?"` or
`--status failed --message "What failed"`. Notes stay unresolved for a retry.
Do not mark a partly applied batch done. **Cancel request** unlocks the editor
and keeps notes, but cannot stop an agent process; stop that agent before retrying.

Feedback is stored next to the document as `composition.json.review.json`, separate
from artwork and exports. Retain that file with the composition when moving work.
Browser reloads and preview restarts preserve notes and request status. To inspect
or recover an already claimed request after an interruption, run:

```sh
npm exec --no -- konpeki request slides/my-visual/composition.json
```

Coordinate with the previous worker before resuming; `wait` does not claim an
already working request a second time. Do not edit the sidecar manually while a
preview or agent is updating it. Existing v1 temporary requests are not migrated;
finish them before upgrading, then resubmit if needed. Browser-local drafts and
hosted examples do not expose revision notes or **Build it** because no local
agent owns their files.

Browser screenshots do not establish PDF/PPTX editability, font embedding or
cross-application fidelity. Inspect every requested export separately.
