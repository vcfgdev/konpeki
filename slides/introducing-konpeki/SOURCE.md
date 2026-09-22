# Source facts and provenance

This is a factual introduction to Konpeki, not a fictional customer case study.

| Claim | Repository evidence |
| --- | --- |
| Covers, social graphics, charts, diagrams and presentations share an editable canvas | [Product introduction](../../README.md); [authoring guidance](../../AUTHORING.md) |
| Install the complete skill; a creation brief selects generate, with init optional | [Setup](../../SETUP.md); [canvas workflow](../../docs/workflow.md) |
| In a file-backed preview, valid browser and agent changes update the same composition JSON | [File-backed workflow](../../docs/workflow.md#file-backed-editing-with-an-agent) |
| Five top-level kinds: Text block, Diagram, Chart, Image, Table; stable editable vector IDs | [Composition contract](../../composition/README.md); [types](../../composition/types.ts) |
| Direct text, shape and layout editing with undo/redo | [Product capabilities](../../README.md); [composition operations](../../composition/document.ts) |
| Diagram, Chart and Table previews are structural drafts; real source data is needed for finished artwork | [Canvas workflow](../../docs/workflow.md#documents-and-exports); [factual-fidelity rules](../../AUTHORING.md#requirements) |
| Revision notes and Build it belong to file-backed sessions; Copy prompt resumes an idle agent | [Review handoff](../../docs/workflow.md#file-backed-editing-with-an-agent) |
| Playground examples save independent browser-local copies; import/download JSON, start blank, reset, PNG and Present are available | [Demo hosting](../../docs/development.md#development-server-and-demo-hosting); [storage implementation](../../src/lib/storage.ts); [browser controls](../../src/components/WorkspaceChrome.tsx) |
| Playground files do not sync with an agent session; there is no connected AI or cloud storage | [Demo hosting](../../docs/development.md#development-server-and-demo-hosting) |
| Agent workflow requires Node.js 24+, npm, file/command access and a browser; contributor pnpm setup is separate | [User setup](../../SETUP.md); [development setup](../../docs/development.md) |

The architecture drawings, vector selection example and component specimens are
original explanatory artwork for this deck, not product screenshots. The tiny
chart uses explicitly labeled illustrative values, not measured product data.
The product-announcement prompt is an example brief, not a customer result.
No third-party image assets or customer claims are used. The retained Precision
theme uses Noto Sans from the repository's Fontsource dependency; theme-linked
text follows the selected palette's font roles. No PDF/PPTX or cross-application
fidelity is claimed. This deck does not establish native agent-client installation
compatibility or an official hosted playground URL.
