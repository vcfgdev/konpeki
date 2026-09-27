import type * as Contract from "./types.ts";

export const gridSchema = "konpeki-composition/v2" as const;
export const typeSteps = ["fine", "caption", "body", "lead", "heading", "title", "display"] as const;
export type TypeStep = typeof typeSteps[number];
export const roleSteps: Record<Contract.TextRole, TypeStep> = {
  title: "title", subtitle: "lead", body: "body", caption: "caption", footnote: "fine",
};

// Fixed baseline rows keep a bounded page deterministic before fonts load. All
// dimensions live here, never in authored component placement.
// Type sizes and default line heights are hand-tuned in page pixels. Leading
// need not consume a whole layout row; explicit overrides still use baseline units.
export const gridPresets = {
  presentation: { width: 1920, height: 1080, columns: 12, gutter: 24, margin: 72, baseline: 12, scale: [20, 24, 28, 36, 44, 60, 76], lineHeights: [28, 32, 40, 46, 52, 68, 84] },
  portrait: { width: 1080, height: 1350, columns: 6, gutter: 24, margin: 60, baseline: 12, scale: [18, 22, 28, 34, 44, 60, 76], lineHeights: [24, 28, 36, 44, 52, 68, 84] },
  link: { width: 1200, height: 630, columns: 4, gutter: 24, margin: 48, baseline: 8, scale: [16, 20, 24, 30, 40, 52, 64], lineHeights: [20, 24, 32, 36, 48, 60, 72] },
  square: { width: 1080, height: 1080, columns: 6, gutter: 24, margin: 60, baseline: 12, scale: [18, 22, 28, 34, 44, 60, 76], lineHeights: [24, 28, 36, 44, 52, 68, 84] },
  article: { width: 1600, height: 600, columns: 8, gutter: 24, margin: 48, baseline: 8, scale: [18, 22, 28, 34, 44, 56, 72], lineHeights: [24, 28, 36, 44, 52, 64, 80] },
  // The original gallery briefs specify these two additional destinations.
  explainer: { width: 1200, height: 1600, columns: 6, gutter: 24, margin: 60, baseline: 12, scale: [20, 24, 28, 36, 44, 60, 76], lineHeights: [28, 32, 40, 46, 52, 68, 84] },
  gallery: { width: 1600, height: 1000, columns: 12, gutter: 24, margin: 64, baseline: 12, scale: [20, 24, 28, 34, 44, 56, 72], lineHeights: [24, 32, 36, 44, 52, 64, 80] },
} as const;
export type GridPreset = keyof typeof gridPresets;
export type PageGrid = { preset: GridPreset };
export type GridArea = { column: number | "center"; span: number; row: number | "center"; rows: number };
export type NumericGridArea = GridArea & { column: number; row: number };
export type GridGroup = Contract.ManipulationGroup & { area?: GridArea; verticalAlignment?: Contract.Alignment };
export type GridPlacement = { area: GridArea; layer?: "background" | "overlay"; padding?: number };
type OnGrid<C> = C extends Contract.CompositionComponent
  ? Omit<C, "preferredRect" | "textStyle" | "customVisual"> & GridPlacement &
    { customVisual?: Extract<Contract.CustomVisual, { format: "vector" }> } &
    (C extends Contract.TextBlockComponent ? { textStyle?: Omit<NonNullable<C["textStyle"]>, "size" | "lineHeight"> & { step?: TypeStep; leading?: number } } : {})
  : never;
export type GridComponent = OnGrid<Contract.CompositionComponent>;
export type GridSlide = Omit<Contract.CompositionSlide, "canvas" | "innerPadding" | "components" | "groups"> & {
  grid: PageGrid;
  components: GridComponent[];
  groups: GridGroup[];
};
export type GridDocument = Omit<Contract.CompositionDocument, "slides"> & { slides: GridSlide[] };
export type WireDocument = GridDocument;

// Derived geometry exists only in memory for selection, thumbnails and legacy
// drawing code. The scene owns layout; toComposition removes derived fields.
export type ResolvedComponent = Contract.CompositionComponent & Partial<GridPlacement> & {
  textStyle?: Contract.TextBlockComponent["textStyle"] & { step?: TypeStep; leading?: number };
};
export type ResolvedSlide = Omit<Contract.CompositionSlide, "components" | "groups"> & {
  grid?: PageGrid;
  components: ResolvedComponent[];
  groups: GridGroup[];
};
export type ResolvedDocument = Omit<Contract.CompositionDocument, "slides"> & {
  slides: ResolvedSlide[];
};

export function gridMetrics(grid: PageGrid) {
  const p = gridPresets[grid.preset];
  const width = p.width - p.margin * 2;
  const rows = Math.floor((p.height - p.margin * 2) / p.baseline);
  return { ...p, rows, marginY: (p.height - rows * p.baseline) / 2, columnWidth: (width - p.gutter * (p.columns - 1)) / p.columns };
}
export function typeSize(grid: PageGrid, step: TypeStep) {
  return gridPresets[grid.preset].scale[typeSteps.indexOf(step)];
}
export function areaIssue(grid: PageGrid, area: GridArea): string | undefined {
  const p = gridMetrics(grid);
  for (const [position, span, count] of [["column", "span", p.columns], ["row", "rows", p.rows]] as const) {
    if (area[span] > count || typeof area[position] === "number" && area[position] + area[span] - 1 > count)
      return "Area exceeds grid; recompose for this destination";
    if (area[position] === "center" && (count - area[span]) % 2 !== 0) {
      const nearest = [area[span] - 1, area[span] + 1].filter(value => value >= 1 && value <= count);
      return `Cannot center ${span} ${area[span]} on ${count} ${position}s; use ${span} ${nearest.join(" or ")}`;
    }
  }
}
export function resolveArea(grid: PageGrid, area: GridArea): NumericGridArea {
  const issue = areaIssue(grid, area);
  if (issue) throw new Error(issue);
  const p = gridMetrics(grid);
  return { ...area, column: area.column === "center" ? (p.columns - area.span) / 2 + 1 : area.column,
    row: area.row === "center" ? (p.rows - area.rows) / 2 + 1 : area.row };
}
export function areaRect(grid: PageGrid, area: GridArea): Contract.Rect {
  const p = gridMetrics(grid), resolved = resolveArea(grid, area);
  return {
    x: p.margin + (resolved.column - 1) * (p.columnWidth + p.gutter),
    y: p.marginY + (resolved.row - 1) * p.baseline,
    width: area.span * (p.columnWidth + p.gutter) - p.gutter,
    height: area.rows * p.baseline,
  };
}
export function snapArea(grid: PageGrid, rect: Contract.Rect): NumericGridArea {
  const p = gridMetrics(grid);
  const clamp = (n: number, max: number) => Math.max(1, Math.min(max, Math.round(n)));
  const span = clamp((rect.width + p.gutter) / (p.columnWidth + p.gutter), p.columns);
  const rows = clamp(rect.height / p.baseline, p.rows);
  return {
    column: clamp((rect.x - p.margin) / (p.columnWidth + p.gutter) + 1, p.columns - span + 1),
    span,
    row: clamp((rect.y - p.marginY) / p.baseline + 1, p.rows - rows + 1),
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
  return { ...slide, canvas: { width: p.width, height: p.height }, innerPadding: { top: p.marginY, right: p.margin, bottom: p.marginY, left: p.margin }, components: slide.components.map(c => resolveComponent(c, slide.grid)) };
}
export function resolveDocument(document: WireDocument): ResolvedDocument {
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
