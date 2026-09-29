import type { FontContext } from "./fonts.ts";
import { textInkBounds, type ScenePage } from "./scene.ts";
export { textInkBounds } from "./scene.ts";

export type DiagnosticSeverity = "error" | "warning";
export interface Diagnostic {
  code: "native-overflow" | "clipped-label" | "missing-glyph" | "draft-placeholder" | "chart-scale" | "text-contrast" | "group-overflow" | "component-overflow" | "process-layout";
  severity: DiagnosticSeverity;
  pageId: string;
  componentId?: string;
  elementId?: string;
  groupId?: string;
  message: string;
  evidence: Record<string, unknown>;
}

const target = (scene: ScenePage, item?: { componentId?: string; elementId?: string }) => ({
  pageId: scene.pageId,
  ...(item?.componentId ? { componentId: item.componentId } : {}),
  ...(item?.elementId ? { elementId: item.elementId } : {}),
});

const outside = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x || a.y < b.y || a.x + a.width > b.x + b.width || a.y + a.height > b.y + b.height;

/** Portable deterministic checks. Contrast is added by checkPageNode in check-node.ts. */
export function checkPage(scene: ScenePage, fonts: FontContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const item of scene.items) {
    if (item.kind !== "text") continue;
    const inkBounds = textInkBounds(item, fonts);
    if (inkBounds && item.clip && outside(inkBounds, item.clip)) {
      const code = item.label ? "clipped-label" : "native-overflow";
      diagnostics.push({ code, severity: "error", ...target(scene, item),
        message: item.label ? "Label ink is clipped by its content frame." : "Text ink overflows its content frame.",
        evidence: { source: item.source, inkBounds, clip: item.clip } });
    }
    for (const missing of item.layout.missingGlyphs) diagnostics.push({ code: "missing-glyph", severity: "error", ...target(scene, item),
      message: `No bundled font contains ${JSON.stringify(missing.text)}.`,
      evidence: { source: item.source, range: [missing.start, missing.end], text: missing.text, codePoints: missing.codePoints.map(value => `U+${value.toString(16).toUpperCase().padStart(4, "0")}`) } });
  }
  for (const group of scene.groups ?? []) if (outside(group.bounds, group.box))
    diagnostics.push({ code: "group-overflow", severity: "error", pageId: scene.pageId, groupId: group.id,
      message: "Group contents exceed its area; recompose the members or enlarge the area.",
      evidence: { bounds: group.bounds, area: group.box } });
  for (const component of scene.components) {
    if (outside(component.box, { x: 0, y: 0, width: scene.width, height: scene.height }))
      diagnostics.push({ code: "component-overflow", severity: "error", pageId: scene.pageId, componentId: component.id,
        message: "Component extends beyond the page; move it or compose a page break.", evidence: { box: component.box } });
    for (const issue of component.processIssues ?? []) diagnostics.push({ code: "process-layout", severity: "error",
      pageId: scene.pageId, componentId: component.id, elementId: issue.elementId, message: issue.message,
      evidence: { nodes: component.processNodes, contentBox: component.contentBox } });
    if (component.draft) diagnostics.push({ code: "draft-placeholder", severity: "warning", pageId: scene.pageId, componentId: component.id,
      message: "Component still uses generated draft artwork.", evidence: { draft: true } });
    if (component.chart && component.artworkScale && component.artworkScale.some(value => Math.abs(value - 1) > 1e-6))
      diagnostics.push({ code: "chart-scale", severity: "warning", pageId: scene.pageId, componentId: component.id,
        message: "Chart artwork is scaled; review pixel-unit visual details.", evidence: { scaleX: component.artworkScale[0], scaleY: component.artworkScale[1] } });
  }
  return diagnostics;
}
