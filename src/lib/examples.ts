import { validateComposition } from "../../composition/validate.ts";
import { parseEditableSvg } from "../../composition/vector.ts";
import { initialDraft, type Draft } from "./model.ts";
import migratedReactPage from "./examples/react-page-migration.json" with { type: "json" };
import introducingKonpeki from "../../slides/introducing-konpeki/composition.json" with { type: "json" };

const customVisualSource = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 530"><rect width="1080" height="530" rx="28" fill="#F5F7F8"/><text x="54" y="66" font-family="Arial,sans-serif" font-size="24" font-weight="700" fill="#13242C">A shared canvas keeps intent and output together</text><line x1="253" y1="272" x2="407" y2="272" stroke="#007BBB" stroke-width="8"/><path d="M397 258L425 272 397 286Z" fill="#007BBB"/><line x1="672" y1="272" x2="826" y2="272" stroke="#007BBB" stroke-width="8"/><path d="M816 258L844 272 816 286Z" fill="#007BBB"/><g font-family="Arial,sans-serif" text-anchor="middle"><rect x="54" y="152" width="200" height="240" rx="24" fill="#FFFFFF" stroke="#CAD4D8" stroke-width="3"/><circle cx="154" cy="224" r="35" fill="#D9EDF5"/><path d="M135 224h38M154 205v38" stroke="#007BBB" stroke-width="6"/><text x="154" y="302" font-size="25" font-weight="700" fill="#13242C">Draft</text><text x="154" y="338" font-size="18" fill="#52666F">Human places intent</text><rect x="425" y="152" width="248" height="240" rx="24" fill="#007BBB"/><path d="M492 220h112v82H492z" fill="none" stroke="#FFFFFF" stroke-width="6"/><path d="M514 249h67M514 272h45" stroke="#FFFFFF" stroke-width="5"/><text x="549" y="334" font-size="25" font-weight="700" fill="#FFFFFF">Agent renders</text><text x="549" y="367" font-size="18" fill="#E4F2F7">SVG stays inside</text><rect x="844" y="152" width="182" height="240" rx="24" fill="#FFFFFF" stroke="#CAD4D8" stroke-width="3"/><path d="M900 217a45 45 0 1 1-4 62" fill="none" stroke="#007BBB" stroke-width="7"/><path d="M887 274l11 23 18-18" fill="#007BBB"/><text x="935" y="327" font-size="25" font-weight="700" fill="#13242C">Revise</text><text x="935" y="360" font-size="18" fill="#52666F">One document</text></g><text x="54" y="475" font-family="Arial,sans-serif" font-size="17" fill="#52666F">Outer geometry remains editable; vector elements own this interior.</text></svg>`;

export function exampleDraft(name: string | null): Draft | undefined {
  if (name === "introducing-konpeki") {
    const validation = validateComposition(introducingKonpeki);
    if (!validation.ok) throw new Error("Invalid Konpeki introduction deck");
    return validation.document;
  }
  if (name === "react-page-migration") {
    const validation = validateComposition(migratedReactPage);
    if (!validation.ok) throw new Error("Invalid migrated React page example");
    return validation.document;
  }
  if (name !== "custom-visual") return undefined;
  const draft = initialDraft();
  draft.title = "Custom visual round-trip";
  draft.slides[0].name = "Agent visual";
  draft.slides[0].components[0].intent = "Editable output, not a flattened render";
  const visual = draft.slides[0].components[1];
  visual.intent = "Draft to agent render to revision workflow.";
  const parsed = parseEditableSvg(customVisualSource);
  visual.customVisual = {
    format: "vector",
    elements: parsed.elements,
    viewBox: parsed.viewBox,
    description: "Draft to agent render to revision workflow",
    fit: "contain",
  };
  draft.slides[0].components[2].intent =
    "Slide structure stays semantic; vector elements remain individually editable.";
  draft.slides[0].components[3].intent =
    "Double-click the diagram, then select a line, shape, path, or text element to revise it.";
  const validation = validateComposition(draft);
  if (!validation.ok) throw new Error("Invalid bundled example composition");
  return validation.document;
}
