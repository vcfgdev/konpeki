import {
  canvasPadding,
  canvasSize,
  compositionSchema,
  type CanvasSize,
  type CompositionComponent,
  type CompositionDocument,
  type CompositionSlide,
  type ContentSlot,
  type Rect,
} from "./types.ts";
import { validateComposition } from "./validate.ts";
import { appearanceOptions } from "./schema.ts";
import { diagramDefinition } from "./visualizations.ts";

export type Draft = CompositionDocument;
export type StoredDraftResult =
  { ok: true; draft: Draft } | { ok: false };
export type ParsedComposition =
  | { ok: true; document: CompositionDocument }
  | { ok: false; message: string };
export const componentLabels = {
  "text-block": "Text block",
  chart: "Chart",
  diagram: "Diagram",
  image: "Image",
  table: "Table",
};
export function defaultAppearance(kind: CompositionComponent["kind"]) {
  const appearance = Object.fromEntries(
    Object.entries(appearanceOptions[kind]).map(([key, options]) => [
      key,
      options[0],
    ]),
  );
  if (kind === "text-block") {
    appearance.role = "body";
    appearance.titleStyle = "plain";
    appearance.purpose = "narrative";
    appearance.treatment = "plain";
  }
  if (kind === "chart") {
    appearance.orientation = "vertical";
    appearance.colorScheme = "accent-with-muted-context";
    appearance.emphasis = "primary";
    appearance.legend = "top";
  }
  if (kind === "diagram") {
    appearance.type = "process";
  }
  if (kind === "table") delete appearance.colorScheme;
  return appearance;
}
const defaultRects: Record<CompositionComponent["kind"], Rect> = {
  "text-block": { x: canvasPadding.left, y: 280, width: 560, height: 420 },
  chart: { x: canvasPadding.left, y: 280, width: 1080, height: 530 },
  diagram: {
    x: canvasPadding.left,
    y: 320,
    width: canvasSize.width - canvasPadding.left - canvasPadding.right,
    height: 420,
  },
  image: { x: canvasPadding.left, y: 260, width: 880, height: 540 },
  table: { x: canvasPadding.left, y: 280, width: 1080, height: 530 },
};
const instructions = {
  "text-block": "Explain the supporting idea in concise language.",
  chart: "Show the data evidence that supports the takeaway.",
  diagram: "Show the entities or sequence and their relationships.",
  image: "Describe the image to use and its purpose.",
  table: "Describe the comparison, exact cell values, and reading order for the table.",
};
function isFootnoteText(component: CompositionComponent) {
  return component.kind === "text-block" && component.appearance.role === "footnote";
}
function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
export function createComponent(
  kind: CompositionComponent["kind"],
  index: number,
  at?: { x: number; y: number },
  size: CanvasSize = canvasSize,
): CompositionComponent {
  const id = `${kind}-${index}`;
  const original = defaultRects[kind];
  const scale = Math.min(1, size.width / canvasSize.width, size.height / canvasSize.height);
  const rect = { x: original.x * scale, y: original.y * scale, width: original.width * scale, height: original.height * scale };
  const preferredRect = at
    ? {
        ...rect,
        x: clamp(at.x - rect.width / 2, 0, size.width - rect.width),
        y: clamp(at.y - 60, 0, size.height - rect.height),
      }
    : { ...rect };
  const appearance = defaultAppearance(kind);
  return {
    id,
    kind,
    preferredRect,
    slotIds: [`${id}-content`],
    intent: instructions[kind],
    ...(kind === "text-block" ? { content: "Text", textStyle: { size: 36, weight: 400, lineHeight: 1.4, color: "ink", font: "body" } } : {}),
    appearance,
  } as CompositionComponent;
}
function createStarterSlide(index = 1): CompositionSlide {
  const components = (["text-block", "chart", "text-block", "text-block"] as const)
    .map((kind, index) => createComponent(kind, index + 1));
  const title = components[0];
  if (title.kind === "text-block") {
    title.preferredRect = {
      x: canvasPadding.left,
      y: canvasPadding.top,
      width: canvasSize.width - canvasPadding.left - canvasPadding.right,
      height: 88,
    };
    title.intent = "State the decision or takeaway.";
    title.appearance = {
      ...title.appearance,
      role: "title",
      titleStyle: "prominent",
      rule: "bottom",
    };
  }
  const emphasis = components[2];
  if (emphasis.kind === "text-block") {
    emphasis.preferredRect.x = 1248;
    emphasis.intent = "Explain the implication or recommended action.";
    emphasis.appearance = {
      ...emphasis.appearance,
      purpose: "emphasis",
      treatment: "strong",
    };
  }
  const footnote = components[3];
  if (footnote.kind === "text-block") {
    footnote.preferredRect = {
      x: canvasPadding.left,
      y: canvasSize.height - canvasPadding.bottom - 88,
      width: canvasSize.width - canvasPadding.left - canvasPadding.right,
      height: 88,
    };
    footnote.intent = "Add the source, scope, and any important caveat.";
    footnote.appearance = {
      ...footnote.appearance,
      role: "footnote",
      rule: "top",
    };
  }
  const contentSlots = components.flatMap(createContentSlots).map((slot) =>
    slot.role === "source"
      ? {
          ...slot,
          targets: components
            .filter((component) => !isFootnoteText(component))
            .map((component) => component.id),
        }
      : slot,
  );
  return {
    id: `slide-${index}`,
    name: `Slide ${String(index).padStart(2, "0")}`,
    canvas: canvasSize,
    innerPadding: canvasPadding,
    pageNumber: { style: "none", color: "muted" },
    audience: "Decision makers",
    question: "What should the audience understand or decide?",
    intendedViewingSize: "presentation",
    contentSlots,
    components,
    groups: [],
    readingOrder: components.map((component) => ({
      kind: "component",
      id: component.id,
    })),
    paintOrder: components.map((component) => component.id),
    relationships: [],
  };
}
export function createBlankSlide(index = 1, size: CanvasSize = canvasSize): CompositionSlide {
  return {
    id: `slide-${index}`,
    name: `Page ${String(index).padStart(2, "0")}`,
    canvas: { width: size.width, height: size.height },
    innerPadding: canvasPadding,
    pageNumber: { style: "none", color: "muted" },
    audience: "Decision makers",
    question: "What should the audience understand or decide?",
    intendedViewingSize: "presentation",
    contentSlots: [],
    components: [],
    groups: [],
    readingOrder: [],
    paintOrder: [],
    relationships: [],
  };
}
export function initialDraft(empty = false): Draft {
  return {
    schema: compositionSchema,
    title: "Untitled composition",
    theme: { id: "plex", mode: "paper" },
    slides: [empty ? createBlankSlide() : createStarterSlide()],
  };
}
export function getSlide(draft: Draft, id = draft.slides[0]?.id) {
  const slide = draft.slides.find((item) => item.id === id);
  if (!slide) throw new Error(`Unknown slide: ${id}`);
  return slide;
}
export function addSlide(draft: Draft): { draft: Draft; slideId: string } {
  const used = new Set(draft.slides.map((slide) => slide.id));
  let index = draft.slides.length + 1;
  while (used.has(`slide-${index}`)) index += 1;
  const slide = createBlankSlide(index);
  const next = { ...draft, slides: [...draft.slides, slide] };
  const validated = validMutation(draft, next);
  if (validated === draft) return { draft, slideId: "" };
  return {
    draft: validated,
    slideId: slide.id,
  };
}
export function removeSlide(draft: Draft, slideId: string): Draft {
  if (draft.slides.length === 1) return draft;
  const next = {
    ...draft,
    slides: draft.slides.filter((slide) => slide.id !== slideId),
  };
  if (next.slides.length === draft.slides.length) return draft;
  return validMutation(draft, next);
}
export function createContentSlots(
  component: CompositionComponent,
): ContentSlot[] {
  return component.slotIds.map((id, index): ContentSlot => {
    const base = {
      id,
      label: componentLabels[component.kind] + (index ? ` ${index + 1}` : ""),
      required: true,
      instruction: component.intent?.trim() || instructions[component.kind],
    };
    if (isFootnoteText(component))
      return { ...base, role: "source", targets: [] };
    const roles = {
      chart: "evidence",
      diagram:
        component.kind === "diagram"
          ? diagramDefinition(component.appearance.type).slotRole
          : "entity",
      "text-block": component.kind === "text-block" && component.appearance.role === "title"
        ? "takeaway"
        : "body",
      image: "image",
      table: "table",
    } as const;
    return { ...base, role: roles[component.kind] };
  });
}
function uniqueId(base: string, used: Set<string>) {
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}
function offsetRect(rect: Rect, size: CanvasSize) {
  const maximumX = size.width - rect.width;
  const maximumY = size.height - rect.height;
  const x = rect.x + 48 <= maximumX ? rect.x + 48 : Math.max(0, rect.x - 48);
  const y = rect.y + 48 <= maximumY ? rect.y + 48 : Math.max(0, rect.y - 48);
  return { ...rect, x, y };
}
export function transformComponentRect(
  component: CompositionComponent,
  previousRect: Rect,
  nextRect: Rect,
): CompositionComponent {
  const next = structuredClone(component);
  next.preferredRect = { ...nextRect };
  if ((next.kind !== "diagram" && next.kind !== "chart") || !next.topology) return next;
  const scaleX = nextRect.width / previousRect.width;
  const scaleY = nextRect.height / previousRect.height;
  next.topology.nodes = next.topology.nodes.map((node) => {
    if (!node.preferredRect) return node;
    return {
      ...node,
      preferredRect: {
        x: nextRect.x + (node.preferredRect.x - previousRect.x) * scaleX,
        y: nextRect.y + (node.preferredRect.y - previousRect.y) * scaleY,
        width: node.preferredRect.width * scaleX,
        height: node.preferredRect.height * scaleY,
      },
    };
  });
  return next;
}
function validMutation(draft: Draft, next: Draft) {
  const candidate = next.title.trim()
    ? next
    : { ...next, title: "Untitled composition" };
  return validateComposition(candidate).ok ? next : draft;
}
export function addComponent(
  draft: Draft,
  kind: CompositionComponent["kind"],
  at?: { x: number; y: number },
  slideId?: string,
): Draft {
  const slide = getSlide(draft, slideId);
  let index =
    Math.max(
      0,
      ...slide.components.map((c) =>
        Number(c.id.match(/-(\d+)$/)?.[1] ?? 0),
      ),
    ) + 1;
  const usedIds = new Set([
    ...slide.components.map((component) => component.id),
    ...slide.contentSlots.map((slot) => slot.id),
    ...slide.groups.map((group) => group.id),
  ]);
  while (
    usedIds.has(`${kind}-${index}`) ||
    usedIds.has(`${kind}-${index}-content`)
  )
    index += 1;
  const component = createComponent(kind, index, at, slide.canvas);
  const previous = [...slide.components]
    .reverse()
    .find((item) =>
      item.kind === kind &&
      (item.kind !== "text-block" ||
        component.kind !== "text-block" ||
        item.appearance.role === component.appearance.role),
    );
  if (!at && previous)
    component.preferredRect = offsetRect(previous.preferredRect, slide.canvas);
  const readingOrder = [...slide.readingOrder];
  readingOrder.push({ kind: "component", id: component.id });
  const contentSlots = [
    ...slide.contentSlots,
    ...createContentSlots(component).map((slot) =>
      slot.role === "source"
        ? {
            ...slot,
            targets: slide.components
              .filter((item) => !isFootnoteText(item))
              .map((item) => item.id),
          }
        : slot,
    ),
  ];
  const next = {
    ...draft,
    slides: draft.slides.map((item) =>
      item.id === slide.id
        ? {
            ...item,
            contentSlots,
            components: [...item.components, component],
            readingOrder,
            paintOrder: [...item.paintOrder, component.id],
          }
        : item,
    ),
  };
  return validMutation(draft, next);
}
export function componentRemovalIssue(draft: Draft, id: string, slideId?: string) {
  const slide = getSlide(draft, slideId);
  const removed = slide.components.find((component) => component.id === id);
  if (!removed) return "Component not found.";
  const survivingOwners = new Set(
    slide.components
      .filter((component) => component.id !== id)
      .flatMap((component) => component.slotIds),
  );
  const orphanedSlots = new Set(
    removed.slotIds.filter((slotId) => !survivingOwners.has(slotId)),
  );
  const blockedReference = slide.contentSlots.find(
    (slot) =>
      "targets" in slot &&
      !orphanedSlots.has(slot.id) &&
      slot.targets.filter(
        (target) => target !== id && !orphanedSlots.has(target),
      ).length === 0,
  );
  return blockedReference
    ? `Cannot delete while “${blockedReference.label}” only targets this component.`
    : undefined;
}
export function removeComponent(draft: Draft, id: string, slideId?: string): Draft {
  const slide = getSlide(draft, slideId);
  const removed = slide.components.find((component) => component.id === id);
  if (!removed || componentRemovalIssue(draft, id, slide.id)) return draft;
  const survivingSlots = new Set(
    slide.components
      .filter((component) => component.id !== id)
      .flatMap((component) => component.slotIds),
  );
  const removedSlots = new Set(
    removed.slotIds.filter((slotId) => !survivingSlots.has(slotId)),
  );
  const groups = slide.groups
    .map((group) => ({
      ...group,
      childIds: group.childIds.filter((childId) => childId !== id),
    }))
    .filter((group) => group.childIds.length);
  const groupIds = new Set(groups.map((group) => group.id));
  const next = {
    ...draft,
    slides: draft.slides.map((item) =>
      item.id === slide.id
        ? {
            ...item,
            contentSlots: item.contentSlots
              .filter((slot) => !removedSlots.has(slot.id))
              .map((slot) =>
                "targets" in slot
                  ? {
                      ...slot,
                      targets: slot.targets.filter(
                        (target) =>
                          target !== id && !removedSlots.has(target),
                      ),
                    }
                  : slot,
              ),
            components: item.components.filter((c) => c.id !== id),
            groups,
            readingOrder: item.readingOrder.filter((entry) =>
              entry.kind === "component"
                ? entry.id !== id
                : groupIds.has(entry.id),
            ),
            paintOrder: item.paintOrder.filter((item) => item !== id),
            relationships: item.relationships.filter(
              (link) => link.from.nodeId !== id && link.to.nodeId !== id,
            ),
          }
        : item,
    ),
  };
  return validMutation(draft, next);
}
export function reorderPaintOrder(
  draft: Draft,
  paintOrder: string[],
  slideId?: string,
): Draft {
  const slide = getSlide(draft, slideId);
  if (
    paintOrder.length !== slide.components.length ||
    new Set(paintOrder).size !== paintOrder.length ||
    paintOrder.some((id) => !slide.components.some((component) => component.id === id))
  )
    return draft;
  return validMutation(draft, {
    ...draft,
    slides: draft.slides.map((item) =>
      item.id === slide.id ? { ...item, paintOrder: [...paintOrder] } : item,
    ),
  });
}
export function duplicateComponent(draft: Draft, id: string, slideId?: string): Draft {
  const slide = getSlide(draft, slideId);
  const source = slide.components.find((component) => component.id === id);
  if (!source) return draft;
  const used = new Set([
    ...slide.components.map((component) => component.id),
    ...slide.contentSlots.map((slot) => slot.id),
    ...slide.groups.map((group) => group.id),
  ]);
  const componentId = uniqueId(`${source.id}-copy`, used);
  used.add(componentId);
  const slotIds = source.slotIds.map((_, index) => {
    const slotId = uniqueId(`${componentId}-content${index ? `-${index + 1}` : ""}`, used);
    used.add(slotId);
    return slotId;
  });
  const slotMap = new Map(source.slotIds.map((slotId, index) => [slotId, slotIds[index]]));
  const preferredRect = offsetRect(source.preferredRect, slide.canvas);
  const component = transformComponentRect(
    source,
    source.preferredRect,
    preferredRect,
  );
  component.id = componentId;
  component.slotIds = slotIds;
  if ((component.kind === "diagram" || component.kind === "chart") && component.topology)
    component.topology.nodes = component.topology.nodes.map((node) => ({
      ...node,
      slotId: slotMap.get(node.slotId) ?? node.slotId,
    }));
  const sourceSlots = new Map(
    slide.contentSlots.map((slot) => [slot.id, slot]),
  );
  const contentSlots = source.slotIds.map((slotId, index) => {
    const slot = structuredClone(sourceSlots.get(slotId)!);
    slot.id = slotIds[index];
    if ("targets" in slot)
      slot.targets = slot.targets.map((target) =>
        target === source.id ? componentId : slotMap.get(target) ?? target,
      );
    return slot;
  });
  const allSlots = slide.contentSlots.map((slot) =>
    slot.role === "source" && slot.targets.includes(source.id)
      ? {
          ...slot,
          targets: slot.targets.flatMap((target) =>
            target === source.id ? [target, componentId] : [target],
          ),
        }
      : slot,
  );
  const slotInsert = Math.max(
    ...source.slotIds.map((slotId) => allSlots.findIndex((slot) => slot.id === slotId)),
  );
  allSlots.splice(slotInsert + 1, 0, ...contentSlots);
  const components = [...slide.components];
  components.splice(components.indexOf(source) + 1, 0, component);
  const groups = slide.groups.map((group) => {
    const sourceIndex = group.childIds.indexOf(id);
    if (sourceIndex < 0) return group;
    const childIds = [...group.childIds];
    childIds.splice(sourceIndex + 1, 0, componentId);
    return { ...group, childIds };
  });
  const readingOrder = [...slide.readingOrder];
  const sourceIndex = readingOrder.findIndex(
    (entry) => entry.kind === "component" && entry.id === id,
  );
  if (sourceIndex >= 0) {
    readingOrder.splice(sourceIndex + 1, 0, {
      kind: "component",
      id: componentId,
    });
  }
  const paintOrder = [...slide.paintOrder];
  paintOrder.splice(paintOrder.indexOf(id) + 1, 0, componentId);
  const next = {
    ...draft,
    slides: draft.slides.map((item) =>
      item.id === slide.id
        ? {
            ...item,
            contentSlots: allSlots,
            components,
            groups,
            readingOrder,
            paintOrder,
          }
        : item,
    ),
  };
  return validMutation(draft, next);
}
export function serializeDraft(draft: Draft) {
  return JSON.stringify({ version: 2, document: draft });
}
export function parseStoredDraft(raw: string): StoredDraftResult {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version === 2) {
      const document = parsed.document as CompositionDocument;
      if (typeof document?.title !== "string") return { ok: false };
      const candidate = {
        ...document,
        title: document.title.trim() || "Untitled composition",
      };
      const result = validateComposition(candidate);
      if (!result.ok) return { ok: false };
      return {
        ok: true,
        draft: { ...result.document, title: document.title },
      };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}
export function parseCompositionJSON(raw: string): ParsedComposition {
  try {
    const input: unknown = JSON.parse(raw);
    const result = validateComposition(input);
    if (result.ok) return { ok: true, document: result.document };
    const issue = result.issues[0];
    return {
      ok: false,
      message: `${issue?.path || "Document"}: ${issue?.message || "Invalid composition"}`,
    };
  } catch {
    return { ok: false, message: "The selected file is not valid JSON." };
  }
}
