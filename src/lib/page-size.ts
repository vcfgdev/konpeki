import type { CanvasSize, CompositionSlide } from "../../composition/runtime.ts";
import { areaIssue, gridMetrics, gridPresets, resolveComponent, resolveSlide, toGridComponent, type GridPreset } from "../../composition/grid.ts";

export const pagePresets = [
  { name: "Presentation", width: 1920, height: 1080, destination: "presentation" },
  { name: "Square post", width: 1080, height: 1080, destination: "social" },
  { name: "Portrait post", width: 1080, height: 1350, destination: "social" },
  { name: "Link preview / OG", width: 1200, height: 630, destination: "social" },
  { name: "Article header", width: 1600, height: 600, destination: "article" },
] as const;

export function pageSizeIssue(slide: CompositionSlide, size: CanvasSize): string | undefined {
  if (slide.grid) {
    const preset = (Object.keys(gridPresets) as GridPreset[]).find(key => gridPresets[key].width === size.width && gridPresets[key].height === size.height);
    if (!preset) return "Choose a grid preset for this document.";
    const metrics = gridMetrics({ preset });
    for (const item of [...slide.components, ...slide.groups]) {
      if (!item.area) continue;
      const issue = areaIssue({ preset }, item.area);
      if (issue) return `${issue}. Ask your agent to recompose; nothing has changed.`;
    }
    for (const component of slide.components) {
      const next = resolveComponent(toGridComponent(component), { preset });
      const inset = (next.padding ?? 0) * metrics.baseline * 2;
      if (inset >= next.preferredRect.width || inset >= next.preferredRect.height ||
          (next.kind === "text-block" && next.textStyle!.lineHeight! < 1))
        return "The padding or leading does not fit this preset. Recompose before changing it.";
    }
    return;
  }
  if (![size.width, size.height].every((value) => Number.isInteger(value) && value >= 256 && value <= 4096))
    return "Use whole pixels from 256 to 4096 for each dimension.";
  if (slide.components.some(({ preferredRect: r }) => r.x + r.width > size.width || r.y + r.height > size.height))
    return "Existing content would fall outside this page. Move or resize it first, or ask your agent to adapt the composition. Nothing has changed.";
  const p = slide.innerPadding;
  if (p && (p.left + p.right >= size.width || p.top + p.bottom >= size.height))
    return "The existing content margins do not fit this size. Ask your agent to adapt the margins.";
}

export function resizePage(slide: CompositionSlide, size: CanvasSize, destination: CompositionSlide["intendedViewingSize"] = "custom"): CompositionSlide {
  if (pageSizeIssue(slide, size)) return slide;
  if (slide.grid) {
    const preset = (Object.keys(gridPresets) as GridPreset[]).find(key => gridPresets[key].width === size.width && gridPresets[key].height === size.height)!;
    return resolveSlide({ ...slide, grid: { preset }, intendedViewingSize: destination, components: slide.components.map(toGridComponent) });
  }
  return { ...slide, canvas: { width: size.width, height: size.height }, intendedViewingSize: destination };
}
