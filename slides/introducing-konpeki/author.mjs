import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJSON } from "../../composition/compile.ts";

const here = dirname(fileURLToPath(import.meta.url));
const runtimeRoot = join(here, "../..");
const cover = JSON.parse(readFileSync(join(runtimeRoot, "slides/github-cover/composition.json"), "utf8"));
const markVisual = cover.slides[0].components.find((c) => c.id === "brand-mark").customVisual;

const INK = "theme:ink", MUTED = "theme:muted", ACCENT = "theme:accent", WASH = "theme:wash",
  DIVIDER = "theme:divider", SURFACE = "theme:surface", BG = "theme:background", ON_ACCENT = "theme:on-accent";
const HEAD = "theme:heading-font", BODY = "theme:body-font";

function page(id, name, question) {
  const s = {
    id, name, canvas: { width: 1920, height: 1080 },
    innerPadding: { top: 72, right: 112, bottom: 0, left: 112 },
    pageNumber: { style: "01", color: "muted" },
    audience: "Developers meeting Konpeki for the first time",
    question, intendedViewingSize: "presentation",
    contentSlots: [], components: [], groups: [], readingOrder: [], paintOrder: [], relationships: [],
  };
  const add = (c, role = "body", instruction = "") => {
    const slotId = `${c.id}-slot`;
    s.contentSlots.push({ id: slotId, label: c.id, role, required: true, instruction: instruction || c.content || c.customVisual?.description || c.id });
    s.components.push({ ...c, slotIds: [slotId] });
    s.readingOrder.push({ kind: "component", id: c.id });
    s.paintOrder.push(c.id);
  };
  return { s, add };
}

function text(id, content, rect, style, role = "body", extra = {}) {
  return {
    id, kind: "text-block", content, preferredRect: rect,
    textStyle: { weight: 400, lineHeight: 1.3, color: "ink", font: "body", ...style },
    appearance: { role, alignment: "start", border: "none", rule: "none", ...extra },
  };
}
const title = (id, content, y = 88, width = 1696) =>
  text(id, content, { x: 112, y, width, height: 90 }, { size: 58, weight: 600, lineHeight: 1.15, font: "heading" }, "title");

function vector(id, kind, rect, description, elements, appearance) {
  const c = { id, kind, preferredRect: rect, customVisual: { format: "vector", viewBox: { x: 0, y: 0, width: rect.width, height: rect.height }, description, fit: "contain", elements } };
  if (appearance) c.appearance = appearance;
  return c;
}

// element helpers; ids are prefixed per visual so they stay unique and stable
function V(prefix) {
  const els = [];
  const push = (id, kind, attributes, extra = {}) => { els.push({ id: `${prefix}-${id}`, kind, attributes, ...extra }); return `${prefix}-${id}`; };
  return {
    els,
    rect: (id, x, y, w, h, a = {}) => push(id, "rect", { x, y, width: w, height: h, ...a }),
    circle: (id, cx, cy, r, a = {}) => push(id, "circle", { cx, cy, r, ...a }),
    line: (id, x1, y1, x2, y2, a = {}) => push(id, "line", { x1, y1, x2, y2, stroke: MUTED, "stroke-width": 2, ...a }),
    path: (id, d, a = {}) => push(id, "path", { d, ...a }),
    text: (id, x, y, t, a = {}) => push(id, "text", { x, y, fill: INK, "font-family": BODY, "font-size": 22, ...a }, { text: t }),
    group: (id, a = {}) => push(id, "g", a),
    // open-headed arrow: shaft plus a separate head path so both stay editable
    arrow(id, x1, y1, x2, y2, a = {}) {
      const color = a.stroke ?? MUTED;
      this.line(`${id}-shaft`, x1, y1, x2, y2, { stroke: color, "stroke-width": 2.5, ...a });
      const ang = Math.atan2(y2 - y1, x2 - x1), L = 14, W = 0.5;
      const p1 = [x2 - L * Math.cos(ang - W), y2 - L * Math.sin(ang - W)];
      const p2 = [x2 - L * Math.cos(ang + W), y2 - L * Math.sin(ang + W)];
      const f = (n) => Math.round(n * 10) / 10;
      this.path(`${id}-head`, `M${f(p1[0])} ${f(p1[1])}L${x2} ${y2}L${f(p2[0])} ${f(p2[1])}`, { fill: "none", stroke: color, "stroke-width": 2.5, "stroke-linecap": "round", "stroke-linejoin": "round" });
    },
  };
}
const frame = { fill: BG, stroke: DIVIDER, "stroke-width": 2, rx: 8 };
const bar = (v, id, x, y, w, h = 10, fill = DIVIDER) => v.rect(id, x, y, w, h, { rx: h / 2, fill });

