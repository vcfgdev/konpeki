# Source facts and provenance

This is a factual introduction to Konpeki, not a fictional customer case study.

| Claim | Repository evidence |
| --- | --- |
| One canvas for human drafts, agent output, revision and presentation | ../../README.md; ../../AGENTS.md |
| Composition JSON is authoritative; imported JSX never executes | ../../composition/README.md; ../../AUTHORING.md |
| Five top-level kinds: Text block, Diagram, Chart, Image, Table | ../../composition/types.ts |
| Open / Download / Present workflow; browser-local storage | ../../README.md; ../../src/lib/storage.ts |
| Stable vector IDs, text/attribute edits, ordering, deletion and undo/redo | ../../README.md; ../../composition/vector.ts |
| Standard component illustrations are drafts, not data or image uploads | ../../README.md |
| Node 24+, pnpm; repository distribution, no Konpeki account/backend required | ../../README.md; ../../package.json |

The architecture drawings, vector selection example and component specimens are
original explanatory artwork for this deck, not product screenshots. The tiny
chart uses explicitly labeled illustrative values, not measured product data.
No third-party image assets or customer claims are used. IBM Plex Sans comes from
the repository's Fontsource dependency. No PDF/PPTX or cross-application fidelity
is claimed.
