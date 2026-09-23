# Source facts and provenance

Product claims come from repository documentation, not a customer case study.

| Claim | Repository evidence |
| --- | --- |
| Covers, social graphics, charts, diagrams and presentations share one canvas | [Product](../../README.md); [authoring](../../AUTHORING.md) |
| Skill-led creation; init optional; Node.js 24+, npm, file/command access and a browser required | [User setup](../../SETUP.md) |
| Browser and agent edit the same JSON; file sessions support notes, Build it and Copy prompt | [File-backed workflow](../../docs/workflow.md#file-backed-editing-with-an-agent) |
| Text block, Diagram, Chart, Image and Table; editable vectors with stable IDs | [Contract](../../composition/README.md); [types](../../composition/types.ts) |
| Direct text, shape and layout editing with undo/redo | [Operations](../../composition/document.ts) |
| Diagram, Chart and Table defaults are structural drafts; finished artwork needs source data | [Exports](../../docs/workflow.md#documents-and-exports); [fidelity rules](../../AUTHORING.md#requirements) |
| Playground: independent local copies, JSON import/download, blank/reset, PNG and Present; no agent sync, connected AI or cloud storage | [Hosting](../../docs/development.md#development-server-and-demo-hosting); [storage](../../src/lib/storage.ts); [controls](../../src/components/WorkspaceChrome.tsx) |

Drawings are original explanatory artwork, not screenshots. Chart values and
the announcement brief are illustrative, not product measurements or customer
results. No third-party images are used. Precision defaults to bundled Noto Sans;
text follows the selected font roles. See the [review scope](README.md#review)
for verification limits.