// ---------- 1. Cover ----------
const p1 = page("cover", "Konpeki", "What is Konpeki?");
p1.s.pageNumber = { style: "none", color: "muted" };
p1.add({ id: "mark", kind: "image", preferredRect: { x: 112, y: 120, width: 72, height: 72 }, customVisual: markVisual }, "image");
p1.add(text("wordmark", "Konpeki", { x: 204, y: 126, width: 400, height: 64 }, { size: 44, weight: 600, font: "heading", lineHeight: 1.2 }));
p1.add(text("cover-title", "Create clear visuals\nwith your coding agent.", { x: 112, y: 263.8597972972973, width: 848, height: 316.1402027027027 }, { size: 74, weight: 600, lineHeight: 1.12, font: "heading" }, "title"), "takeaway");
p1.add(text("cover-lead", "Your agent drafts covers, social graphics, visual explanations and presentations. You and your agent edit the same page.", { x: 112, y: 620, width: 760, height: 140 }, { size: 32, lineHeight: 1.4, color: "muted" }, "subtitle"));
{
  const v = V("fam");
  const label = (id, x, y, t) => v.text(id, x, y, t, { fill: MUTED, "font-size": 22 });
  // Presentation 16:9
  v.rect("pres", 0, 20, 480, 270, frame);
  bar(v, "pres-title", 32, 52, 260, 18, INK);
  bar(v, "pres-l1", 32, 90, 180);
  bar(v, "pres-l2", 32, 112, 150);
  v.line("pres-axis", 240, 250, 448, 250, { stroke: DIVIDER });
  [[256, 150], [300, 110], [344, 170], [388, 70]].forEach(([x, h], i) => v.rect(`pres-b${i}`, x, 250 - h, 32, h, { fill: i === 3 ? ACCENT : DIVIDER }));
  label("pres-label", 0, 322, "Presentation 1920×1080");
  // Square post
  v.rect("sq", 540, 20, 268, 268, frame);
  bar(v, "sq-t1", 568, 52, 200, 18, INK);
  bar(v, "sq-t2", 568, 80, 150, 18, INK);
  v.circle("sq-n1", 600, 200, 22, { fill: WASH, stroke: ACCENT, "stroke-width": 2.5 });
  v.circle("sq-n2", 744, 200, 22, { fill: WASH, stroke: ACCENT, "stroke-width": 2.5 });
  v.arrow("sq-a", 626, 200, 716, 200);
  label("sq-label", 540, 322, "Square post");
  // Portrait 4:5 and link preview 1200:630 share one row height, keeping their true proportions
  const rowY = 390, rowH = 284, ptW = 227, ogX = ptW + 40, ogW = 808 - ogX;
  v.rect("pt", 0, rowY, ptW, rowH, frame);
  v.rect("pt-hero", 20, rowY + 20, 187, 100, { rx: 6, fill: WASH });
  bar(v, "pt-t1", 20, rowY + 138, 160, 16, INK);
  bar(v, "pt-t2", 20, rowY + 162, 110, 16, INK);
  bar(v, "pt-l1", 20, rowY + 196, 180);
  bar(v, "pt-l2", 20, rowY + 216, 150);
  v.rect("pt-cta", 20, rowY + 244, 84, 20, { rx: 4, fill: ACCENT });
  label("pt-label", 0, rowY + rowH + 32, "Portrait post");
  v.rect("og", ogX, rowY, ogW, rowH, frame);
  bar(v, "og-t1", ogX + 30, rowY + 34, 300, 18, INK);
  bar(v, "og-l1", ogX + 30, rowY + 72, 230);
  [0, 1, 2].forEach((i) => v.rect(`og-row${i}`, ogX + 30, rowY + 120 + i * 38, ogW - 60, 26, { rx: 4, fill: i === 0 ? WASH : SURFACE, stroke: DIVIDER, "stroke-width": 1.5 }));
  label("og-label", ogX, rowY + rowH + 32, "Link preview 1200×630");
  const fam = vector("page-family", "image", { x: 1040, y: 180, width: 768, height: 684 }, "Four page sizes Konpeki supports: presentation, square post, portrait post and link preview, each sketched with typical components.", v.els);
  fam.customVisual.viewBox = { x: 0, y: 0, width: 808, height: 720 };
  p1.add(fam, "image");
}

