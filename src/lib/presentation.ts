export type PresentationAction = number | "exit" | undefined;

export function presentationAction(
  key: string,
  current: number,
  slideCount: number,
  interactiveTarget = false,
): PresentationAction {
  if (interactiveTarget) return undefined;
  if (key === "Escape") return "exit";
  if (key === "Home") return 0;
  if (key === "End") return Math.max(0, slideCount - 1);
  if (["ArrowRight", "PageDown", " "].includes(key))
    return Math.min(slideCount - 1, current + 1);
  if (["ArrowLeft", "PageUp"].includes(key)) return Math.max(0, current - 1);
  return undefined;
}
