import type { FontContext } from "./fonts.ts";
import type { ScenePage, SceneText } from "./scene.ts";

export type DiagnosticSeverity = "error" | "warning";
export interface Diagnostic {
  code: "native-overflow" | "clipped-label" | "missing-glyph" | "draft-placeholder" | "chart-scale" | "text-contrast";
  severity: DiagnosticSeverity;
  pageId: string;
  componentId?: string;
  elementId?: string;
  message: string;
  evidence: Record<string, unknown>;
}

const target = (scene: ScenePage, item?: { componentId?: string; elementId?: string }) => ({
  pageId: scene.pageId,
  ...(item?.componentId ? { componentId: item.componentId } : {}),
  ...(item?.elementId ? { elementId: item.elementId } : {}),
});

/** The exact ink bounds produced by HarfBuzz, in page pixels. */
export function textInkBounds(item: SceneText, fonts: FontContext) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity, glyphCount = 0;
  for (const line of item.layout.lines) for (const glyph of line.glyphs) {
    const font = fonts.fonts.get(glyph.fontId);
    const extents = font?.hbFont.glyphExtents(glyph.glyphId);
    if (!font || !extents) continue;
    const scale = item.fontSize / font.unitsPerEm;
    const x = item.box.x + glyph.x + extents.xBearing * scale;
    const y = item.box.y + glyph.y - extents.yBearing * scale;
    const x2 = x + extents.width * scale;
    const y2 = y - extents.height * scale;
    left = Math.min(left, x, x2); right = Math.max(right, x, x2);
    top = Math.min(top, y, y2); bottom = Math.max(bottom, y, y2); glyphCount++;
  }
  return glyphCount ? { x: left, y: top, width: right - left, height: bottom - top, glyphCount } : undefined;
}

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
  for (const component of scene.components) {
    if (component.draft) diagnostics.push({ code: "draft-placeholder", severity: "warning", pageId: scene.pageId, componentId: component.id,
      message: "Component still uses generated draft artwork.", evidence: { draft: true } });
    if (component.chart && component.artworkScale && component.artworkScale.some(value => Math.abs(value - 1) > 1e-6))
      diagnostics.push({ code: "chart-scale", severity: "warning", pageId: scene.pageId, componentId: component.id,
        message: "Chart artwork is scaled; review pixel-unit visual details.", evidence: { scaleX: component.artworkScale[0], scaleY: component.artworkScale[1] } });
  }
  return diagnostics;
}