// ---------- 2. Brief to page ----------
const p2 = page("brief-to-page", "From brief to page", "What does my agent do with Konpeki?");
p2.add(title("flow-title", "Give your agent a brief. It returns an editable page."), "takeaway");
p2.add(text("flow-lead", "Konpeki is a skill for your coding agent plus a canvas you both work on.", { x: 112, y: 190, width: 1400, height: 50 }, { size: 32, color: "muted" }, "subtitle"));
const steps2 = [
  ["Your brief", "Notes, source material and where the visual will be used."],
  ["Your coding agent", "Follows Konpeki's authoring guide and writes composition.json in your workspace."],
  ["Canvas preview", "The agent opens the page, inspects the render and repairs problems it finds."],
  ["Your page", "Edit it directly, Present it, export PNG or download the editable JSON."],
];
{
  const v = V("flow");
  const colW = 364, gap = 80;
  steps2.forEach((_, i) => {
    const cx = i * (colW + gap) + 32;
    v.circle(`n${i}`, cx, 32, 30, { fill: i === 3 ? ACCENT : BG, stroke: ACCENT, "stroke-width": 3 });
    v.text(`n${i}-num`, cx, 42, String(i + 1), { "font-size": 28, "font-weight": 600, "text-anchor": "middle", fill: i === 3 ? ON_ACCENT : ACCENT, "font-family": HEAD });
    if (i < 3) v.arrow(`e${i}`, cx + 46, 32, cx + colW + gap - 46, 32);
  });
  p2.add(vector("flow-diagram", "diagram", { x: 112, y: 320, width: 1696, height: 64 }, "Four numbered steps joined by arrows: brief, agent, canvas preview, page.", v.els, { type: "process", selection: "explicit", border: "none", colorScheme: "accent-with-muted-context", emphasis: "primary", density: "sparse" }), "process-step");
  steps2.forEach(([h, d], i) => {
    const x = 112 + i * (colW + gap);
    p2.add(text(`step${i + 1}-head`, h, { x, y: 420, width: colW, height: 50 }, { size: 34, weight: 600, font: "heading" }), "process-step");
    p2.add(text(`step${i + 1}-body`, d, { x, y: 480, width: colW, height: 200 }, { size: 27, lineHeight: 1.4, color: "muted" }), "process-step");
  });
}
{
  const v = V("flow-rule");
  v.line("rule", 0, 1, 1696, 1, { stroke: DIVIDER, "stroke-width": 2 });
  p2.add(vector("flow-divider", "image", { x: 112, y: 730, width: 1696, height: 2 }, "Divider between the main flow and the alternatives below it.", v.els), "image");
}
p2.add(text("sketch-head", "Prefer to sketch first?", { x: 112, y: 770, width: 800, height: 50 }, { size: 32, weight: 600, font: "heading" }));
p2.add(text("sketch-body", "In the editor your agent opened, add a component, describe its intent, then choose Build it. Your agent drafts from your layout.", { x: 112, y: 828, width: 800, height: 110 }, { size: 26, lineHeight: 1.4, color: "muted" }));
p2.add(text("firstuse-head", "No separate setup step", { x: 1004, y: 770, width: 804, height: 50 }, { size: 32, weight: 600, font: "heading" }));
p2.add(text("firstuse-body", "On first use the skill installs the Konpeki runtime in a user cache, not in your project.", { x: 1004, y: 828, width: 804, height: 110 }, { size: 26, lineHeight: 1.4, color: "muted" }));

