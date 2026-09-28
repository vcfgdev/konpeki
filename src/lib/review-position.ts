import type { Rect } from "../../composition/runtime.ts";

/** Fixed viewport coordinates; the caller measures the already-zoomed target. */
export function reviewPosition(anchor: Rect, panel: Pick<Rect, "width" | "height">, viewport: Rect) {
  const margin = 16, gap = 12;
  const minX = viewport.x + margin, minY = viewport.y + margin;
  const maxX = Math.max(minX, viewport.x + viewport.width - margin - panel.width);
  const maxY = Math.max(minY, viewport.y + viewport.height - margin - panel.height);
  const left = Math.max(minX, Math.min(anchor.x, maxX));
  const top = Math.max(minY, Math.min(anchor.y, maxY));
  const candidates = [
    { left, top: anchor.y + anchor.height + gap },
    { left, top: anchor.y - gap - panel.height },
    { left: anchor.x + anchor.width + gap, top },
    { left: anchor.x - gap - panel.width, top },
  ];
  return candidates.find(p => p.left >= minX && p.left <= maxX && p.top >= minY && p.top <= maxY)
    ?? { left, top: Math.max(minY, Math.min(candidates[0].top, maxY)) };
}
