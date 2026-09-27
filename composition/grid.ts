import type * as V1 from "./types.ts";

export const gridSchema = "konpeki-composition/v2" as const;
export const typeSteps = ["fine", "caption", "body", "lead", "heading", "title", "display"] as const;
export type TypeStep = typeof typeSteps[number];
export const roleSteps: Record<V1.TextRole, TypeStep> = {
  title: "title", subtitle: "lead", body: "body", caption: "caption", footnote: "fine",
};

// Fixed baseline rows keep a bounded page deterministic before fonts load. All
// dimensions live here, never in authored component placement.
// Type sizes and default line heights are hand-tuned in page pixels. Leading
// need not consume a whole layout row; explicit overrides still use baseline units.
export const gridPresets = {
  presentation: { width: 1920, height: 1080, columns: 12, gutter: 24, margin: 72, baseline: 12, scale: [20, 24, 28, 36, 44, 60, 76], lineHeights: [24, 32, 36, 44, 52, 68, 84] },
  portrait: { width: 1080, height: 1350, columns: 6, gutter: 24, margin: 60, baseline: 12, scale: [18, 22, 28, 34, 44, 60, 76], lineHeights: [24, 28, 36, 44, 52, 68, 84] },
  link: { width: 1200, height: 630, columns: 4, gutter: 24, margin: 48, baseline: 8, scale: [16, 20, 24, 30, 40, 52, 64], lineHeights: [20, 24, 32, 36, 48, 60, 72] },
  square: { width: 1080, height: 1080, columns: 6, gutter: 24, margin: 60, baseline: 12, scale: [18, 22, 28, 34, 44, 60, 76], lineHeights: [24, 28, 36, 44, 52, 68, 84] },
  article: { width: 1600, height: 600, columns: 8, gutter: 24, margin: 48, baseline: 8, scale: [18, 22, 28, 34, 44, 56, 72], lineHeights: [24, 28, 36, 44, 52, 64, 80] },
  // The original gallery briefs specify these two additional destinations.
  explainer: { width: 1200, height: 1600, columns: 6, gutter: 24, margin: 60, baseline: 12, scale: [20, 24, 28, 36, 44, 60, 76], lineHeights: [24, 32, 36, 44, 52, 68, 84] },
  gallery: { width: 1600, height: 1000, columns: 12, gutter: 24, margin: 64, baseline: 12, scale: [20, 24, 28, 34, 44, 56, 72], lineHeights: [24, 32, 36, 44, 52, 64, 80] },
} as const;
export type GridPreset = keyof typeof gridPresets;
export type PageGrid = { preset: GridPreset };
export type GridArea = { column: number; span: number; row: number; rows: number };
export type GridPlacement = { area: GridArea; layer?: "background" | "overlay"; padding?: number };
type OnGrid<C> = C extends V1.CompositionComponent
  ? Omit<C, "preferredRect" | "textStyle"> & GridPlacement &
    (C extends V1.TextBlockComponent ? { textStyle?: Omit<NonNullable<C["textStyle"]>, "size" | "lineHeight"> & { step?: TypeStep; leading?: number } } : {})
  : never;
export type GridComponent = OnGrid<V1.CompositionComponent>;
export type GridSlide = Omit<V1.CompositionSlide, "canvas" | "innerPadding" | "components"> & {
  grid: PageGrid;
  components: GridComponent[];
};
export type GridDocument = Omit<V1.CompositionDocument, "schema" | "slides"> & {
  schema: typeof gridSchema;
  slides: GridSlide[];
};
export type WireDocument = V1.CompositionDocument | GridDocument;

// Derived geometry exists only in memory for selection, thumbnails and legacy
// drawing code. CSS Grid owns v2 layout; toComposition removes derived fields.
export type ResolvedComponent = V1.CompositionComponent & Partial<GridPlacement> & {
  textStyle?: V1.TextBlockComponent["textStyle"] & { step?: TypeStep; leading?: number };
};
export type ResolvedSlide = Omit<V1.CompositionSlide, "components"> & {
  grid?: PageGrid;
  components: ResolvedComponent[];
};
export type ResolvedDocument = Omit<V1.CompositionDocument, "schema" | "slides"> & {
  schema: WireDocument["schema"];
  slides: ResolvedSlide[];
};

