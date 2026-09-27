import type { Rect, VectorElementKind } from "./types.ts";
import type { TextLayout } from "./text-layout.ts";
import type { FontContext } from "./fonts.ts";
import { svgPathBbox } from "svg-path-bbox";

export type SceneTarget = { pageId: string; componentId?: string; elementId?: string };
export type SceneShape = SceneTarget & {
  kind: "shape";
  tag: Exclude<VectorElementKind, "g" | "text" | "tspan">;
  attributes: Record<string, string | number>;
  /** Explicit local-to-page affine transform. Writers never compute fit. */
  transform: [number, number, number, number, number, number];
  clip?: Rect;
};
export type SceneText = SceneTarget & {
  kind: "text";
  source: string;
  box: Rect;
  layout: TextLayout;
  fontSize: number;
  lineHeight: number;
  fontWeight: number;
  color: string;
  opacity: number;
  label: boolean;
  clip?: Rect;
};
export type SceneItem = SceneShape | SceneText;
export type ScenePage = {
  pageId: string;
  width: number;
  height: number;
  background: string;
  items: SceneItem[];
  components: { id: string; box: Rect; contentBox: Rect; draft: boolean; artworkScale?: [number, number]; chart: boolean }[];
  groups?: { id: string; box: Rect; bounds: Rect }[];
};

/** The exact ink bounds produced by HarfBuzz, in page pixels. */
export function textInkBounds(item: SceneText, fonts: FontContext) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity, glyphCount = 0;
  for (const line of item.layout.lines) for (const glyph of line.glyphs) {
    const font = fonts.fonts.get(glyph.fontId);
    const extents = font?.hbFont.glyphExtents(glyph.glyphId);
    if (!font || !extents || !extents.width || !extents.height) continue;
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

/** Group alignment uses text ink and shape geometry, not empty component cells.
 * Strokes use half-width envelopes, not exact cap/miter/dash outlines. */
export function itemBounds(item: SceneItem, fonts: FontContext): Rect | undefined {
  if (item.kind === "text") return item.opacity && item.color !== "none" ? textInkBounds(item, fonts) : undefined;
  const a = item.attributes, n = (key: string) => Number(a[key] ?? 0);
  if (Number(a.opacity ?? 1) === 0) return;
  const fill = item.tag !== "line" && a.fill !== "none" && Number(a["fill-opacity"] ?? 1) > 0;
  const stroke = a.stroke && a.stroke !== "none" && Number(a["stroke-opacity"] ?? 1) > 0 && Number(a["stroke-width"] ?? 1) > 0;
  if (!fill && !stroke) return;
  let bounds: number[];
  switch (item.tag) {
    case "rect": bounds = [n("x"), n("y"), n("x") + n("width"), n("y") + n("height")]; break;
    case "circle": case "ellipse": {
      const rx = n(item.tag === "circle" ? "r" : "rx"), ry = n(item.tag === "circle" ? "r" : "ry");
      bounds = [n("cx") - rx, n("cy") - ry, n("cx") + rx, n("cy") + ry]; break;
    }
    case "line": bounds = [Math.min(n("x1"), n("x2")), Math.min(n("y1"), n("y2")), Math.max(n("x1"), n("x2")), Math.max(n("y1"), n("y2"))]; break;
    case "path": bounds = svgPathBbox(String(a.d ?? "")); break;
    case "polygon": case "polyline": {
      const points = (String(a.points ?? "").match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
      const xs = points.filter((_, i) => i % 2 === 0), ys = points.filter((_, i) => i % 2 === 1);
      bounds = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; break;
    }
  }
  if (!bounds.every(Number.isFinite)) return;
  if (!stroke && (bounds[0] === bounds[2] || bounds[1] === bounds[3])) return;
  // Lowering only emits positive, axis-aligned fit transforms.
  const [sx, , , sy, dx, dy] = item.transform;
  const radius = stroke ? Number(a["stroke-width"] ?? 1) / 2 : 0;
  const px = radius * (a["vector-effect"] === "non-scaling-stroke" ? 1 : sx);
  const py = radius * (a["vector-effect"] === "non-scaling-stroke" ? 1 : sy);
  return { x: bounds[0] * sx + dx - px, y: bounds[1] * sy + dy - py,
    width: (bounds[2] - bounds[0]) * sx + 2 * px, height: (bounds[3] - bounds[1]) * sy + 2 * py };
}