// ---------- 3. Same file ----------
const p3 = page("shared-file", "One shared file", "Can I edit what the agent made?");
p3.add(title("share-title", "You and your agent edit the same file."), "takeaway");
p3.add(text("share-lead", "The page lives in composition.json. The browser canvas and your agent both read and write it.", { x: 112, y: 190, width: 1500, height: 50 }, { size: 32, color: "muted" }, "subtitle"));
{
  const v = V("share");
  const H = 30, top = 70;
  // browser canvas panel
  v.text("canvas-h", 0, 30, "Browser canvas", { "font-size": H, "font-weight": 600, "font-family": HEAD });
  v.rect("canvas-win", 0, top, 470, 400, { rx: 10, fill: SURFACE, stroke: DIVIDER, "stroke-width": 2 });
  v.circle("canvas-dot1", 22, top + 20, 5, { fill: DIVIDER });
  v.circle("canvas-dot2", 40, top + 20, 5, { fill: DIVIDER });
  v.rect("canvas-page", 40, top + 50, 390, 220, { fill: BG, stroke: DIVIDER, "stroke-width": 1.5 });
  bar(v, "canvas-t", 64, top + 78, 200, 16, INK);
  bar(v, "canvas-l1", 64, top + 110, 150);
  v.rect("canvas-sel", 240, top + 140, 168, 108, { fill: "none", stroke: ACCENT, "stroke-width": 2, "stroke-dasharray": "6 5" });
  [[240, top + 140], [408, top + 140], [240, top + 248], [408, top + 248]].forEach(([x, y], i) => v.rect(`canvas-h${i}`, x - 5, y - 5, 10, 10, { fill: BG, stroke: ACCENT, "stroke-width": 2 }));
  [[258, 60], [300, 40], [342, 80]].forEach(([x, h], i) => v.rect(`canvas-b${i}`, x, top + 236 - h, 28, h, { fill: i === 2 ? ACCENT : DIVIDER }));
  v.text("canvas-c1", 40, top + 320, "Edit text, move and resize", { fill: MUTED, "font-size": 22 });
  v.text("canvas-c2", 40, top + 352, "components, undo and redo", { fill: MUTED, "font-size": 22 });
  // file
  const fx = 758, fy = top + 70, fw = 180, fh = 230;
  v.path("file", `M${fx} ${fy}H${fx + fw - 44}L${fx + fw} ${fy + 44}V${fy + fh}H${fx}Z`, { fill: WASH, stroke: ACCENT, "stroke-width": 2.5, "stroke-linejoin": "round" });
  v.path("file-fold", `M${fx + fw - 44} ${fy}V${fy + 44}H${fx + fw}`, { fill: "none", stroke: ACCENT, "stroke-width": 2.5, "stroke-linejoin": "round" });
  v.text("file-brace", fx + fw / 2, fy + 150, "{ }", { "font-size": 64, "font-weight": 600, fill: ACCENT, "text-anchor": "middle", "font-family": HEAD });
  v.text("file-name", fx + fw / 2, fy + fh + 44, "composition.json", { "font-size": 26, "font-weight": 600, "text-anchor": "middle" });
  // agent panel
  const ax = 1226;
  v.text("agent-h", ax, 30, "Coding agent", { "font-size": H, "font-weight": 600, "font-family": HEAD });
  v.rect("agent-win", ax, top, 470, 400, { rx: 10, fill: SURFACE, stroke: DIVIDER, "stroke-width": 2 });
  v.text("agent-cmd", ax + 28, top + 64, "konpeki validate composition.json", { "font-size": 21, fill: INK });
  bar(v, "agent-l1", ax + 28, top + 100, 300);
  bar(v, "agent-l2", ax + 28, top + 124, 240);
  bar(v, "agent-l3", ax + 28, top + 148, 330);
  bar(v, "agent-l4", ax + 28, top + 172, 200);
  v.text("agent-c1", ax + 28, top + 320, "Rereads the file, keeps your", { fill: MUTED, "font-size": 22 });
  v.text("agent-c2", ax + 28, top + 352, "edits and component IDs", { fill: MUTED, "font-size": 22 });
  // arrows: canvas <-> file, agent <-> file
  const l = 470 + 14, r = fx - 14, rr = fx + fw + 14, al = ax - 14;
  v.arrow("save", l, fy + 70, r, fy + 70, { stroke: ACCENT });
  v.text("save-l", (l + r) / 2, fy + 52, "Saves each valid edit", { "font-size": 20, fill: MUTED, "text-anchor": "middle" });
  v.arrow("load", r, fy + 170, l, fy + 170);
  v.text("load-l", (l + r) / 2, fy + 204, "Loads new revisions", { "font-size": 20, fill: MUTED, "text-anchor": "middle" });
  v.arrow("write", al, fy + 70, rr, fy + 70, { stroke: ACCENT });
  v.text("write-l", (al + rr) / 2, fy + 52, "Writes validated revisions", { "font-size": 20, fill: MUTED, "text-anchor": "middle" });
  v.arrow("read", rr, fy + 170, al, fy + 170);
  v.text("read-l", (al + rr) / 2, fy + 204, "Rereads before revising", { "font-size": 20, fill: MUTED, "text-anchor": "middle" });
  p3.add(vector("share-diagram", "diagram", { x: 112, y: 300, width: 1696, height: 480 }, "Browser canvas and coding agent on either side of composition.json. Arrows: canvas saves edits to the file and loads new revisions; agent writes validated revisions and rereads before revising.", v.els, { type: "data-flow", selection: "explicit", border: "none", colorScheme: "accent-with-muted-context", emphasis: "primary", density: "sparse" }), "evidence");
}
p3.add(text("share-note", "A revision hash stops either side from overwriting a newer change. When your agent updates the file, your previous version stays in Undo.", { x: 112, y: 840, width: 1696, height: 90 }, { size: 26, lineHeight: 1.4, color: "muted" }, "caption"));

