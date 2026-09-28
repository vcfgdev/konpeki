# Canvas workflow

Konpeki 0.4 uses `konpeki-composition/v2`. Composition JSON is the editable
source; one owned scene drives canvas display, checking, and every export.

## User workflow

1. Give your coding agent the brief, source material, and intended use.
2. Receive a finished, inspected visual with editable source and requested exports.
3. Optionally move, resize, delete, correct text, or leave page comments that combine
   communication intent with concrete revision requests.
4. Click **Copy prompt** in pending reviews, then paste into your agent conversation.
5. Keep the editable JSON and delivery exports you need. Copy pending comments
   before clearing browser storage; no review sidecar is required.

No outline approval, browser questionnaire, content/intent entry, diagram or chart
type selection, or browser session is required. The agent infers an appropriate
form from the brief and sources. Ordinary documents need no showcase prompt
records. Keep substantial sources and caveats with the document so later
revisions remain faithful.

## Agent loop

1. Write or revise the composition IR from the brief and sources.
2. Run `konpeki inspect composition.json`, read the resolved layout and fix errors.
3. Render each affected page as a 2x PNG and inspect it.
4. Repair and repeat, then deliver the JSON and requested outputs.

`inspect` prints a compact JSON summary with the file revision, page/component
IDs, resolved boxes, native text lines, artwork counts, aligned groups and all
diagnostics. Add `--details` for exact geometry, baselines, clips, font IDs and
individual vector elements. Use `--page N` to limit both layout and diagnostics.
Measurements are in page pixels, independent of export scale. Reread the document
before edits; the report describes one revision, not a replacement document.

`validate` performs structural validation. `check` prints JSON shaped as
`{ok, diagnostics}` and exits 1 for errors. Diagnostics include page IDs and,
where relevant, component and element IDs. `inspect` includes the same checks
and exit behavior, so a separate `check` run is unnecessary when inspecting all
pages. Preview is optional for agents; PNG inspection remains required.

```sh
npm exec --no -- konpeki inspect slides/example/composition.json
npm exec --no -- konpeki render slides/example/composition.json --page 1 --format png --scale 2 --output slides/example/page-1.png
```

`render` accepts `png`, `svg`, or `pdf`. Pages are one-based. Scale applies only
to PNG. The default output is the input basename plus the format extension, and
an existing output is never overwritten. PDF renders every page unless `--page`
is supplied, supports mixed page sizes, and contains selectable subset text.

## Optional preview

`konpeki preview composition.json` opens a file-backed human editor. Use the exact
session URL; it is a capability and must not be published. Browser saves are
revision checked, valid external edits update the canvas, and the prior state
remains undoable. In remote environments use authenticated forwarding.

All pages sit on one scrollable canvas, with arrows showing document order.
Wide screens use two columns in a snake pattern; narrow screens use one column.
Pinch the trackpad or hold Ctrl/⌘ while scrolling the mouse wheel to zoom around
the pointer, from 25% to 400%. Ordinary two-finger or wheel scrolling moves around
the canvas. Zoom affects only this view, not the composition or exports; the
comment button and composer keep their normal size.
There are no sidebars, bottom toolbar, or presentation mode. Start new feedback
with **Comment** in the bottom-right corner:

1. Click **Comment** to enter review mode and open pending reviews in one step.
   Select a page background or component to open its nearby composer, which
   follows scrolling and zooming.
2. Write feedback and click **Add comment**. The comment saves locally and returns
   you to pending reviews, with **Copy prompt** ready. Select another canvas target
   to keep commenting.
3. Click **Copy prompt**, then paste into your agent conversation. The blue
   comment button shows the pending count; click it again to return to editing.

The prompt includes the composition title, source filename when available, and
page/component/vector IDs. It preserves your wording and asks the agent to reread
the current source, preserve unrelated edits, and inspect the revised render.
Copying never changes comments or invokes an agent. If browser
clipboard access is unavailable, a selected text field lets you copy manually.
Copying stays available during file-save errors or revision conflicts, so local
feedback can still be recovered.

Closing a composer returns to pending reviews. Closing that list, clicking the
pill, or pressing Escape returns to editing without discarding unsent drafts
during this session. Saved comments
leave small numbered markers on their pages or components, including outside
review mode. Click a marker to read that target's pending comments above the reply
field; close the composer for the full list. **Remove** discards a comment and its marker;
there is no separate Resolve action. Moving a component moves its markers with
it. Comments do not change the composition.

Outside comment mode, click a component to select it. Drag or use arrow keys to
move it, drag its corner handles to resize, or press Delete/Backspace to remove
it. Double-click native text (or press Enter on its selected component) to edit;
blur commits and Escape cancels. Ctrl/⌘ Z undoes and Ctrl/⌘ Shift Z redoes.
Text corrections preserve newer geometry and styling from external edits. If
the text itself changed or its component was removed, the draft stays open with
a warning; copy it before pressing Escape to load the current source.
Design changes and custom-artwork text revisions can be requested in comments.

In the standalone playground, drop a JSON file or press Ctrl/⌘ O to open one.
Ctrl/⌘ S downloads the composition. Share the latest JSON with your agent if it
does not already have it.
Use the CLI for PNG/SVG/PDF delivery exports. The board uses
the same owned scene as those exports; order arrows are review chrome only.

All comments stay browser-local, separate from the composition and exports.
They survive reloads at the same origin (scheme, host and port). File-session
storage is keyed by the source path, not its contents or temporary session token;
restarting preview at the same address retains comments. A different address,
browser, cleared storage, or moved file does not carry them over. This is not
cloud backup or cross-tab collaboration.

Older `<composition>.review.json` feedback is imported when no local comment
record exists. Existing local state wins, so resolved/removed comments do not
reappear on reload. Legacy sidecars remain untouched; Konpeki no longer writes
them. Existing component and vector targets remain readable and navigable.
An unreadable legacy sidecar cannot block composition saves or existing local
comments. If the first import fails, a warning blocks comment persistence until
the sidecar is repaired and the preview reloaded; the original bytes remain intact.

When applying a pasted prompt, reread the current composition and use the target
IDs rather than guessing from an old screenshot. If a target
no longer exists or feedback conflicts with a newer edit, report that instead
of silently applying stale instructions. Review the changed pages and tell the
user which feedback was addressed and what remains unresolved. People remove
comments in the preview themselves; there is no agent adapter, waiting
process, automatic invocation, or automatic resolution.

## Delivery

Return the editable composition and requested exports, with a preview when useful.
Inspect all pages with `inspect` and visually review affected renders and requested
exports before delivery. State remaining warnings and limitations; successful
machine checks alone do not prove factual correctness or visual quality.
Recipients can view PNG/SVG/PDF without the authoring runtime, or import the JSON
into the browser playground to continue editing. A file-session preview URL is
not a permanent published artifact. Publishing or deployment needs permission.

## Pages and review

Presets are `presentation`, `square`, `portrait`, `link`, `article`, `a4`, `explainer`,
and `gallery`. Each owns fixed dimensions, margins, columns, gutters, baseline
rows, and type steps. Recompose when changing presets; do not stretch content.

Bundled fonts cover Latin, accents, and symbols. Missing glyphs are reported as
errors. Contrast checks measure all solid glyph pixels at 2x, so their result has
a finite-resolution caveat. Scaled-chart diagnostics mean pixel-unit details
need review; they do not prove chart captions. Inspect every affected PNG and
every requested export separately.
