// Authoring source. composition.json is the editable deck of record.
// Re-running this script replaces it; preserve canvas revisions before rebuilding.
import { writeFile } from "node:fs/promises";
import { canonicalJSON } from "../../composition/compile.ts";
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
  if (base.kind === "diagram" || base.kind === "chart") base.appearance.selection = "explicit";
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
  copy("promise", 112, 328, 960, ["Create clear visuals", "with your coding agent."], 56, ink, 500),
  copy("summary", 112, 548, 870, ["Bring a brief. Get an editable result.", "Keep revising the same document."], 36, muted),
  component("shared-canvas", "diagram", 1090, 185, 700, 590, "A single editable composition contains a headline, diagram and supporting text; people and agents revise it.", [
    rect("canvas-frame", 8, 25, 670, 395),
    text("canvas-title", "From brief to visual", 45, 93, 36, ink, 500),
    path("headline-rule", "M45 120H640", line, 2),
    rect("source-node", 50, 183, 160, 90, blue), rect("result-node", 310, 183, 320, 90, blue),
    text("source-label", "Brief", 98, 239, 28), text("result-label", "Editable visual", 374, 239, 28),
    arrow("connection", 228, 228, 292),
    path("body-lines", "M50 323H395M50 351H525", line, 8),
    text("document-label", "composition.json", 178, 484, 32, blue, 500),
    text("participants", "Human edits + agent revisions", 116, 548, 28, muted),
  ]),
  copy("intro-note", 112, 870, 1696, ["Covers, social graphics, charts, diagrams and presentations."], 34),
]));

slides.push(slide("workflow", "Create and revise together", "How do a person and an agent work together?", [
  ...heading("workflow", "Start with a brief. Keep editing the result.", "In the agent-opened editor, you and your agent edit the same file."),
  component("roundtrip", "diagram", 112, 342, 1696, 470, "Share a brief and materials. The agent creates a visual and opens its file-backed preview. Edit that canvas, then ask for revisions in the same conversation. The agent updates the same file; the loop returns to editing, not a new brief.", [
    ...[0, 1, 2, 3].flatMap((index) => {
      const x = index * 438;
      return [text(`number-${index}`, `0${index + 1}`, x, 48, 26, blue, 500),
        text(`step-${index}`, ["Brief", "Generate", "Edit", "Revise"][index], x, 122, 42, ink, 500),
        text(`detail-a-${index}`, ["Share your materials.", "Agent creates a visual.", "Edit the open canvas.", "Ask in the same chat."][index], x, 190, 29, muted),
        text(`detail-b-${index}`, ["Describe the result.", "Opens its file preview.", "Review the details.", "Agent updates that file."][index], x, 234, 29, muted),
        ...(index < 3 ? [arrow(`handoff-${index}`, x + 338, 109, x + 398)] : [])];
    }),
    path("revision-loop", "M1510 285V365H991V285M979 299L991 285L1003 299", blue),
    text("loop-label", "Both edit the same composition.json", 490, 431, 32, blue),
  ]),
  copy("workflow-note", 112, 870, 1696, ["Prefer to sketch first? Add a component, describe its intent, then choose Build it."], 34, ink),
]));

slides.push(slide("components", "Five semantic components", "What can a page contain?", [
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
    text("row-a", "Create", 0, 174, 25), text("row-a-owner", "Agent", 157, 174, 25), text("row-b", "Review", 0, 228, 25), text("row-b-owner", "You", 157, 228, 25),
    text("detail", "Structured detail", 0, 317, 28, muted),
  ]),
  copy("component-note", 112, 848, 1696, ["Diagram, Chart and Table previews are structural drafts.", "Give the agent real data and sources for finished artwork."], 32, ink),
]));

