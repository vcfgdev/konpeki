// Initial authoring source. composition.json is the editable deck of record.
// Re-running this script replaces it; preserve canvas revisions before rebuilding.
import { writeFile } from "node:fs/promises";
import { createComponent } from "../../composition/document.ts";
import { validateComposition } from "../../composition/validate.ts";
import {
  compositionSchema, canvasSize, canvasPadding,
  type CompositionComponent, type CompositionDocument, type CompositionSlide,
  type VectorElement,
} from "../../composition/types.ts";

const ink = "theme:ink", blue = "theme:accent", muted = "theme:muted", line = "theme:divider";
function text(id: string, value: string, x: number, y: number, size = 34, fill = ink, weight = 400): VectorElement {
  return { id, kind: "text", text: value, attributes: { x, y, "font-family": size >= 56 ? "theme:heading-font" : "theme:body-font", "font-size": size, "font-weight": weight, fill } };
}
function rect(id: string, x: number, y: number, width: number, height: number, stroke = line, fill = "theme:background"): VectorElement {
  return { id, kind: "rect", attributes: { x, y, width, height, rx: 4, fill, stroke, "stroke-width": 2 } };
}
function path(id: string, d: string, stroke = blue, width = 3): VectorElement {
  return { id, kind: "path", attributes: { d, fill: "none", stroke, "stroke-width": width, "stroke-linecap": "round", "stroke-linejoin": "round" } };
}
function arrow(id: string, x: number, y: number, end: number) {
  return path(id, `M${x} ${y}H${end}M${end - 14} ${y - 12}L${end} ${y}L${end - 14} ${y + 12}`);
}
function component(id: string, kind: CompositionComponent["kind"], x: number, y: number, width: number, height: number, description: string, elements: VectorElement[]): CompositionComponent {
  const base = createComponent(kind, 1);
  return { ...base, id, slotIds: [`${id}-content`], preferredRect: { x, y, width, height }, intent: description,
    customVisual: { format: "vector", viewBox: { x: 0, y: 0, width, height }, fit: "contain", description, elements } };
}
function copy(id: string, x: number, y: number, width: number, lines: string[], size = 36, color = ink, weight = 400) {
  const result = component(id, "text-block", x, y, width, Math.ceil(lines.length * size * 1.4 + 20), lines.join(" "),
    lines.map((value, index) => text(`${id}-line-${index + 1}`, value, 0, size + 8 + index * size * 1.4, size, color, weight)));
  if (result.kind === "text-block" && (id.endsWith("-title") || id === "brand")) result.appearance.role = "title";
  if (result.kind === "text-block") {
    delete result.customVisual;
    result.content = lines.join("\n");
    result.textStyle = { size, weight: weight as 400 | 500 | 600, lineHeight: 1.4,
      color: color === blue ? "accent" : color === muted ? "muted" : "ink", font: size >= 56 ? "heading" : "body" };
  }
  return result;
}
function slide(id: string, name: string, question: string, components: CompositionComponent[]): CompositionSlide {
  return { id, name, canvas: canvasSize, innerPadding: canvasPadding, pageNumber: { style: "01/02", color: "muted" },
    audience: "People and coding-agent users discovering Konpeki", question, intendedViewingSize: "presentation",
    components, contentSlots: components.map((c) => ({ id: c.slotIds[0], label: c.id, role: "body", required: true, instruction: c.intent! })),
    groups: [], readingOrder: components.map((c) => ({ kind: "component", id: c.id })), paintOrder: components.map((c) => c.id), relationships: [] };
}
function heading(id: string, title: string, subtitle: string) {
  return [copy(`${id}-title`, 112, 88, 1696, [title], 62, ink, 600), copy(`${id}-subtitle`, 112, 184, 1696, [subtitle], 32, muted)];
}

const slides: CompositionSlide[] = [];
slides.push(slide("introduction", "Meet Konpeki", "What is Konpeki?", [
  copy("brand", 112, 140, 820, ["Konpeki"], 112, blue, 600),
  copy("promise", 112, 328, 960, ["A shared slide canvas", "for people and coding agents."], 56, ink, 500),
  copy("summary", 112, 548, 870, ["Sketch the idea. Generate the detail.", "Keep revising the same document."], 36, muted),
  component("shared-canvas", "diagram", 1090, 185, 700, 590, "A single editable composition contains a headline, diagram and supporting text; people and agents revise it.", [
    rect("canvas-frame", 8, 25, 670, 395),
    text("canvas-title", "An idea, made clear", 45, 93, 36, ink, 500),
    path("headline-rule", "M45 120H640", line, 2),
    rect("source-node", 50, 183, 160, 90, blue), rect("result-node", 310, 183, 320, 90, blue),
    text("source-label", "Idea", 98, 239, 28), text("result-label", "Explanation", 382, 239, 28),
    arrow("connection", 228, 228, 292),
    path("body-lines", "M50 323H395M50 351H525", line, 8),
    text("document-label", "composition.json", 178, 484, 32, blue, 500),
    text("participants", "Human edits + agent revisions", 116, 548, 28, muted),
  ]),
  copy("intro-note", 112, 870, 1696, ["For technical explanations, product stories and decision decks."], 34),
]));