// ---------- 4. Components ----------
const p4 = page("components", "Five components", "What is a page made of?");
p4.add(title("comp-title", "Every page is built from five editable components."), "takeaway");
const comps = [
  ["Text block", "Headlines, body copy and captions with consistent type roles."],
  ["Diagram", "Nodes and connections for processes, systems and flows."],
  ["Chart", "Bar, line, Sankey and other forms for the data you supply."],
  ["Image", "Licensed pictures, brand marks and illustrations."],
  ["Table", "Rows and columns derived from your content."],
];
{
  const v = V("icons");
  const colW = 300, gap = 49, top = 20, h = 180;
  comps.forEach((_, i) => v.rect(`tile${i}`, i * (colW + gap), top, colW, h, { rx: 10, fill: SURFACE, stroke: DIVIDER, "stroke-width": 1.5 }));
  const ox = (i) => i * (colW + gap);
  // text
  bar(v, "t-h", ox(0) + 40, top + 44, 180, 20, INK);
  bar(v, "t-l1", ox(0) + 40, top + 88, 220);
  bar(v, "t-l2", ox(0) + 40, top + 110, 200);
  bar(v, "t-l3", ox(0) + 40, top + 132, 140);
  // diagram
  const d = ox(1);
  v.rect("d-a", d + 30, top + 66, 64, 48, { rx: 6, fill: BG, stroke: ACCENT, "stroke-width": 2.5 });
  v.rect("d-b", d + 206, top + 26, 64, 48, { rx: 6, fill: BG, stroke: MUTED, "stroke-width": 2 });
  v.rect("d-c", d + 206, top + 106, 64, 48, { rx: 6, fill: BG, stroke: MUTED, "stroke-width": 2 });
  v.arrow("d-ab", d + 100, top + 82, d + 198, top + 54);
  v.arrow("d-ac", d + 100, top + 98, d + 198, top + 126);
  // chart
  const c = ox(2);
  v.line("c-axis", c + 36, top + 150, c + 264, top + 150, { stroke: INK });
  [[60, 50], [106, 90], [152, 70], [198, 110]].forEach(([x, bh], i) => v.rect(`c-b${i}`, c + x, top + 150 - bh, 36, bh, { fill: i === 3 ? ACCENT : DIVIDER }));
  // image
  const m = ox(3);
  v.rect("i-frame", m + 60, top + 30, 180, 120, { rx: 6, fill: WASH, stroke: ACCENT, "stroke-width": 2 });
  v.circle("i-sun", m + 200, top + 62, 12, { fill: ACCENT });
  v.path("i-hill", `M${m + 60} ${top + 150}L${m + 120} ${top + 88}L${m + 164} ${top + 126}L${m + 186} ${top + 108}L${m + 240} ${top + 150}Z`, { fill: ACCENT, opacity: 0.55 });
  // table
  const t = ox(4);
  v.rect("tb-head", t + 40, top + 34, 220, 28, { fill: WASH });
  [0, 1, 2, 3, 4].forEach((r) => v.line(`tb-r${r}`, t + 40, top + 34 + r * 28, t + 260, top + 34 + r * 28, { stroke: r === 0 || r === 4 ? INK : DIVIDER, "stroke-width": r === 0 || r === 4 ? 2 : 1.5 }));
  [1, 2].forEach((k) => v.line(`tb-c${k}`, t + 40 + k * 73, top + 34, t + 40 + k * 73, top + 146, { stroke: DIVIDER, "stroke-width": 1.5 }));
  p4.add(vector("comp-icons", "image", { x: 112, y: 250, width: 1696, height: 220 }, "Five schematic icons: text lines, a small node diagram, a bar chart, a framed picture and a table.", v.els), "image");
  comps.forEach(([hd, body], i) => {
    const x = 112 + i * (colW + gap);
    p4.add(text(`comp${i + 1}-head`, hd, { x, y: 500, width: colW, height: 50 }, { size: 34, weight: 600, font: "heading" }), "comparison-item");
    p4.add(text(`comp${i + 1}-body`, body, { x, y: 560, width: colW, height: 170 }, { size: 26, lineHeight: 1.4, color: "muted" }), "comparison-item");
  });
}
p4.add(text("comp-note", "Diagram, Chart and Table start as structural drafts. Finished artwork becomes editable vector shapes with stable IDs, drawn from your source data, so you can select and change any line or label.", { x: 112, y: 848.1918819188191, width: 1696, height: 120 }, { size: 28, lineHeight: 1.45 }, "body"));