slides.push(slide("editing", "Keep the detail editable", "What remains editable after an agent finishes?", [
  ...heading("editing", "Keep editing—or ask your agent", "Change text, shapes and layout directly. Undo and redo stay available."),
  component("editable-diagram", "diagram", 112, 340, 980, 475, "Explanatory illustration: a selected Review node inside its owning Diagram component. The shape keeps stable ID review-node.", [
    rect("owner", 5, 5, 965, 390), text("owner-label", "Diagram · review-flow", 35, 53, 27, muted),
    rect("draft", 55, 158, 220, 120), rect("review-node", 385, 158, 220, 120, blue), rect("present", 715, 158, 220, 120),
    text("draft-label", "Draft", 113, 232, 38), text("review-label", "Review", 433, 232, 38, blue, 500), text("present-label", "Present", 753, 232, 38),
    arrow("draft-review", 293, 218, 367), arrow("review-present", 623, 218, 697),
    ...[[380,153],[600,153],[380,273],[600,273]].map(([x,y], i) => rect(`handle-${i}`,x,y,10,10,blue)),
    text("stable-id", "Selected element: review-node", 36, 450, 32, blue),
  ]),
  copy("editing-actions-title", 1210, 343, 580, ["Ask for a targeted revision"], 35, ink, 500),
  copy("editing-actions", 1210, 440, 580, ["Select a component or element.", "Add a Revision note in Notes.", "Choose Build it to submit.", "Agent revises the same file."], 31, muted),
  copy("editing-note", 112, 852, 1696, ["Notes and Build it are available in the agent-opened editor, not the browser playground.", "Build it cannot wake an idle agent. Use Copy prompt to resume it."], 32, ink),
]));

slides.push(slide("today", "Browser or agent editor", "What can I do here, and what needs a coding agent?", [
  ...heading("today", "Try the browser. Continue with your agent.", "The same editable format, with different saving and generation paths."),
  copy("available-heading", 112, 350, 790, ["Browser playground"], 42, blue, 500),
  copy("available-1", 112, 451, 790, ["Edit an example or start blank.", "Import editable composition JSON."], 33),
  copy("available-2", 112, 605, 790, ["Saved only in this browser.", "No connected agent or cloud sync."], 33),
  copy("available-3", 112, 790, 790, ["Download JSON to keep your work.", "Export PNG or use Present."], 32, ink),
  copy("limits-heading", 1020, 350, 788, ["With your coding agent"], 42, ink, 500),
  copy("limits-1", 1020, 451, 788, ["The agent creates and revises visuals.", "Its preview saves to a local JSON file."], 33),
  copy("limits-2", 1020, 605, 788, ["Bring downloaded JSON to your agent.", "Continue in its file-backed editor."], 33),
  copy("limits-3", 1020, 790, 788, ["Playground and file copies do not sync.", "Review generated facts and visuals."], 32, ink),
]));

slides.push(slide("start", "Try a real brief", "How do I start?", [
  ...heading("start", "Install the skill. Bring a real brief.", "Ask for a cover, social graphic, chart, diagram or presentation."),
  copy("setup-heading", 112, 350, 710, ["Install the Konpeki skill"], 40, ink, 500),
  copy("repository", 112, 435, 850, ["github.com/vcfgdev/konpeki"], 38, blue, 500),
  copy("commands", 112, 543, 840, ["Use your agent’s skill installer.", "Choose skills/konpeki in the repo."], 34),
  copy("requirements", 112, 696, 780, ["Node.js 24+ · npm", "An agent with file + command access", "A browser for the editable preview"], 32, ink),
  copy("brief-heading", 1020, 350, 788, ["Then give it one sentence"], 40, ink, 500),
  copy("brief", 1020, 450, 788, ["“Use Konpeki to turn these launch", "notes into a product announcement.”"], 35),
  copy("next-step", 1020, 696, 788, ["Need an empty canvas? Ask for init.", "A creation brief selects generate."], 32, blue, 500),
  copy("closing", 112, 906, 1696, ["Attach your materials; the agent opens and checks the editable result. No separate init needed."], 30, muted),
]));

const document: CompositionDocument = { schema: compositionSchema, title: "Introducing Konpeki", authoringMode: "default", theme: { id: "precision", mode: "paper" }, slides };
const result = validateComposition(document);
if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
await writeFile(new URL("./composition.json", import.meta.url), canonicalJSON(result.document) + "\n");
console.log(`Authored ${slides.length} editable slides.`);
