import type * as Contract from "./types.ts";

export const gridSchema = "konpeki-composition/v2" as const;
export const typeSteps = ["fine", "caption", "body", "lead", "heading", "title", "display"] as const;
export type TypeStep = typeof typeSteps[number];
export const roleSteps: Record<Contract.TextRole, TypeStep> = {
  title: "title", subtitle: "lead", body: "body", caption: "caption", footnote: "fine",
};

// Preset dimensions and typography are defaults, not placement constraints.
// Column/baseline data is retained only to import older grid documents exactly.
export const gridPresets = {
  presentation: { width: 1920, height: 1080, columns: 12, gutter: 24, margin: 72, baseline: 12, scale: [20, 24, 28, 36, 44, 60, 76], lineHeights: [28, 32, 40, 46, 52, 68, 84] },
  portrait: { width: 1080, height: 1350, columns: 6, gutter: 24, margin: 60, baseline: 12, scale: [18, 22, 28, 34, 44, 60, 76], lineHeights: [24, 28, 36, 44, 52, 68, 84] },
  link: { width: 1200, height: 630, columns: 4, gutter: 24, margin: 48, baseline: 8, scale: [16, 20, 24, 30, 40, 52, 64], lineHeights: [20, 24, 32, 36, 48, 60, 72] },
  square: { width: 1080, height: 1080, columns: 6, gutter: 24, margin: 60, baseline: 12, scale: [18, 22, 28, 34, 44, 60, 76], lineHeights: [24, 28, 36, 44, 52, 68, 84] },
  article: { width: 1600, height: 600, columns: 8, gutter: 24, margin: 48, baseline: 8, scale: [18, 22, 28, 34, 44, 56, 72], lineHeights: [24, 28, 36, 44, 52, 64, 80] },
  // CSS pixels at 96 dpi preserve the physical A4 size in the PDF writer.
  // Raster exports round to device pixels; never round the scene dimensions.
  a4: { width: 210 / 25.4 * 96, height: 297 / 25.4 * 96, columns: 6, gutter: 16, margin: 56, baseline: 4, scale: [10, 12, 14, 18, 24, 32, 44], lineHeights: [14, 16, 20, 24, 30, 38, 50] },
  // The original gallery briefs specify these two additional destinations.
  explainer: { width: 1200, height: 1600, columns: 6, gutter: 24, margin: 60, baseline: 12, scale: [20, 24, 28, 36, 44, 60, 76], lineHeights: [28, 32, 40, 46, 52, 68, 84] },
  gallery: { width: 1600, height: 1000, columns: 12, gutter: 24, margin: 64, baseline: 12, scale: [20, 24, 28, 34, 44, 56, 72], lineHeights: [24, 32, 36, 44, 52, 64, 80] },
} as const;
export type GridPreset = keyof typeof gridPresets;
// Omitted revisions keep existing documents on the original column counts.
export type PageGrid = { preset: GridPreset; revision?: 1 | 2 };
export type GridArea = { column: number | "center"; span: number; row: number | "center"; rows: number };
export type NumericGridArea = GridArea & { column: number; row: number };
export type GridGroup = Contract.ManipulationGroup & { rect?: Contract.Rect; area?: GridArea; verticalAlignment?: Contract.Alignment; layout?: "stack"; gap?: number };
export type GridPlacement = {
  rect?: Omit<Contract.Rect, "height"> & { height?: number }; area?: GridArea; layer?: "background" | "overlay"; padding?: number;
  flow?: { gapBefore?: number; offset?: { x: number; y: number } };
};
type OnGrid<C> = C extends Contract.CompositionComponent
  ? Omit<C, "preferredRect" | "textStyle" | "customVisual"> & GridPlacement &
    { customVisual?: Extract<Contract.CustomVisual, { format: "vector" }> } &
    (C extends Contract.TextBlockComponent ? { textStyle?: Omit<NonNullable<C["textStyle"]>, "lineHeight"> & { step?: TypeStep; leading?: number } } : {})
  : never;
export type GridComponent = OnGrid<Contract.CompositionComponent>;
export type GridSlide = Omit<Contract.CompositionSlide, "canvas" | "innerPadding" | "components" | "groups"> & {
  canvas?: Contract.CanvasSize;
  preset?: GridPreset;
  innerPadding?: Contract.CompositionSlide["innerPadding"];
  grid?: PageGrid;
  components: GridComponent[];
  groups: GridGroup[];
};
export type GridDocument = Omit<Contract.CompositionDocument, "pages"> & { pages: GridSlide[] };
export type WireDocument = GridDocument;

// Derived geometry exists only in memory for selection, thumbnails and legacy
// drawing code. The scene owns layout; toComposition removes derived fields.
export type ResolvedComponent = Contract.CompositionComponent & Partial<GridPlacement> & {
  textStyle?: Contract.TextBlockComponent["textStyle"] & { step?: TypeStep; leading?: number };
};
export type ResolvedSlide = Omit<Contract.CompositionSlide, "components" | "groups"> & {
  preset?: GridPreset;
  grid?: PageGrid;
  components: ResolvedComponent[];
  groups: GridGroup[];
};
export type ResolvedDocument = Omit<Contract.CompositionDocument, "pages"> & {
  pages: ResolvedSlide[];
};

export function gridMetrics(grid: PageGrid) {
  const p = gridPresets[grid.preset];
  const width = p.width - p.margin * 2;
  const rows = Math.floor((p.height - p.margin * 2) / p.baseline);
  const columns = p.columns * (grid.revision === 2 ? 2 : 1);
  return { ...p, columns, rows, marginY: (p.height - rows * p.baseline) / 2, columnWidth: (width - p.gutter * (columns - 1)) / columns };
}

