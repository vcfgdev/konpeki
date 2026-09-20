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

The CLI interface is `konpeki <command>`. Until the package is published, use
the repository shim `pnpm konpeki <command>`:

```sh
pnpm konpeki validate slides/my-visual/composition.json
pnpm konpeki preview slides/my-visual/composition.json
```

`preview` prints a capability-bearing local URL. Open that exact URL. Valid
browser edits are saved atomically to the composition file; a revision hash
prevents overwriting concurrent external changes. When an agent updates the same
file, the canvas loads the valid revision and keeps the previous document in Undo.

An agent waiting for a person's revision request runs:

```sh
pnpm konpeki wait slides/my-visual/composition.json
```

In the file-backed canvas, **Build it** saves the composition and submits the
exact revision, active page and optional selected component. `wait` prints that
machine-readable request and exits. It does not launch or wake an agent itself.
The listening agent must reread the named composition, preserve unrelated human
edits, validate, render and inspect its revision before returning. Browser-local
drafts and hosted examples do not expose **Build it** because no local agent owns
their files.

Browser screenshots do not establish PDF/PPTX editability, font embedding or
cross-application fidelity. Inspect every requested export separately.
