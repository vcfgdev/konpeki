Make a three-page presentation introducing Patchnote to engineers and product
managers at a small software team. Show how they can turn selected pull-request
descriptions into a release-note draft, review it and export it. Use an
illustrative interface to make the workflow concrete.

---

Patchnote is a fictional release-note drafting tool. A user pastes pull-request
titles and descriptions into a release workspace and selects the entries to
include. Patchnote groups them into Added, Changed and Fixed, then proposes a
plain-English draft. A person edits and approves the draft before exporting it
as Markdown.

The draft can contain mistakes. Patchnote does not verify changes, connect to a
repository or publish releases. We have no customer telemetry or measured time
savings.

For the illustrative release 0.8, use these inputs:
- PR #142: Add CSV export for filtered results.
- PR #147: Remember the selected date range between visits.
- PR #153: Fix duplicate notification emails when a job is retried.
- PR #155: Refactor internal test helpers.

The first three are selected for the release. PR #155 is left out.