slides.push(slide("workflow", "A round-trip workflow", "How do a person and an agent work together?", [
  ...heading("workflow", "A handoff that comes back to the canvas", "The agent works on the document you can keep editing."),
  component("roundtrip", "diagram", 112, 342, 1696, 470, "Draft on the canvas, download composition JSON, ask a coding agent to revise it, then open the returned JSON and present. Further edits repeat this loop.", [
    ...[0, 1, 2, 3].flatMap((index) => {
      const x = index * 438;
      return [text(`number-${index}`, `0${index + 1}`, x, 48, 26, blue, 500),
        text(`step-${index}`, ["Draft", "Download", "Agent revises", "Open + present"][index], x, 122, 42, ink, 500),
        text(`detail-a-${index}`, ["Place components.", "Save the editable", "Return a completed", "Review the result."][index], x, 190, 29, muted),
        text(`detail-b-${index}`, ["Describe the intent.", "composition JSON.", "composition JSON.", "Make the next edit."][index], x, 234, 29, muted),
        ...(index < 3 ? [arrow(`handoff-${index}`, x + 338, 109, x + 398)] : [])];
    }),
    path("revision-loop", "M1510 285V365H115V285M103 299L115 285L127 299", blue),
    text("loop-label", "Revisions stay in the same editable format", 490, 431, 32, blue),
  ]),
  copy("workflow-note", 112, 870, 1696, ["Use your coding agent alongside Konpeki; bring its returned JSON back to the canvas."], 34, ink),
]));

slides.push(slide("components", "Five semantic components", "What can a slide contain?", [
  ...heading("components", "Five components. One composition.", "Each component keeps its meaning, outer geometry and editable interior."),
  component("text-specimen", "text-block", 112, 360, 296, 360, "Text block: headlines, body text, captions and footnotes.", [
    text("label", "Text block", 0, 40, 38, ink, 500), text("sample", "Aa", 0, 166, 96, blue),
    text("detail-1", "Headlines, body", 0, 277, 28, muted), text("detail-2", "and captions", 0, 317, 28, muted),
  ]),
  component("diagram-specimen", "diagram", 462, 360, 296, 360, "Diagram: entities and their relationships.", [
    text("label", "Diagram", 0, 40, 38, ink, 500), rect("node-1", 4, 112, 94, 78, blue), rect("node-2", 195, 112, 94, 78, blue), arrow("edge", 112, 151, 181),
    text("detail-1", "Entities and", 0, 277, 28, muted), text("detail-2", "relationships", 0, 317, 28, muted),
  ]),
  component("chart-specimen", "chart", 812, 360, 296, 400, "Chart specimen with illustrative values A 2 and B 3; not product measurements.", [
    text("label", "Chart", 0, 40, 38, ink, 500), path("axis", "M5 84V209H285", line, 2),
    rect("bar-a", 54, 129, 66, 80, blue, blue), rect("bar-b", 188, 89, 66, 120, blue, blue),
    text("value-a", "2", 77, 117, 24), text("value-b", "3", 209, 77, 24), text("axis-a", "A", 77, 240, 22, muted), text("axis-b", "B", 209, 240, 22, muted),
    text("detail-1", "Quantitative", 0, 297, 28, muted), text("detail-2", "comparisons", 0, 337, 28, muted), text("caveat", "Illustrative values", 0, 388, 26, ink),
  ]),
  component("image-specimen", "image", 1162, 360, 296, 360, "Image: a visual asset or illustration, represented here by original vector artwork.", [
    text("label", "Image", 0, 40, 38, ink, 500), rect("frame", 4, 91, 278, 135),
    { id: "sun", kind: "circle", attributes: { cx: 227, cy: 126, r: 17, fill: blue } },
    path("landscape", "M24 205L88 135L151 194L193 159L264 205", blue, 4),
    text("detail-1", "Visual assets", 0, 277, 28, muted), text("detail-2", "and illustrations", 0, 317, 28, muted),
  ]),
  component("table-specimen", "table", 1512, 360, 296, 360, "Table: structured comparisons with clear row and column associations.", [
    text("label", "Table", 0, 40, 38, ink, 500),
    text("col-a", "Stage", 0, 120, 26, ink, 500), text("col-b", "Owner", 157, 120, 26, ink, 500),
    path("rules", "M0 136H285M0 190H285M0 244H285", line, 2),
    text("row-a", "Draft", 0, 174, 25), text("row-a-owner", "Human", 157, 174, 25), text("row-b", "Revise", 0, 228, 25), text("row-b-owner", "Agent", 157, 228, 25),
    text("detail", "Structured detail", 0, 317, 28, muted),
  ]),
  copy("component-note", 112, 876, 1696, ["Draft previews express intent. Agents return completed artwork as editable vectors."], 34, ink),
]));

