import type { ContentSlot, DiagramComponent, Rect } from "./types.ts";
import type { FontContext } from "./fonts.ts";
import { layoutText } from "./text-layout.ts";
import type { SceneItem, SceneShape, SceneText } from "./scene.ts";

/** Deliberately bounded: one connected chain, optionally splitting into two chains. */
export function processFlowIssue(component: Pick<DiagramComponent, "appearance" | "topology" | "customVisual">): string | undefined {
  const topology = component.topology;
  if (!topology || !topology.nodes.length) return "Process flow requires topology.";
  if (component.customVisual) return "Process flow and custom artwork are mutually exclusive.";
  if (!["process", "flowchart"].includes(component.appearance.type)) return "Process flow requires the process or flowchart diagram type.";
  const { nodes, edges } = topology;
  if (nodes.some(node => node.visible === false || node.primitive)) return "Process flow nodes must be visible and use the generated node shape.";
  const ids = [...nodes.map(node => node.id), ...edges.map(edge => edge.id)];
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) return "Process flow nodes and edges require distinct stable IDs.";
  const known = new Set(nodes.map(node => node.id));
  if (edges.some(edge => !known.has(edge.from) || !known.has(edge.to))) return "Unknown process flow endpoint.";
  const incoming = (id: string) => edges.filter(edge => edge.to === id);
  const outgoing = (id: string) => edges.filter(edge => edge.from === id);
  const roots = nodes.filter(node => !incoming(node.id).length);
  if (roots.length !== 1 || nodes.some(node => incoming(node.id).length > 1)) return "Process flow requires one root and does not support joins or cycles.";
  const forks = nodes.filter(node => outgoing(node.id).length > 1);
  if (forks.length > 1 || forks.some(node => outgoing(node.id).length !== 2)) return "Process flow supports at most one two-way fork.";
  if (forks.some(node => outgoing(node.id).some(edge => !edge.label?.trim()) ||
      new Set(outgoing(node.id).map(edge => edge.label!.trim())).size !== 2)) return "Both decision branches require distinct, nonempty labels.";
  const visited = new Set<string>();
  const visit = (id: string) => { if (visited.has(id)) return; visited.add(id); outgoing(id).forEach(edge => visit(edge.to)); };
  visit(roots[0].id);
  if (visited.size !== nodes.length || edges.length !== nodes.length - 1) return "Process flow must be connected and acyclic.";
}

export type ProcessNode = { id: string; label: string; box: Rect; pinned: boolean };
export type ProcessLayoutIssue = { elementId: string; message: string };
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const outside = (a: Rect, b: Rect) => a.x < b.x || a.y < b.y || a.x + a.width > b.x + b.width || a.y + a.height > b.y + b.height;