export function gridMetrics(grid: PageGrid) {
  const p = gridPresets[grid.preset];
  const width = p.width - p.margin * 2;
  return { ...p, rows: Math.floor((p.height - p.margin * 2) / p.baseline), columnWidth: (width - p.gutter * (p.columns - 1)) / p.columns };
}
export function typeSize(grid: PageGrid, step: TypeStep) {
  return gridPresets[grid.preset].scale[typeSteps.indexOf(step)];
}
export function areaRect(grid: PageGrid, area: GridArea): V1.Rect {
  const p = gridMetrics(grid);
  return {
    x: p.margin + (area.column - 1) * (p.columnWidth + p.gutter),
    y: p.margin + (area.row - 1) * p.baseline,
    width: area.span * (p.columnWidth + p.gutter) - p.gutter,
    height: area.rows * p.baseline,
  };
}
export function snapArea(grid: PageGrid, rect: V1.Rect): GridArea {
  const p = gridMetrics(grid);
  const clamp = (n: number, max: number) => Math.max(1, Math.min(max, Math.round(n)));
  const span = clamp((rect.width + p.gutter) / (p.columnWidth + p.gutter), p.columns);
  const rows = clamp(rect.height / p.baseline, p.rows);
  return {
    column: clamp((rect.x - p.margin) / (p.columnWidth + p.gutter) + 1, p.columns - span + 1),
    span,
    row: clamp((rect.y - p.margin) / p.baseline + 1, p.rows - rows + 1),
    rows,
  };
}
export function resolveComponent(component: GridComponent, grid: PageGrid): ResolvedComponent {
  const result = { ...component, preferredRect: areaRect(grid, component.area) } as ResolvedComponent;
  if (component.kind === "text-block" && result.kind === "text-block") {
    const step = component.textStyle?.step ?? roleSteps[component.appearance.role];
    const size = typeSize(grid, step);
    const preset = gridPresets[grid.preset];
    const height = component.textStyle?.leading === undefined
      ? preset.lineHeights[typeSteps.indexOf(step)] : component.textStyle.leading * preset.baseline;
    result.textStyle = { ...component.textStyle, size, lineHeight: height / size };
  }
  return result;
}
export function resolveSlide(slide: GridSlide): ResolvedSlide {
  const p = gridMetrics(slide.grid);
  return { ...slide, canvas: { width: p.width, height: p.height }, innerPadding: { top: p.margin, right: p.margin, bottom: p.margin, left: p.margin }, components: slide.components.map(c => resolveComponent(c, slide.grid)) };
}
export function resolveDocument(document: WireDocument): ResolvedDocument {
  if (document.schema !== gridSchema) return document;
  return { ...document, slides: document.slides.map(resolveSlide) };
}
export function toGridComponent(component: ResolvedComponent): GridComponent {
  const { preferredRect: _, ...rest } = component;
  if (rest.kind === "text-block" && rest.textStyle) {
    const { size: _, lineHeight: __, ...style } = rest.textStyle;
    if (Object.values(style).some(value => value !== undefined)) rest.textStyle = style;
    else delete rest.textStyle;
  }
  return rest as GridComponent;
}
export function toComposition(document: ResolvedDocument): WireDocument {
  if (document.schema !== gridSchema) return document as V1.CompositionDocument;
  return { ...document, schema: gridSchema, slides: document.slides.map(({ canvas: _, innerPadding: __, ...slide }) => ({
    ...slide, grid: slide.grid!, components: slide.components.map(toGridComponent),
  })) };
}

/** An advisory estimate, not a font measurement or a taste score. */
export function lineLengthWarnings(document: GridDocument) {
  return document.slides.flatMap(slide => slide.components.flatMap(component => {
    if (component.kind !== "text-block" || component.customVisual || !component.content) return [];
    const step = component.textStyle?.step ?? roleSteps[component.appearance.role];
    const width = areaRect(slide.grid, component.area).width - 2 * (component.padding ?? 0) * gridPresets[slide.grid.preset].baseline;
    const capacity = Math.floor(width / (typeSize(slide.grid, step) * 0.5));
    const characters = Math.min(capacity, Math.max(...component.content.split("\n").map(line => [...line].length)));
    return characters > 75 ? [{ slideId: slide.id, componentId: component.id, characters }] : [];
  }));
}
