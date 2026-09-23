# Gallery sources

These are curated copies of reviewed composition JSON and PNG exports, unchanged
from their authoring projects. All scenarios and data are fictional. The JSONs
contain editable text and vector artwork, not embedded screenshots; import them
directly without running a generator. Authoring projects and generators remain
separate. [Adaptation briefs](PROMPT.md) record the creative direction.

## Architecture

Harbor Market's storefront sends commands to an order service. The order ledger
commits the order and outbox together; the relay emits `OrderPlaced` events.
Fulfillment consumes those events but cannot mutate the ledger. The boundary
denotes product ownership, not infrastructure. This is not a customer system,
real deployment or availability claim.

The explicit `architecture` Diagram owns editable open-headed connectors,
shapes and vector labels. Headline, context and caveat are native text blocks.
No external graphic assets were used; Konpeki supplies IBM Plex Sans.

## Sankey

The fictional cohort conserves 1,000 users at every stage:

| From | To | Users |
| --- | --- | ---: |
| Trial | Activated | 700 |
| Trial | Not activated | 300 |
| Activated | Paid | 400 |
| Activated | Free | 300 |
| Not activated | Left | 300 |

Paid is 40% of the initial cohort, not 40% of activated users. Ribbon and node
thicknesses use 0.4 chart pixels per user. The explicit Sankey Chart records six
nodes and five labeled edges; filled vector paths connect the exact stacked
intervals. No exits are hidden. No external imagery; Konpeki supplies IBM Plex Sans.

Architecture and Sankey were originally authored against
[this Konpeki revision](https://github.com/vcfgdev/konpeki/commit/4c7d5b91a2d5710eed1e35f70048fbe257c45f1d)
using the then-named `konpeki-composition/v18` contract. Only the identifier was
migrated to `konpeki-composition/v1`; content and geometry were preserved and
browser-reviewed at [this revision](https://github.com/vcfgdev/konpeki/commit/53a86b6d083ab346bb0b0c797b9052d839bda81f).
The reviewed screenshots were retained.

## Release

Adapted from the [Clearpath brief](../og-images/PROMPT.md). Clearpath is a
fictional local release-checklist tool for small software teams. Version 0.4
previews release notes for human review and exports Markdown; it does not publish
releases. No logo, URL, adoption or performance evidence was supplied. “Review
the release before you publish” addresses the person's workflow, not a publishing
capability of the tool. The three document drawings are symbolic, not application
screenshots. Konpeki supplies Hanken Grotesk.

## Explainer

Adapted from the [Folio brief](../teaching/PROMPT.md). Fictional document 42 starts
with title “Launch notes”, revision 7. Leena and Omar both read it. Leena saves
“Launch checklist” expecting 7: one atomic conditional update changes one row
and stores revision 8. Omar saves “Release notes” expecting 7: zero rows change,
the server returns HTTP 409 Conflict, and Leena's revision 8 stays untouched.

Every writer matches document ID and expected revision, writes the title and
increments the revision atomically. Revisions are never reused, including after
restoration; assume no deletion. Separate read/check and write operations are
unsafe. After conflict, fetch current state and show both titles; the person
chooses whether to keep, revise or replace. A new save uses the fetched revision
and can conflict again. Never silently retry stale text with a newer revision.

This prevents silent lost updates, not merging, multi-document atomicity or
request deduplication. A lost success response can make a successful save look
like a later conflict. The page summarizes the original four-page lesson.
Konpeki supplies IBM Plex Sans.

## Rendering scope

The PNGs are reviewed Chromium captures. They do not establish PDF/PPTX export,
cross-browser or cross-application fidelity. These examples are authored and
reviewed results, not evidence of automatic first-attempt layout quality.