/** Uses the same text shaper and scene primitives as authored artwork. No saved geometry cache. */
export function layoutProcessFlow(component: Pick<DiagramComponent, "id" | "appearance" | "topology" | "processFlow" | "customVisual">,
  slots: ContentSlot[], cell: Rect, pageId: string, fonts: FontContext,
  style: { family: string; size: number; leading: number; ink: string; background: string; wash: string }) {
  const invalid = processFlowIssue(component);
  if (invalid) throw new Error(invalid);
  const { nodes, edges } = component.topology!;
  const horizontal = component.processFlow!.direction === "right";
  const { size, leading } = style, padding = size * .75, nodeWidth = size * 10;
  const outgoing = (id: string) => edges.filter(edge => edge.from === id);
  const root = nodes.find(node => !edges.some(edge => edge.to === node.id))!;
  const hasFork = nodes.some(node => outgoing(node.id).length === 2);
  const placements = new Map<string, { rank: number; lane: number }>();
  function place(id: string, rank: number, lane: number) {
    placements.set(id, { rank, lane });
    const next = outgoing(id);
    next.forEach((edge, i) => place(edge.to, rank + 1, next.length === 2 ? i : lane));
  }
  place(root.id, 0, hasFork ? .5 : 0);
  const shaped = new Map(nodes.map(node => {
    const source = slots.find(slot => slot.id === node.slotId)!.label;
    return [node.id, { source, layout: layoutText(fonts, { text: source, width: nodeWidth - padding * 2,
      fontFamily: style.family, fontSize: size, lineHeight: leading, align: "center", wrap: "pre-wrap", overflowWrap: "anywhere" }) }];
  }));
  const edgeLayouts = new Map(edges.filter(edge => edge.label).map(edge => [edge.id!, layoutText(fonts, {
    text: edge.label!, width: 0, fontFamily: style.family, fontSize: size, lineHeight: leading, wrap: "no-wrap",
  })]));
  const heights = new Map(nodes.map(node => [node.id, shaped.get(node.id)!.layout.height + padding * 2]));
  const maxHeight = Math.max(...heights.values());
  const gap = horizontal ? Math.max(size * 3, ...[...edgeLayouts.values()].map(layout => Math.max(...layout.lines.map(line => line.width)) * 2 + size * 2)) : leading * 3;
  const ranks = Math.max(...[...placements.values()].map(p => p.rank)) + 1;
  const rankSizes = Array.from({ length: ranks }, (_, rank) => horizontal ? nodeWidth : Math.max(...nodes.filter(node => placements.get(node.id)!.rank === rank).map(node => heights.get(node.id)!)));
  const mainSize = rankSizes.reduce((sum, value) => sum + value, 0) + gap * (ranks - 1);
  const crossStep = (horizontal ? maxHeight : nodeWidth) + size * 3;
  const crossSize = (horizontal ? maxHeight : nodeWidth) + (hasFork ? crossStep : 0);
  // Keep a real minimum footprint: insufficient room becomes a diagnostic, not a smaller font.
  const mainStart = Math.max(padding, ((horizontal ? cell.width : cell.height) - mainSize) / 2);
  const crossStart = Math.max(padding, ((horizontal ? cell.height : cell.width) - crossSize) / 2);
  const resolved: ProcessNode[] = nodes.map(node => {
    const p = placements.get(node.id)!, height = heights.get(node.id)!;
    const main = mainStart + rankSizes.slice(0, p.rank).reduce((sum, value) => sum + value + gap, 0);
    const cross = crossStart + p.lane * crossStep;
    const position = node.position ?? { x: horizontal ? main : cross, y: horizontal ? cross + (maxHeight - height) / 2 : main };
    return { id: node.id, label: shaped.get(node.id)!.source, pinned: !!node.position,
      box: { x: cell.x + position.x, y: cell.y + position.y, width: nodeWidth, height } };
  });
  const items: SceneItem[] = [], issues: ProcessLayoutIssue[] = [], labelBoxes: { id: string; box: Rect }[] = [];
  const owner = (elementId: string) => ({ pageId, componentId: component.id, elementId });
  const shape = (id: string, tag: SceneShape["tag"], attributes: SceneShape["attributes"]) => items.push({
    ...owner(id), kind: "shape", tag, attributes, transform: [1, 0, 0, 1, 0, 0], clip: cell,
  });
  const issue = (elementId: string, message: string) => issues.push({ elementId, message });
  for (const node of resolved) {
    if (outside({ x: node.box.x - 1, y: node.box.y - 1, width: node.box.width + 2, height: node.box.height + 2 }, cell)) issue(node.id, "Process node exceeds its content area; enlarge the component or revise placement.");
    for (const other of resolved) if (node.id < other.id && overlaps(node.box, other.box)) issue(node.id, `Process node overlaps ${other.id}; revise placement.`);
  }
  for (const edge of edges) {
    const from = resolved.find(node => node.id === edge.from)!.box, to = resolved.find(node => node.id === edge.to)!.box;
    const start = horizontal ? { x: from.x + from.width, y: from.y + from.height / 2 } : { x: from.x + from.width / 2, y: from.y + from.height };
    const end = horizontal ? { x: to.x, y: to.y + to.height / 2 } : { x: to.x + to.width / 2, y: to.y };
    const middle = horizontal ? (start.x + end.x) / 2 : (start.y + end.y) / 2;
    const points = horizontal ? [start, { x: middle, y: start.y }, { x: middle, y: end.y }, end]
      : [start, { x: start.x, y: middle }, { x: end.x, y: middle }, end];
    if ((horizontal ? end.x - start.x : end.y - start.y) < size) issue(edge.id!, "Process connection runs backwards or has too little clearance; move its nodes apart in the flow direction.");
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      if (a.x === b.x && a.y === b.y) continue;
      const segment = { x: Math.min(a.x, b.x) - 1, y: Math.min(a.y, b.y) - 1, width: Math.abs(a.x - b.x) + 2, height: Math.abs(a.y - b.y) + 2 };
      for (const node of resolved) if (node.id !== edge.from && node.id !== edge.to && overlaps(segment, node.box)) issue(edge.id!, `Process connection crosses ${node.id}; revise placement.`);
    }
    shape(edge.id!, "polyline", { points: points.map(p => `${p.x},${p.y}`).join(" "), fill: "none", stroke: style.ink, "stroke-width": 2 });
    const tip = size * .3;
    shape(edge.id!, "polyline", { points: horizontal
      ? `${end.x - tip},${end.y - tip} ${end.x},${end.y} ${end.x - tip},${end.y + tip}`
      : `${end.x - tip},${end.y - tip} ${end.x},${end.y} ${end.x + tip},${end.y - tip}`, fill: "none", stroke: style.ink, "stroke-width": 2 });
    const layout = edgeLayouts.get(edge.id!);
    if (layout) {
      const width = Math.max(...layout.lines.map(line => line.width));
      const box = horizontal
        ? { x: (middle + end.x) / 2 - width / 2, y: end.y - layout.height - size * .4, width, height: layout.height }
        : { x: end.x + size * .5, y: (middle + end.y) / 2 - layout.height / 2, width, height: layout.height };
      labelBoxes.push({ id: edge.id!, box });
      const item: SceneText = { ...owner(edge.id!), kind: "text", source: edge.label!, box, layout, fontSize: size, lineHeight: leading, fontWeight: 400, color: style.ink, opacity: 1, label: true, clip: cell };
      items.push(item);
    }
  }
  for (const label of labelBoxes) {
    if (outside(label.box, cell)) issue(label.id, "Process edge label exceeds its content area.");
    for (const node of resolved) if (overlaps(label.box, node.box)) issue(label.id, `Process edge label overlaps ${node.id}.`);
    for (const other of labelBoxes) if (label.id < other.id && overlaps(label.box, other.box)) issue(label.id, `Process edge label overlaps ${other.id}.`);
  }
  for (const node of resolved) {
    const { source, layout } = shaped.get(node.id)!;
    shape(node.id, "rect", { ...node.box, rx: size * .2, fill: outgoing(node.id).length === 2 ? style.wash : style.background, stroke: style.ink, "stroke-width": 2 });
    items.push({ ...owner(node.id), kind: "text", source, layout,
      box: { x: node.box.x + padding, y: node.box.y + padding, width: nodeWidth - padding * 2, height: layout.height },
      fontSize: size, lineHeight: leading, fontWeight: 400, color: style.ink, opacity: 1, label: true, clip: cell });
  }
  return { items, nodes: resolved, issues };
}
