# Canvas workflow

Start with the [quickstart](../README.md#start-in-your-coding-agent) and give your
coding agent a brief in its prompt field. Keep the skill with the project:
copying `SKILL.md` alone does not install Konpeki. Skill discovery varies by
agent; there is no universal `/konpeki` command.

## Documents and exports

New documents live in `slides/<name>/composition.json`, with `PROMPT.md`, source
notes and reviewed images alongside. Keep the editable composition under version
control. The canvas is the source of truth for editing and presentation; download
its JSON for handoff and drag returned JSON onto the canvas to continue.

One page is a complete creation. Presets cover Presentation (1920×1080), Square
post (1080×1080), Portrait post (1080×1350), Link preview / OG (1200×630), and
Article header (1600×600). The document contract supports 256–4096 pixels per side.
Pages in one document may use different sizes. Changing size never stretches
content and is refused when existing components would fall outside the page.
Recompose for a new aspect ratio instead of stretching or cropping.

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
