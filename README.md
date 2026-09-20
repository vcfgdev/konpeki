# Konpeki

**An editable canvas for agent-made visuals. Create a single explanation or a whole presentation, then revise it together.**

Konpeki turns notes and source material into social graphics, article headers,
visual explanations and presentations. Give your coding agent a brief and a
destination; it should return finished output unless you request a checkpoint.

People and agents revise the same composition instead of converting it into
framework source. Konpeki supplies design guidance, typography, palettes,
semantic components and presentation mode. You do not need to choose a font,
color or layout before starting.

**Unsure about the look?** Both modes start with a white canvas, sans-serif
typography and one main accent. Dynamic mode permits stronger composition and
visual explanation without automatically changing the theme.

**Already have a direction?** Your preferences win. Use your brand, a dark theme,
serif headlines or a more expressive style. Accuracy and readability still apply.

Choose one [authoring mode](AUTHORING.md#authoring-mode):

- **`default`** (when omitted): the original rules, favoring typography and
  whitespace, restrained fills, open arrowheads and no decorative rails.
- **`dynamic`**: keeps the same theme defaults while allowing expressive
  typography, emphasis shapes, reinforcing arrows and framing.
  These are permissions, not a checklist of effects to add.

Both retain the same accuracy, readability, writing and verification requirements.
Explicit visual preferences override taste defaults in either mode. The mode is
an authoring instruction, not a runtime switch or guarantee of a different result.

Unsure which fits? Ask for **two candidates of one representative page**, one per
mode, with the same content and explicit constraints. Choose before applying it
to the deck. This comparison is optional, not a mandatory selection round.

The canvas is the source of truth for editing and presentation. Download its
composition JSON for handoff; drag returned JSON onto the canvas to continue.

Standard Chart, Diagram and Table illustrations are structural drafts. Finished
artwork can remain owned by its semantic component as editable vector elements.
Retained React/SVG examples are drawing references, not another deck runtime.

## Start in your coding agent

### Page sizes and export

One page is a complete creation. Presets cover Presentation (1920×1080), Square
post (1080×1080), Portrait post (1080×1350), Link preview / OG (1200×630), and
Article header (1600×600). The document contract supports 256–4096 pixels per side.

Pages in one document may use different sizes. Changing size never stretches
content and is refused when existing components would fall outside the page.
Recompose for a new aspect ratio instead of stretching or cropping.

**Export PNG** saves the active page at its declared pixel dimensions, without
editor controls. The composition remains the editable source; PNG is an image.
File-backed sessions save composition edits to disk. Fresh documents and added
pages are empty; **Present** remains available for any sequence.

### No-install example hosting

`pnpm build` produces a static site in `dist` for a root or subdirectory.
Use `?example=introducing-konpeki` or `?example=custom-visual` to open a bundled
editable example.

Example links do not autosave. Open the example composition in a file-backed
session to preserve edits. Hosting shares bundled examples, not private drafts, arbitrary
documents or an AI service. No deployment is automatic.

### Local authoring

Requires **Node.js 24+**, **pnpm**, a coding agent that can edit files and run
commands, and a browser for visual review.

```sh
git clone https://github.com/vcfgdev/konpeki.git
cd konpeki
pnpm install --frozen-lockfile
pnpm dev
```

### Shared local editing with an agent

The public interface is `konpeki <command>`. Until the package is published, use
the repository shim `pnpm konpeki <command>`.

Validate and preview an existing composition:

```sh
pnpm konpeki validate slides/my-visual/composition.json
pnpm konpeki preview slides/my-visual/composition.json
```

`preview` prints a capability-bearing local URL. Open that exact URL. Valid
browser edits are saved atomically to the composition file; a revision hash
prevents overwriting concurrent external changes. When an agent updates the same
file, the canvas loads the valid revision and keeps the previous document in Undo.

An agent that is waiting for a person's revision request runs:

```sh
pnpm konpeki wait slides/my-visual/composition.json
```

In the file-backed canvas, **Build it** saves the current composition and submits
the exact revision, active page and optional selected component. `wait` prints
that machine-readable request and exits. The agent must reread the named
composition, preserve unrelated human edits, validate, render and inspect its
revision before returning. Browser-local drafts and hosted examples do not expose
**Build it** because no local agent owns their files.

Open this directory in your coding agent. The project includes the
[`authoring-visuals` skill](.agents/skills/authoring-visuals/SKILL.md) for agents
that discover `.agents/skills/`. Select it through your agent's skill or slash
command picker, then supply your brief. Command names and discovery rules vary
by agent; Konpeki does not install a universal `/konpeki` command.

If your agent does not discover skills, ask it to read [AGENTS.md](AGENTS.md) and
[AUTHORING.md](AUTHORING.md). The same workflow works with an ordinary prompt:

```text
Use Konpeki to turn these notes into a three-slide explanation for engineers
who have not worked on this system. Make the request flow and failure handling
easy to follow. I don't have a theme preference. Preserve the facts and caveats.
Save the prompt with the source, then implement, render, inspect and fix the
slides. Return the updated composition JSON and reviewed images.

[Paste notes or provide source files here.]
```

Review the deck through its canvas and slide thumbnails; use **Present** for
chrome-free viewing from the same renderer. Ask for changes in plain language:
“Make the failure path clearer,” “Give the evidence more room,” or “Use our dark
brand palette.”
Add “Stop after the outline for approval” if you want a checkpoint first.

For a production preview, run `pnpm build` then `pnpm preview`. In a remote
environment, expose the server through your environment's authenticated preview
mechanism; an orb's local address is not a shareable URL.

## What you can make

| Use case | A useful brief |
| --- | --- |
| Introduce a product | “Explain the product through one concrete task; use the supplied screenshots and capabilities.” |
| Explain an architecture | “Show ownership, the request journey and what happens when a dependency fails.” |
| Present results | “Compare these measurements fairly; keep units, uncertainty and limitations visible.” |
| Make a decision | “Explain the alternatives, trade-offs and evidence needed to choose.” |
| Teach a concept | “Explain retries and idempotency with a worked sequence and its limits.” |
| Brief an article | “Give the takeaway, supporting evidence and the qualification readers must not miss.” |

Supply facts, datasets and approved assets. The kit does not invent evidence or
turn illustrative diagrams into claims about a real product.

## Examples you can inspect and adapt

Explore [18 fictional examples](slides/README.md), including product introductions,
architecture diagrams, research briefings and technical explanations. [Tide](slides/line-chart/PROMPT.md)
shows a line chart with missing data; [Birch](slides/bar-chart/PROMPT.md) compares
workflow medians with grouped bars. [Fieldnote](slides/vertical-bar-charts/PROMPT.md)
uses vertical and side-by-side bars; [Brook](slides/sankey/PROMPT.md) shows flows.

The [font and palette comparisons](slides/README.md#font-and-palette-comparisons)
apply controlled variants without changing the source decks.

These examples predate the composition contract. Their prompts, React/SVG source
and final PNGs remain useful references for authored vector interiors, but new
editable documents use composition JSON.

Keep **exact initial and follow-up prompts**, editable source and final screenshots
when adding showcase examples. Keep supplied facts and caveats in the prompt and deck.
Examples are the place to judge what Konpeki can do; there is no separate
benchmark suite or aesthetic score.

## A starter project with a skill

Konpeki is currently distributed as this repository, **not a published npm
library or a standalone slide generator**. The skill guides the agent; the
project supplies files it can edit and the runtime it can execute. Keep the
skill with the project—copying its `SKILL.md` alone does not install the kit.

New documents live in `slides/<name>/composition.json`, with `PROMPT.md`, source
notes and reviewed images alongside. Trusted React/SVG may generate component
artwork, but supported primitives should become editable composition vectors,
not a parallel document source.

Keep those files under version control. Konpeki needs no account or backend;
your coding agent's pricing and data handling still apply.

## Implementation reference

- `src/` contains the primary canvas application. Arrange components, present
  with the same renderer, save through a file-backed session, or drag in an agent's returned
  composition. The [versioned composition contract](composition/README.md)
  preserves content, relationships and visual intent across both participants.
- [AUTHORING.md](AUTHORING.md) owns design defaults, factual fidelity and review.
- [Design resources](design/README.md) contains palettes, themes and semantic
  patterns; these are choices, not mandatory layouts.
- `lib/text.tsx` supplies measured `Text` and `Paragraphs` with string or rich-text
  runs. Overset content is flagged, not automatically shrunk or hidden. Await
  `fontsReady` from `lib/typeface.ts` before measuring.
- `lib/slide.tsx` supplies specimen `Panel`, `Relationship` and 1920×1080 `Sheet`
  components. `Panel` shares one heading/body size; `Relationship` is a short
  directional glyph. These are trusted drawing references; convert their SVG
  output to composition vectors for the canvas.
- `lib/layouts.ts` supplies fixed-gutter regions, not a content-fitting solver.
- Retained React chart references use Nivo `Bar`, `Line` and `Sankey` with `chartDefaults(palette)`
  from `lib/charts.ts` spread before chart-specific props. Keep data, dimensions,
  scales and semantic colors in the deck. Use explicit label colors and
  `linkBlendMode="normal"` for Sankey.

### React/SVG drawing references

The retained `slides/*/index.tsx` files are presentation-runtime-independent
examples of how an agent can construct vector artwork. They are checked as source
but are not discovered as routes or executed by a second presentation runtime.
New decks use composition JSON; a trusted build may render React to SVG, then
convert supported elements into the owning component's editable vector payload.

To migrate the retained architecture reference into the shared canvas:

```sh
pnpm example:migrate-page slides/architecture/index.tsx all /tmp/architecture-composition.json
```

Drag the resulting JSON onto the canvas, edit its vector elements, and use **Present**.
Replace `all` with a zero-based page index for one page. This command executes
trusted local React source at build time; never use it on untrusted JSX. It
rejects unsupported SVG elements rather than silently flattening them. Review
converted typography and geometry in the browser; conversion is not a fidelity
guarantee. The bundled `?example=react-page-migration` preview uses the same
converted composition format. Example previews do not autosave; open the converted
composition in a file-backed session to save edits.

Browser screenshots do not establish PDF/PPTX editability, font embedding or
cross-application fidelity. Inspect every requested export separately.

## Verification

```sh
pnpm check
pnpm test
pnpm build
```

With the dev server running and `agent-browser` installed, run the focused
browser regression workflow:

```sh
node scripts/check-canvas.mjs http://localhost:4318 .amp/in/artifacts
node scripts/check-pages.mjs http://localhost:4318 .amp/in/artifacts/pages
```

It exercises all five component kinds, empty slides, JSON round trips, vector
editing/history and fitted line dragging. It captures editor and presentation
states at two sizes; inspect the images because assertions alone do not establish
visual correctness.

Documentation changes need link and instruction checks. Deck changes need
typecheck, build, relevant fixture checks and actual visual inspection. Shared
component, theme or dependency changes also need the full test suite and
representative affected decks. A build can report a large-framework-chunk advisory.

Render affected pages at presentation and review sizes after fonts load. Inspect
text, clipping, relationships, contrast and cross-page consistency. Repair issues
and inspect fresh captures.

Keep browser checks scoped to factual and layout contracts, not universal taste.
Visual review requires inspecting renders, not only passing tests. Record untested
outputs and limitations with the example.

## License

[Apache-2.0](LICENSE). Dependencies retain their own licenses. Fontsource packages
supply licensed font files; check their language subsets and license notices
when redistributing assets. External design references are credited where used;
they are not bundled products or runtime dependencies.