// ---------- 5. Notes and Build it ----------
const p5 = page("notes", "Revision notes", "How do I ask for changes?");
p5.add(title("notes-title", "Point at what to change, then choose Build it."), "takeaway");
{
  const v = V("ui");
  v.rect("win", 0, 0, 860, 560, { rx: 12, fill: SURFACE, stroke: DIVIDER, "stroke-width": 2 });
  v.line("split", 250, 0, 250, 560, { stroke: DIVIDER, "stroke-width": 2 });
  v.text("tab", 28, 48, "Notes", { "font-size": 24, "font-weight": 600, "font-family": HEAD });
  v.line("tab-u", 28, 60, 94, 60, { stroke: ACCENT, "stroke-width": 3 });
  [[1, 90], [2, 200]].forEach(([n, y]) => {
    v.rect(`note${n}`, 20, y, 210, 92, { rx: 8, fill: BG, stroke: DIVIDER, "stroke-width": 1.5 });
    v.circle(`note${n}-pin`, 46, y + 28, 14, { fill: ACCENT });
    v.text(`note${n}-n`, 46, y + 36, String(n), { "font-size": 18, "font-weight": 600, fill: ON_ACCENT, "text-anchor": "middle" });
    bar(v, `note${n}-l1`, 72, y + 22, 136, 10);
    bar(v, `note${n}-l2`, 36, y + 56, 170, 10);
  });
  v.rect("build", 20, 480, 210, 56, { rx: 8, fill: ACCENT });
  v.text("build-t", 125, 516, "Build it", { "font-size": 24, "font-weight": 600, fill: ON_ACCENT, "text-anchor": "middle", "font-family": HEAD });
  // page on canvas
  const px = 290, py = 90, pw = 530, ph = 298;
  v.rect("page", px, py, pw, ph, { fill: BG, stroke: DIVIDER, "stroke-width": 1.5 });
  bar(v, "page-t", px + 32, py + 36, 260, 20, INK);
  bar(v, "page-l", px + 32, py + 74, 180);
  v.line("page-axis", px + 250, py + 262, px + 498, py + 262, { stroke: DIVIDER });
  [[270, 90], [320, 130], [370, 70], [420, 160]].forEach(([x, bh], i) => v.rect(`page-b${i}`, px + x, py + 262 - bh, 36, bh, { fill: i === 3 ? ACCENT : DIVIDER }));
  v.rect("page-sel", px + 410, py + 92, 56, 178, { fill: "none", stroke: ACCENT, "stroke-width": 2, "stroke-dasharray": "6 5" });
  [[px + 300, py + 30, 1], [px + 480, py + 90, 2]].forEach(([x, y, n]) => {
    v.circle(`pin${n}`, x, y, 16, { fill: ACCENT, stroke: BG, "stroke-width": 3 });
    v.text(`pin${n}-n`, x, y + 7, String(n), { "font-size": 19, "font-weight": 600, fill: ON_ACCENT, "text-anchor": "middle" });
  });
  v.text("canvas-cap", px, py + ph + 56, "Pins and notes never appear in", { "font-size": 21, fill: MUTED });
  v.text("canvas-cap2", px, py + ph + 86, "Present or PNG exports.", { "font-size": 21, fill: MUTED });
  p5.add(vector("notes-ui", "image", { x: 112, y: 260, width: 860, height: 560 }, "Schematic editor: Notes panel with two numbered notes and a Build it button; a page on the canvas with matching pins on the title and a selected chart bar.", v.els), "image");
}
const steps5 = [
  ["Select a target", "A page, a component or a single vector shape inside it."],
  ["Add notes", "Write what should change. Add notes to several targets before sending."],
  ["Choose Build it", "The saved revision and every open note go to your agent as one request."],
  ["Your agent revises", "It applies each note to its target, checks the render, then marks the request finished."],
];
steps5.forEach(([h, d], i) => {
  const y = 262 + i * 142;
  p5.add(text(`nstep${i + 1}-num`, String(i + 1), { x: 1060, y, width: 56, height: 50 }, { size: 36, weight: 600, color: "accent", font: "heading", lineHeight: 1.2 }), "process-step");
  p5.add(text(`nstep${i + 1}-head`, h, { x: 1124, y, width: 684, height: 50 }, { size: 32, weight: 600, font: "heading", lineHeight: 1.3 }), "process-step");
  p5.add(text(`nstep${i + 1}-body`, d, { x: 1124, y: y + 50, width: 684, height: 80 }, { size: 25, lineHeight: 1.4, color: "muted" }), "process-step");
});
p5.add(text("notes-limit", "Notes and Build it need a preview your agent opened from a file. Build it cannot wake an idle agent; use Copy prompt to hand over the request.", { x: 112, y: 880, width: 1696, height: 90 }, { size: 26, lineHeight: 1.4, color: "muted" }, "caption"));

