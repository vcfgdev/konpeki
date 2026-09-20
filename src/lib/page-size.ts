import type { CanvasSize, CompositionSlide } from "../../composition/types.ts";

export const pagePresets = [
  { name: "Presentation", width: 1920, height: 1080, destination: "presentation" },
  { name: "Square post", width: 1080, height: 1080, destination: "social" },
  { name: "Portrait post", width: 1080, height: 1350, destination: "social" },
  { name: "Link preview / OG", width: 1200, height: 630, destination: "social" },
  { name: "Article header", width: 1600, height: 600, destination: "article" },
] as const;

export function pageSizeIssue(slide: CompositionSlide, size: CanvasSize): string | undefined {
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
  return { ...slide, canvas: { width: size.width, height: size.height }, intendedViewingSize: destination };
}
