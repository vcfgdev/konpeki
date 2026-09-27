import type { GridComponent } from "./grid.ts";
import type { SceneShape } from "./scene.ts";
import type { composerPalette } from "../src/lib/theme.ts";
import icons from "./draft-icons.json" with { type: "json" };

/** Structural illustrations only; never substitute invented data for a chart. */
export function draftArtwork(component: GridComponent, palette: ReturnType<typeof composerPalette>) {
  const shapes: Pick<SceneShape, "tag" | "attributes">[] = [];
  const labels: { x: number; y: number; text: string }[] = [];
  const appearance = component.appearance as Record<string, string>;
  const accent = appearance.colorScheme === "monochrome" ? palette.fg : palette.accent;
  const context = palette.line;
  const add = (tag: SceneShape["tag"], attributes: SceneShape["attributes"]) => shapes.push({ tag, attributes });
  const path = (d: string, stroke = palette.muted, width = 2) => add("path", { d, fill: "none", stroke, "stroke-width": width });
  const rect = (x: number, y: number, width: number, height: number, fill = accent) => add("rect", { x, y, width, height, fill });
  if ((component.kind === "diagram" || component.kind === "chart") && component.topology) {
    const nodes = component.topology.nodes;
    const width = Math.min(120, 480 / nodes.length), pitch = 540 / nodes.length;
    const centers = new Map(nodes.map((node, index) => [node.id, { x: 30 + pitch * (index + 0.5), y: 120 }]));
    for (const edge of component.topology.edges) {
      const from = centers.get(edge.from)!, to = centers.get(edge.to)!;
      const direction = Math.sign(to.x - from.x), start = from.x + direction * width / 2, end = to.x - direction * width / 2;
      path(`M${start} 120H${end}m${-direction * 8} -6L${end} 120l${-direction * 8} 6`);
      if (edge.label) labels.push({ x: (start + end) / 2, y: 95, text: edge.label });
    }
    for (const node of nodes) {
      if (node.visible === false) continue;
      const center = centers.get(node.id)!;
      add("rect", { x: center.x - width / 2, y: 90, width, height: 60, rx: 6, fill: palette.bg, stroke: accent, "stroke-width": 2 });
      labels.push({ ...center, y: 126, text: node.id });
    }
  } else if (component.kind === "diagram") {
    for (const element of icons[component.appearance.type]) {
      // Icons share a 48×32 coordinate space. Keep their exact generated paths.
      shapes.push({ tag: element.kind as SceneShape["tag"], attributes: { fill: "none", stroke: accent, "stroke-width": 1.5, "stroke-linecap": "round", "stroke-linejoin": "round", ...element.attributes } as SceneShape["attributes"] });
    }
    return { shapes, labels, width: 48, height: 32 };
  } else if (component.kind === "image") {
    add("rect", { x: 24, y: 18, width: 552, height: 204, rx: 4, fill: context });
    add("circle", { cx: 455, cy: 66, r: 22, fill: accent });
    add("path", { d: "M45 205 190 72l112 103 80-68 173 98Z", fill: palette.muted });
  } else if (component.kind === "table") {
    for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
      rect(20 + col * 186, 20 + row * 52, 172, 38, row === 0 ? context : palette.wash);
    }
  } else if (component.kind === "chart") {
    const template = component.appearance.template, count = appearance.density === "standard" ? 4 : 3;
    if (template === "line") { path("M30 195H570M30 20V195"); path(count === 4 ? "M30 165L140 110L260 137L390 58L560 35" : "M30 165L260 137L560 35", accent, 5); }
    else if (template === "pie") { add("circle", { cx: 300, cy: 120, r: 92, fill: context }); add("path", { d: "M300 120V28A92 92 0 0 1 386 153Z", fill: accent }); }
    else if (template === "radar") { path("M300 25 410 88 368 205 232 205 190 88Z"); add("path", { d: "M300 58 378 101 348 174 255 188 219 99Z", fill: context }); path("M300 42 390 112 342 188 246 168 210 94Z", accent, 5); }
    else if (template === "treemap") { rect(30, 25, 330, 190); rect(370, 25, 200, 110, context); rect(370, 145, 125, 70); rect(505, 145, 65, 70, context); }
    else if (template === "scatter") { path("M30 215H570M30 20V215"); [[95,175],[142,158],[205,147],[248,122],[315,133],[370,92],[428,74],[515,48]].forEach(([cx, cy], i) => add("circle", { cx, cy, r: i === 7 ? 11 : 7, fill: i === 7 ? accent : context })); }
    else if (template === "sankey") { path("M70 72C210 72 230 105 350 105S450 58 530 58", accent, 28); path("M70 150C210 150 235 116 350 116S450 170 530 170", context, 19); rect(55,50,20,125,context); rect(340,85,20,98); rect(525,38,20,154); }
    else if (template === "annotated-detail") { rect(60,20,480,195,context); path("M90 195L220 70L325 155L410 100L510 195",accent,5); add("circle",{cx:430,cy:60,r:15,fill:accent}); path("M340 95L565 30"); }
    else if (appearance.orientation === "horizontal") [155,330,245,285].slice(0,count).forEach((width,i) => { rect(25,14+i*200/count,width,18); rect(25,36+i*200/count,width*0.72,13,context); });
    else { path("M25 215H575"); [92,175,130,155].slice(0,count).forEach((height,i) => { rect(48+i*510/count,215-height,42,height); rect(94+i*510/count,215-height*0.7,34,height*0.7,context); }); }
  }
  return { shapes, labels, width: 600, height: 240 };
}