// ---------- 6. Browser or agent ----------
const p6 = page("browser-or-agent", "Browser or agent", "Where should I start, and where is my work saved?");
p6.add(title("where-title", "Try it in the browser. Keep working with your agent."), "takeaway");
{
  const cols = [
    { x: 112, w: 330 },
    { x: 490, w: 620 },
    { x: 1158, w: 650 },
  ];
  const rows = [
    ["Start from", "An example page, or a blank one", "Your brief and materials"],
    ["Saved to", "This browser only; no cloud sync", "composition.json in your workspace"],
    ["Changes", "Edit by hand", "Edit by hand, or send notes with Build it"],
    ["Get it out", "Download JSON, export PNG or Present", "Export PNG or Present; the file is already saved"],
  ];
  const top = 250, headH = 70, rowH = 112;
  const v = V("where");
  v.line("head-rule", 0, headH, 1696, headH, { stroke: INK, "stroke-width": 2 });
  rows.forEach((_, i) => v.line(`row${i}-rule`, 0, headH + (i + 1) * rowH, 1696, headH + (i + 1) * rowH, { stroke: i === rows.length - 1 ? INK : DIVIDER, "stroke-width": i === rows.length - 1 ? 2 : 1.5 }));
  p6.add(vector("where-rules", "image", { x: 112, y: top, width: 1696, height: headH + rows.length * rowH + 2 }, "Table rules: a heading rule, row separators and a closing rule.", v.els), "image");
  p6.add(text("where-h1", "Browser playground", { x: cols[1].x, y: top + 10, width: cols[1].w, height: 50 }, { size: 34, weight: 600, font: "heading" }, "body"), "comparison-item");
  p6.add(text("where-h2", "With your coding agent", { x: cols[2].x, y: top + 10, width: cols[2].w, height: 50 }, { size: 34, weight: 600, font: "heading", color: "accent" }, "body"), "comparison-item");
  rows.forEach(([label, a, b], i) => {
    const y = top + headH + i * rowH + 32;
    p6.add(text(`where-r${i + 1}-label`, label, { x: cols[0].x, y, width: cols[0].w, height: 46 }, { size: 28, weight: 600, color: "muted" }), "comparison-item");
    p6.add(text(`where-r${i + 1}-browser`, a, { x: cols[1].x, y, width: cols[1].w, height: 46 }, { size: 28 }), "comparison-item");
    p6.add(text(`where-r${i + 1}-agent`, b, { x: cols[2].x, y, width: cols[2].w, height: 46 }, { size: 28 }), "comparison-item");
  });
}
p6.add(text("where-note", "To switch, download JSON from the playground and give it to your agent. The two copies don't sync afterwards.", { x: 112, y: 840, width: 1696, height: 50 }, { size: 26, color: "muted" }, "caption"));