export function pageMetrics(page: Pick<GridSlide, "preset" | "grid" | "canvas" | "innerPadding">) {
  const defaults = gridPresets[page.preset ?? page.grid?.preset ?? "presentation"];
  const canvas = page.canvas ?? defaults;
  const margin = page.innerPadding ?? { top: defaults.margin, right: defaults.margin, bottom: defaults.margin, left: defaults.margin };
  return { ...defaults, width: canvas.width, height: canvas.height, margin };
}

export function groupRect(page: GridSlide, group?: GridGroup): Contract.Rect {
  if (group?.rect) return group.rect;
  const p = pageMetrics(page);
  return { x: p.margin.left, y: p.margin.top, width: p.width - p.margin.left - p.margin.right, height: p.height - p.margin.top - p.margin.bottom };
}

/** Import legacy placement without quantization or changing typography. */
export function pixelPage(page: GridSlide): GridSlide {
  if (!page.grid) return page;
  const { grid, ...rest } = page, p = gridMetrics(grid);
  return { ...rest, preset: grid.preset, canvas: { width: p.width, height: p.height },
    innerPadding: { top: p.marginY, right: p.margin, bottom: p.marginY, left: p.margin },
    components: page.components.map(({ area, padding, ...component }) => ({ ...component,
      ...(area ? { rect: areaRect(grid, area) } : {}),
      ...(padding === undefined ? {} : { padding: padding * p.baseline }),
      ...(component.kind === "text-block" && component.textStyle?.leading !== undefined
        ? { textStyle: { ...component.textStyle, leading: component.textStyle.leading * p.baseline } } : {}),
    })),
    groups: page.groups.map(({ area, ...group }) => ({ ...group, ...(area ? { rect: areaRect(grid, area) } : {}) })),
  };
}

export function areaIssue(grid: PageGrid, area: GridArea): string | undefined {
  const p = gridMetrics(grid);
  for (const [position, span, count] of [["column", "span", p.columns], ["row", "rows", p.rows]] as const) {
    // Fractional column coordinates can accumulate floating-point roundoff.
    if (area[span] > count + 1e-9 || typeof area[position] === "number" && area[position] + area[span] - 1 > count + 1e-9)
      return "Area exceeds grid; recompose for this destination";
    if (position === "row" && area[position] === "center" && (count - area[span]) % 2 !== 0) {
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
export function resolveComponent(component: GridComponent, page: GridSlide, flowBox = groupRect(page)): ResolvedComponent {
  // Flow rectangles here are placeholders until fonts load. The scene, never
  // this estimate, owns measured text geometry and editor hit targets.
  const result = { ...component, preferredRect: component.rect ? { ...component.rect, height: component.rect.height ?? 0 } : flowBox } as ResolvedComponent;
  if (component.kind === "text-block" && result.kind === "text-block") {
    const step = component.textStyle?.step ?? roleSteps[component.appearance.role];
    const preset = pageMetrics(page);
    const size = component.textStyle?.size ?? preset.scale[typeSteps.indexOf(step)];
    const height = component.textStyle?.leading ?? (component.textStyle?.size === undefined ? preset.lineHeights[typeSteps.indexOf(step)] : size * 1.4);
    // Keep authored size/leading intact; only lineHeight is derived for legacy UI.
    result.textStyle = { ...component.textStyle, lineHeight: height / size };
  }
  return result;
}
export function resolveSlide(slide: GridSlide): ResolvedSlide {
  const page = pixelPage(slide), p = pageMetrics(page);
  return { ...page, canvas: { width: p.width, height: p.height },
    components: page.components.map(c => resolveComponent(c, page, groupRect(page, page.groups.find(g => g.layout === "stack" && g.childIds.includes(c.id))))) };
}
export function resolveDocument(document: WireDocument): ResolvedDocument {
  return { ...document, pages: document.pages.map(resolveSlide) };
}
export function toGridComponent(component: ResolvedComponent): GridComponent {
  const { preferredRect: _, ...rest } = component;
  if (rest.kind === "text-block" && rest.textStyle) {
    const { lineHeight: _, ...style } = rest.textStyle;
    if (Object.values(style).some(value => value !== undefined)) rest.textStyle = style;
    else delete rest.textStyle;
  }
  return rest as GridComponent;
}
export function toComposition(document: ResolvedDocument): WireDocument {
  return { ...document, schema: gridSchema, pages: document.pages.map(slide => ({
    ...slide, components: slide.components.map(toGridComponent),
  })) };
}

/** An advisory estimate, not a font measurement or a taste score. */
export function lineLengthWarnings(document: GridDocument) {
  return document.pages.map(pixelPage).flatMap(slide => slide.components.flatMap(component => {
    if (component.kind !== "text-block" || component.customVisual || !component.content) return [];
    const step = component.textStyle?.step ?? roleSteps[component.appearance.role];
    const box = component.rect ?? groupRect(slide, slide.groups.find(g => g.childIds.includes(component.id)));
    const width = box.width - 2 * (component.padding ?? 0);
    const capacity = Math.floor(width / ((component.textStyle?.size ?? pageMetrics(slide).scale[typeSteps.indexOf(step)]) * 0.5));
    const characters = Math.min(capacity, Math.max(...component.content.split("\n").map(line => [...line].length)));
    return characters > 75 ? [{ slideId: slide.id, componentId: component.id, characters }] : [];
  }));
}
