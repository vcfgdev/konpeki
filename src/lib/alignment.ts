export type Guide = { axis: "x" | "y"; value: number };

export function closest(points: number[], targets: number[], threshold: number) {
  let match: { delta: number; target: number } | undefined;
  for (const point of points)
    for (const target of targets) {
      const delta = target - point;
      if (Math.abs(delta) <= threshold && (!match || Math.abs(delta) < Math.abs(match.delta)))
        match = { delta, target };
    }
  return match;
}

/** Visual references only. Never change the dragged coordinates. */
export function referenceGuides(rect: { x: number; y: number; width: number; height: number }, targets: { x: number[]; y: number[] }, threshold = 2): Guide[] {
  return (["x", "y"] as const).flatMap(axis => {
    const size = axis === "x" ? rect.width : rect.height;
    const match = closest([rect[axis], rect[axis] + size / 2, rect[axis] + size], targets[axis], threshold);
    return match ? [{ axis, value: match.target }] : [];
  });
}