slides.push(slide("editing", "Keep the detail editable", "What remains editable after an agent finishes?", [
  ...heading("editing", "The detail stays editable", "Revise a label, a path or a group without replacing the whole slide."),
  component("editable-diagram", "diagram", 112, 340, 980, 475, "Explanatory illustration: a selected Review node inside its owning Diagram component. The shape keeps stable ID review-node.", [
    rect("owner", 5, 5, 965, 390), text("owner-label", "Diagram · review-flow", 35, 53, 27, muted),
    rect("draft", 55, 158, 220, 120), rect("review-node", 385, 158, 220, 120, blue), rect("present", 715, 158, 220, 120),
    text("draft-label", "Draft", 113, 232, 38), text("review-label", "Review", 433, 232, 38, blue, 500), text("present-label", "Present", 753, 232, 38),
    arrow("draft-review", 293, 218, 367), arrow("review-present", 623, 218, 697),
    ...[[380,153],[600,153],[380,273],[600,273]].map(([x,y], i) => rect(`handle-${i}`,x,y,10,10,blue)),
    text("stable-id", "Selected element: review-node", 36, 450, 32, blue),
  ]),
  copy("editing-actions-title", 1210, 343, 580, ["Change the part that matters"], 35, ink, 500),
  copy("editing-actions", 1210, 440, 580, ["Edit text and attributes.", "Reorder sibling elements.", "Delete a shape or a group.", "Undo and redo your changes."], 31, muted),
  copy("editing-note", 112, 885, 1696, ["Composition JSON owns the structure. Imported JSX never executes in the canvas."], 34, ink),
]));

slides.push(slide("today", "What works today", "What should a first-time user expect?", [
  ...heading("today", "An editable workflow, with clear boundaries", "Use the canvas for drafting, revision and presentation today."),
  copy("available-heading", 112, 350, 790, ["Available now"], 42, blue, 500),
  copy("available-1", 112, 451, 790, ["Arrange slides and semantic components.", "Open and download composition JSON."], 33),
  copy("available-2", 112, 605, 790, ["Revise vector text, shapes and paths.", "Present with the same canvas renderer."], 33),
  copy("available-3", 112, 790, 790, ["Browser-local drafts.", "No Konpeki account or backend required."], 32, ink),
  copy("limits-heading", 1020, 350, 788, ["Know the boundaries"], 42, ink, 500),
  copy("limits-1", 1020, 451, 788, ["Standard previews are placeholders.", "They do not load data or image files."], 33),
  copy("limits-2", 1020, 605, 788, ["Your coding agent supplies the output.", "Review its facts, layout and caveats."], 33),
  copy("limits-3", 1020, 790, 788, ["Desktop-first editing; storage is local.", "No PDF/PPTX fidelity claim."], 32, ink),
]));

slides.push(slide("start", "Try a real brief", "How do I start?", [
  ...heading("start", "Bring a brief. Build an editable deck.", "Start with one real explanation you need to give."),
  copy("setup-heading", 112, 350, 710, ["Open the project"], 40, ink, 500),
  copy("repository", 112, 435, 850, ["github.com/vcfgdev/konpeki"], 38, blue, 500),
  copy("commands", 112, 543, 840, ["pnpm install --frozen-lockfile", "pnpm dev"], 34),
  copy("requirements", 112, 696, 780, ["Node.js 24+ · pnpm", "A coding agent · a browser"], 34, ink),
  copy("brief-heading", 1020, 350, 788, ["Give your agent a concrete brief"], 40, ink, 500),
  copy("brief", 1020, 450, 788, ["“Explain this system to a new engineer.", "Show the request flow and failure path.", "Preserve the source facts and caveats.", "Return an editable composition JSON.”"], 31),
  copy("next-step", 1020, 708, 788, ["Open the result. Make one revision.", "Then present it."], 34, blue, 500),
  copy("closing", 112, 906, 1696, ["This presentation is itself an editable Konpeki composition."], 30, muted),
]));

const document: CompositionDocument = { schema: compositionSchema, title: "Introducing Konpeki", authoringMode: "default", theme: { id: "plex", mode: "paper" }, slides };
const result = validateComposition(document);
if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
await writeFile(new URL("./composition.json", import.meta.url), JSON.stringify(result.document, null, 2) + "\n");
console.log(`Authored ${slides.length} editable slides.`);
