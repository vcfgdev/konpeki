---
name: authoring-visuals
description: Creates and revises editable Konpeki visuals from source material. Use for social graphics, article headers, visual explanations and presentations, including revisions to an existing composition.
---

# Authoring visuals with Konpeki

Deliver an editable composition and visually reviewed output. This skill needs
the surrounding Konpeki runtime and resources; if they are unavailable, follow
[SETUP.md](../../../SETUP.md) first. Paths here are relative to this file;
run commands below from the user's workspace with Konpeki installed locally.
For repository development, substitute `pnpm konpeki` for
`npm exec --no -- konpeki`. Keep authored documents outside `node_modules`.

## 1. Interpret the brief

Read [project rules](../../../AGENTS.md) and
[authoring policy](../../../AUTHORING.md). Use the user's existing prompt as the
brief; do not ask them to repeat it in the canvas. Establish the source facts,
audience, takeaway and destination. Ask only when missing facts or conflicting
requirements prevent a faithful result.

Use `default` authoring mode unless requested otherwise. Explicit visual
preferences override taste defaults, not factual fidelity or readability. Use
the policy's [comparison workflow](../../../AUTHORING.md#explore-an-uncertain-direction)
only when requested or accepted. A single page is a complete creation; choose
dimensions for its destination rather than assuming a slide deck.

## 2. Author or revise the composition

Read the [composition contract](../../../composition/README.md). For a new visual,
create `slides/<name>/composition.json` unless the user supplies another path.
Save the creative brief in `PROMPT.md` and substantial facts, citations and asset
provenance in `SOURCE.md`. Separate assumptions from supplied facts. Preserve
creative requests accurately, but omit private coordination and environment or
agent metadata; label excerpts and redactions rather than calling them verbatim.

For revisions, reread the current file first. Preserve unrelated content,
component/vector IDs and human-edited geometry. Honor explicit chart or diagram
choices. Recompose for a new aspect ratio instead of stretching or cropping.

Prefer native text and semantic components. When standard drafts cannot express
the visual, use editable vectors inside their owning component. Reuse
[design resources](../../../design/README.md) and reference examples as needed.
Trusted React may generate SVG for conversion, but imported JSX must not execute
in the canvas or become a second document source.

## 3. Validate, render and repair

```sh
npm exec --no -- konpeki validate slides/<name>/composition.json
npm exec --no -- konpeki preview slides/<name>/composition.json
```

Reuse an active file-backed preview for the same document when available. Open
the exact session URL, or its host-approved remote preview equivalent. Inspect
every affected page and requested theme at presentation and smaller review sizes
after fonts load. Check factual fidelity, text bounds, contrast, reading order
and relationships. Repair consequential issues and inspect fresh renders.

Follow [verification guidance](../../../docs/development.md#verification) for
code changes. Validation alone is not visual review. If a required check cannot
run, state the limitation; do not claim it passed. Honor requested checkpoints;
otherwise continue to finished output.

## 4. Deliver and continue revisions

Return the composition path, usable preview, reviewed images or requested
exports, source attribution and verification limitations. Verify exports
separately; browser images do not prove editable PDF/PPTX or font fidelity.
Include any generator source while keeping composition JSON authoritative.

Keep revision requests in agent chat by default. When explicitly waiting for a
canvas request, run `npm exec --no -- konpeki wait <composition.json>` alongside the preview.
**Build it** submits a request; it does not launch an agent. On receiving it,
reread the named file and compare its revision with the request. If it changed,
reconcile against the latest document instead of applying a stale rewrite.
Apply every attached note to its named page, component or vector-element ID;
without notes, respect the selected scope. Preserve unrelated edits and stable
IDs. A request is already marked working when `wait` returns; it is not deleted.
Validate, render, inspect and repair the result, then run
`npm exec --no -- konpeki finish <composition.json> <request-id> --message "Updated and checked"`.
File changes alone do not resolve notes. If blocked, finish with
`--status needs-clarification --message "..."` or `--status failed --message "..."`;
unresolved notes remain for retry. Never mark a partially handled batch done.
Use `konpeki request <composition.json>` to recover an interrupted request and
verify it is still active before further writes. Cancellation does not stop your
process: stop work if the request is no longer active. Do not edit the feedback
sidecar directly. Return to `wait` only when the person requested a continuing loop.

See [canvas workflow](../../../docs/workflow.md) for the full handoff contract.
Never bypass revision checks or mutate hidden browser storage to replace the
document. Do not publish without permission.