// ---------- 7. Start ----------
const p7 = page("start", "Get started", "How do I start?");
p7.add(title("start-title", "Start with one install and a brief."), "takeaway");
{
  const v = V("boxes");
  v.rect("cmd", 0, 0, 960, 88, { rx: 8, fill: BG, stroke: DIVIDER, "stroke-width": 1.5 });
  v.rect("brief", 0, 210, 960, 150, { rx: 8, fill: BG, stroke: DIVIDER, "stroke-width": 1.5 });
  p7.add(vector("start-boxes", "image", { x: 112, y: 324, width: 960, height: 360 }, "Background panels for the install command and the example brief.", v.els), "image");
}
p7.add(text("start-s1", "1  Install the skill once", { x: 112, y: 260, width: 960, height: 50 }, { size: 32, weight: 600, font: "heading" }), "process-step");
p7.add(text("start-cmd", "npx skills add vcfgdev/konpeki -g", { x: 144, y: 346, width: 900, height: 46 }, { size: 32, lineHeight: 1.3 }), "process-step");
p7.add(text("start-s2", "2  Send your agent a brief", { x: 112, y: 470, width: 960, height: 50 }, { size: 32, weight: 600, font: "heading" }), "process-step");
p7.add(text("start-brief", "Use Konpeki to create a one-page explainer of how a browser, API and database work together.", { x: 144, y: 562, width: 900, height: 96 }, { size: 32, lineHeight: 1.4 }), "process-step");
p7.add(text("start-s2-note", "Your agent prepares the runtime, writes the file, opens the canvas and checks the result. Keep revising in the same conversation.", { x: 112, y: 716, width: 960, height: 100 }, { size: 26, lineHeight: 1.4, color: "muted" }), "body");
p7.add(text("need-head", "You need", { x: 1200, y: 260, width: 608, height: 50 }, { size: 32, weight: 600, font: "heading" }));
[["Node.js 24+ and npm", 1], ["A coding agent that can edit files and run commands", 2], ["A browser", 1]].reduce((y, [t, lines], i) => {
  const h = Math.ceil(lines * 28 * 1.4) + 8;
  p7.add(text(`need-${i + 1}`, t, { x: 1200, y, width: 560, height: h }, { size: 28, lineHeight: 1.4 }));
  return y + h + 18;
}, 330);
p7.add(text("init-head", "Want an empty canvas first?", { x: 1200, y: 580, width: 608, height: 50 }, { size: 32, weight: 600, font: "heading" }));
p7.add(text("init-body", "Ask your agent for Konpeki init. It opens a blank page in the editor without generating anything.", { x: 1200, y: 644, width: 608, height: 120 }, { size: 26, lineHeight: 1.45, color: "muted" }));

const doc = {
  schema: "konpeki-composition/v1",
  title: "Introducing Konpeki",
  authoringMode: "default",
  theme: { id: "plex", mode: "paper", typography: "hanken-grotesk" },
  slides: [p1, p2, p3, p4, p5, p6, p7].map((p) => p.s),
};
writeFileSync(join(here, "composition.json"), canonicalJSON(doc) + "\n");
console.log("wrote", join(here, "composition.json"));
