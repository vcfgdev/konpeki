import { gridMetrics, resolveArea, type GridSlide } from "./grid.ts";
import type { FontContext } from "./fonts.ts";
import { itemBounds, textInkBounds, type ScenePage } from "./scene.ts";
import type { Rect } from "./types.ts";

/** Component-level overview; detailed geometry is available through inspectPage.
 * Rounding is for this display only, never for layout or diagnostics. */
export function summarizePage(page: GridSlide, scene: ScenePage) {
  const round = (value: number) => Math.round(value * 100) / 100;
  const box = (rect: Rect) => ({ x: round(rect.x), y: round(rect.y), width: round(rect.width), height: round(rect.height) });
  const grid = gridMetrics(page.grid);
  return {
    pageId: scene.pageId, width: scene.width, height: scene.height,
    grid: { columns: grid.columns, rows: grid.rows },
    components: scene.components.map(component => {
      const authored = page.components.find(item => item.id === component.id)!;
      const items = scene.items.filter(item => item.componentId === component.id);
      return {
        id: component.id, kind: authored.kind, box: box(component.box),
        ...(authored.kind === "text-block" && !authored.customVisual
          ? { textLines: items.filter(item => item.kind === "text").map(item => item.layout.lines.map(line => line.text)) }
          : { artwork: { shapes: items.filter(item => item.kind === "shape").length, labels: items.filter(item => item.kind === "text" && item.label).length } }),
        ...(component.draft ? { draft: true } : {}),
        ...(component.processNodes ? { processNodes: component.processNodes.map(node => ({ ...node, box: box(node.box) })) } : {}),
      };
    }),
    ...(scene.groups?.length ? { groups: scene.groups.map(group => ({
      id: group.id, childIds: page.groups.find(item => item.id === group.id)!.childIds,
      box: box(group.box), bounds: box(group.bounds),
    })) } : {}),
  };
}

/** Read-only, detailed inspection of the scene the writers draw. All rectangles
 * and baselines are in page pixels, before clipping or later paint occlusion.
 * Keep glyph arrays and paths out of the agent's context. */
export function inspectPage(page: GridSlide, scene: ScenePage, fonts: FontContext) {
  const grid = gridMetrics(page.grid);
  return {
    pageId: scene.pageId,
    name: page.name,
    width: scene.width,
    height: scene.height,
    background: scene.background,
    grid: {
      preset: page.grid.preset, revision: page.grid.revision ?? 1,
      columns: grid.columns, rows: grid.rows, columnWidth: grid.columnWidth,
      baseline: grid.baseline, gutter: grid.gutter, marginX: grid.margin, marginY: grid.marginY,
    },
    readingOrder: page.readingOrder,
    paintOrder: page.paintOrder,
    components: scene.components.map(component => {
      const authored = page.components.find(item => item.id === component.id)!;
      return {
        id: component.id, kind: authored.kind,
        area: authored.area, resolvedArea: resolveArea(page.grid, authored.area),
        box: component.box, contentBox: component.contentBox,
        draft: component.draft, artworkScale: component.artworkScale,
        ...(component.processNodes ? { processNodes: component.processNodes } : {}),
      };
    }),
    groups: page.groups.map(group => {
      const resolved = scene.groups?.find(item => item.id === group.id);
      return { ...group, box: resolved?.box ?? null, bounds: resolved?.bounds ?? null };
    }),
    items: scene.items.map((item, paintIndex) => {
      const target = { paintIndex, pageId: item.pageId, componentId: item.componentId, elementId: item.elementId };
      if (item.kind === "shape") return {
        ...target, kind: item.kind, tag: item.tag,
        bounds: itemBounds(item, fonts) ?? null, clip: item.clip ?? null,
      };
      return {
        ...target, kind: item.kind, label: item.label, source: item.source,
        box: item.box, clip: item.clip ?? null, inkBounds: textInkBounds(item, fonts) ?? null,
        fontSize: item.fontSize, lineHeight: item.lineHeight, fontWeight: item.fontWeight,
        color: item.color, opacity: item.opacity,
        lines: item.layout.lines.map(line => ({
          text: line.text, start: line.start, end: line.end,
          box: { x: item.box.x + line.x, y: item.box.y + line.top, width: line.width, height: item.lineHeight },
          baseline: item.box.y + line.baseline,
          inkBounds: textInkBounds({ ...item, layout: { ...item.layout, lines: [line] } }, fonts) ?? null,
          fontIds: [...new Set(line.glyphs.map(glyph => glyph.fontId))],
        })),
      };
    }),
  };
}
