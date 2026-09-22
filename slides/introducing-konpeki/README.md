# Introducing Konpeki

A six-page English introduction for first-time users. Defaults to Precision on paper
with theme-linked colors and fonts; deck appearance can switch palettes and
Paper/Night without repainting vector elements. Uses the default authoring mode.

1. **Meet Konpeki** — create editable visuals with your coding agent.
2. **Create and revise together** — brief, generate, edit and revise the same file.
3. **Five semantic components** — Text block, Diagram, Chart, Image and Table.
4. **Keep the detail editable** — direct editing and targeted agent revision notes.
5. **Browser or agent editor** — local playground versus file-backed editing.
6. **Try a real brief** — install the skill and give a one-sentence creation request.

## Open and revise

For repository development, run `mise exec -- pnpm dev` from the root and open
`?example=introducing-konpeki` in the application. A static build serves the same
example after `mise exec -- pnpm build`. Select **Present** for viewing.

Edits autosave to this example's separate browser-local working copy when storage
is available. **Browser → Download JSON** keeps a portable copy; **Import JSON**
and **Start blank** replace only this working copy. **Reset example** restores
the bundled version. Download existing work before resetting, including when
loading an updated example. Browser storage is not a backup and does not sync
with an agent's file. The playground has no connected agent, Notes or Build it.

For agent-backed editing, follow [SETUP.md](../../SETUP.md) to install the complete
skill, then ask your agent to open a downloaded or copied composition file.
Browser and agent revisions use that same file in its preview. Continue feedback
in agent chat, or use Notes / Build it and Copy prompt as described in the
[canvas workflow](../../docs/workflow.md). A creation brief selects generate;
init is optional, not a required first step.

[composition.json](composition.json) is the authoritative editable deck. Each
page contains semantic components. Ordinary text uses native content and typography
fields; diagrams and custom specimens keep editable vector elements. Double-click
ordinary text to edit it directly; Content intent remains separate agent guidance.
This is not a second React deck runtime or a collection of page images.

[author.ts](author.ts) records the reviewed drawing instructions. Running
`mise exec -- node slides/introducing-konpeki/author.ts` validates and regenerates the JSON;
it **replaces manual canvas revisions**, so do not rerun it over revised work.
See [the public brief excerpt](PROMPT.md) and [source facts / provenance](SOURCE.md).

## Review

- `mise exec -- pnpm check`, `mise exec -- pnpm test` (106 tests),
  `mise exec -- pnpm build`, composition validation and `git diff --check`: passed.
  The build retains its existing large-chunk advisory.
- Inspected all six canvas pages in Precision Paper, Precision Night and Editorial
  Paper at 1920×1080 and 1024×768, DPR2 (36 states). No clipped text or overlapping
  labels. Revised the file/playground wording and kept the revision arrow returning
  from Revise to Edit, not to a new brief.
- `review.mjs` checked text bounds after font loading and each authored vector
  viewport against its component rectangle within 0.5 screen pixels at both sizes.
  With a dev or preview server and `agent-browser` available, run:

  ```sh
  mise exec -- node slides/introducing-konpeki/review.mjs http://localhost:4318 /tmp/konpeki-intro Precision paper
  ```

  Repeat with `Precision night` and `Editorial paper`; inspect captures after
  the assertions pass. The script defaults to Plex if no palette is supplied and
  explicitly selects its legacy font pairing. An optional final typography ID
  tests independent combinations, such as `Green paper plex-serif` or
  `Plex night noto-sans`; both passed all six pages at both sizes after separation.
- Precision Paper's accessibility tree exposes page copy, visual descriptions
  and the chart's illustrative values. Home / ArrowRight navigation reached all
  six pages; Noto Sans weights 400, 500 and 600 loaded. Text on the white canvas
  measures 15.59:1 (ink), 6.91:1 (muted) and 9.54:1 (accent).
- Final reviewed presentation captures: [screenshots](screenshots/).
- Chart values are illustrative; diagrams are explanatory artwork, not screenshots.
- Native agent-client installation, PDF/PPTX, mobile, reduced motion, focus styling
  and cross-application fidelity were not verified by this content review.

![Title slide](screenshots/page-1.png)
