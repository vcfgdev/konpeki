import {
  canvasPadding,
  canvasSize,
  type CanvasSize,
  type CompositionComponent,
  type CompositionSlide,
  type Rect,
} from "../../composition/types.ts";
import { componentLabels } from "../../composition/document.ts";

export * from "../../composition/document.ts";

export type Guide = { axis: "x" | "y"; value: number };

export function componentInstanceLabel(
  components: CompositionComponent[],
  id: string,
) {
  const component = components.find((item) => item.id === id);
  if (!component) return id;
  const peers = components.filter((item) => item.kind === component.kind);
  if (peers.length === 1) return componentLabels[component.kind];
  return `${componentLabels[component.kind]} ${peers.indexOf(component) + 1}`;
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function alignmentTargets(
  others: Rect[],
  size: CanvasSize,
  padding: CompositionSlide["innerPadding"] = canvasPadding,
) {
  return {
    x: [
      0,
      padding?.left ?? 0,
      size.width / 2,
      size.width - (padding?.right ?? 0),
      size.width,
      ...others.flatMap((rect) => [
        rect.x,
        rect.x + rect.width / 2,
        rect.x + rect.width,
      ]),
    ],
    y: [
      0,
      padding?.top ?? 0,
      size.height / 2,
      size.height - (padding?.bottom ?? 0),
      size.height,
      ...others.flatMap((rect) => [
        rect.y,
        rect.y + rect.height / 2,
        rect.y + rect.height,
      ]),
    ],
  };
}

function closest(points: number[], targets: number[], threshold: number) {
  let match: { delta: number; target: number } | undefined;
  for (const point of points)
    for (const target of targets) {
      const delta = target - point;
      if (
        Math.abs(delta) <= threshold &&
        (!match || Math.abs(delta) < Math.abs(match.delta))
      )
        match = { delta, target };
    }
  return match;
}

export function snapRect(
  rect: Rect,
  others: Rect[],
  threshold = 14,
  bounds: CanvasSize = canvasSize,
  padding?: CompositionSlide["innerPadding"],
): { rect: Rect; guides: Guide[] } {
  const result = {
    ...rect,
    x: clamp(rect.x, 0, bounds.width - rect.width),
    y: clamp(rect.y, 0, bounds.height - rect.height),
  };
  const targets = alignmentTargets(others, bounds, padding);
  const guides: Guide[] = [];
  for (const [axis, size, limit] of [
    ["x", "width", bounds.width],
    ["y", "height", bounds.height],
  ] as const) {
    const points = [
      result[axis],
      result[axis] + result[size] / 2,
      result[axis] + result[size],
    ];
    const match =
      result[axis] <= threshold
        ? { delta: -result[axis], target: 0 }
        : limit - result[axis] - result[size] <= threshold
          ? {
              delta: limit - result[axis] - result[size],
              target: limit,
            }
          : closest(points, targets[axis], threshold);
    if (
      match &&
      result[axis] + match.delta >= 0 &&
      result[axis] + match.delta + result[size] <= limit
    ) {
      result[axis] += match.delta;
      guides.push({ axis, value: match.target });
    }
  }
  return { rect: result, guides };
}

export function snapResizeRect(
  rect: Rect,
  others: Rect[],
  threshold = 14,
  edges: { left?: boolean; top?: boolean; right?: boolean; bottom?: boolean } = {
    right: true,
    bottom: true,
  },
  bounds: CanvasSize = canvasSize,
  padding?: CompositionSlide["innerPadding"],
): { rect: Rect; guides: Guide[] } {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const result = { ...rect };
  if (edges.left) {
    const minimum = Math.min(180, right);
    result.x = clamp(rect.x, 0, right - minimum);
    result.width = right - result.x;
  } else {
    result.width = clamp(
      rect.width,
      Math.min(180, bounds.width - rect.x),
      bounds.width - rect.x,
    );
  }
  if (edges.top) {
    const minimum = Math.min(72, bottom);
    result.y = clamp(rect.y, 0, bottom - minimum);
    result.height = bottom - result.y;
  } else {
    result.height = clamp(
      rect.height,
      Math.min(72, bounds.height - rect.y),
      bounds.height - rect.y,
    );
  }
  const targets = alignmentTargets(others, bounds, padding);
  const guides: Guide[] = [];
  for (const [axis, size, configuredMinimum, limit, leading] of [
    ["x", "width", 180, bounds.width, Boolean(edges.left)],
    ["y", "height", 72, bounds.height, Boolean(edges.top)],
  ] as const) {
    const point = leading ? result[axis] : result[axis] + result[size];
    const minimum = leading
      ? Math.min(configuredMinimum, point + result[size])
      : configuredMinimum;
    const match = closest(
      [point],
      targets[axis].filter((target) =>
        leading
          ? target >= 0 && target <= point + result[size] - minimum
          : target >= result[axis] + minimum && target <= limit,
      ),
      threshold,
    );
    if (match) {
      if (leading) {
        const trailing = result[axis] + result[size];
        result[axis] = match.target;
        result[size] = trailing - match.target;
      } else {
        result[size] = match.target - result[axis];
      }
      guides.push({ axis, value: match.target });
    }
  }
  return { rect: result, guides };
}
