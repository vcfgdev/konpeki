import { Ajv2020 } from "ajv/dist/2020.js";
import { schema } from "./schema.ts";
import { migrateLegacyDiagramType } from "./visualizations.ts";
import {
  compositionSchema,
  legacyCompositionSchemas,
  type CompositionDocument,
} from "./types.ts";
import { vectorAttributeNames } from "./vector.ts";
import { validThemeBinding } from "./theme-tokens.ts";

export type ValidationIssue = { path: string; message: string };
export type ValidationResult =
  | { ok: true; document: CompositionDocument }
  | { ok: false; issues: ValidationIssue[] };
const structural = new Ajv2020({
  allErrors: true,
  strict: false,
}).compile<CompositionDocument>(schema);
function migratePreV5Document(input: Record<string, unknown>) {
  const slide = input.slide as Record<string, unknown> | undefined;
  const components = Array.isArray(slide?.components)
    ? slide.components.map((value: unknown) => {
        if (!value || typeof value !== "object") return value;
        const component = value as Record<string, unknown>;
        if (
          component.kind !== "callout" &&
          component.kind !== "comparison" &&
          component.kind !== "text-block"
        )
          return component;
        const previous =
          component.appearance && typeof component.appearance === "object"
            ? (component.appearance as Record<string, unknown>)
            : {};
        const common = Object.fromEntries(
          ["alignment", "border", "titleStyle", "rule"].flatMap((key) =>
            key in previous ? [[key, previous[key]]] : [],
          ),
        );
        const appearance =
          component.kind === "callout"
            ? {
                ...common,
                layout: "single",
                orientation: "horizontal",
                purpose: "emphasis",
                treatment: "strong",
              }
            : component.kind === "comparison"
              ? {
                  ...common,
                  layout: "two-column",
                  orientation: "horizontal",
                  purpose: "comparison",
                  treatment: "plain",
                }
              : {
                  ...previous,
                  purpose: previous.purpose ?? "narrative",
                  treatment: previous.treatment ?? "plain",
                };
        return { ...component, kind: "text-block", appearance };
      })
    : slide?.components;
  return {
    ...Object.fromEntries(
      Object.entries(input).filter(
        ([key]) => key !== "target" && key !== "slide",
      ),
    ),
    schema: "konpeki-composition/v5",
    ...(slide
      ? { slides: [{ ...slide, name: "Slide 01", components }] }
      : {}),
  };
}
function migrateV5Document(input: Record<string, unknown>) {
  const slides = Array.isArray(input.slides)
    ? input.slides.map((value: unknown) => {
        if (!value || typeof value !== "object") return value;
        const slide = value as Record<string, unknown>;
        const previousComponents = Array.isArray(slide.components)
          ? (slide.components as Record<string, unknown>[])
          : [];
        const pageNumber = previousComponents.find(
          (component) => component.kind === "page-number",
        );
        const pageAppearance =
          pageNumber?.appearance && typeof pageNumber.appearance === "object"
            ? (pageNumber.appearance as Record<string, unknown>)
            : {};
        const removedIds = new Set(
          previousComponents
            .filter((component) => component.kind === "page-number")
            .map((component) => String(component.id)),
        );
        const removedSlots = new Set(
          previousComponents
            .filter((component) => component.kind === "page-number")
            .flatMap((component) =>
              Array.isArray(component.slotIds)
                ? component.slotIds.map(String)
                : [],
            ),
        );
        const components = previousComponents.flatMap((component) => {
          const appearance =
            component.appearance && typeof component.appearance === "object"
              ? (component.appearance as Record<string, unknown>)
              : {};
          if (component.kind === "page-number") return [];
          if (component.kind === "evidence")
            return [{ ...component, kind: "visual" }];
          if (component.kind === "process")
            return [
              {
                ...component,
                kind: "diagram",
                appearance: { ...appearance, type: "process" },
              },
            ];
          if (component.kind === "system-map")
            return [
              {
                ...component,
                kind: "diagram",
                appearance: { ...appearance, type: "system" },
              },
            ];
          return [component];
        });
        const componentIds = new Set(components.map((component) => String(component.id)));
        const groups = Array.isArray(slide.groups)
          ? (slide.groups as Record<string, unknown>[])
              .map((group) => ({
                ...group,
                childIds: Array.isArray(group.childIds)
                  ? group.childIds.filter((id) => !removedIds.has(String(id)))
                  : group.childIds,
              }))
              .filter(
                (group) =>
                  !Array.isArray(group.childIds) || group.childIds.length > 0,
              )
          : slide.groups;
        const groupIds = new Set(
          Array.isArray(groups)
            ? groups.map((group) => String(group.id))
            : [],
        );
        const contentSlots = Array.isArray(slide.contentSlots)
          ? (slide.contentSlots as Record<string, unknown>[])
              .filter((slot) => !removedSlots.has(String(slot.id)))
              .map((slot) => {
                if (!Array.isArray(slot.targets)) return slot;
                const targets = slot.targets.filter(
                  (target) =>
                    !removedIds.has(String(target)) &&
                    !removedSlots.has(String(target)),
                );
                return {
                  ...slot,
                  targets: targets.length
                    ? targets
                    : [String(components[0]?.id ?? "")],
                };
              })
          : slide.contentSlots;
        return {
          ...slide,
          pageNumber: {
            style: pageNumber ? (pageAppearance.style ?? "01") : "none",
            color: pageAppearance.color ?? "muted",
          },
          components,
          contentSlots,
          groups,
          readingOrder: Array.isArray(slide.readingOrder)
            ? (slide.readingOrder as Record<string, unknown>[]).filter((entry) =>
                entry.kind === "group"
                  ? groupIds.has(String(entry.id))
                  : componentIds.has(String(entry.id)),
              )
            : slide.readingOrder,
          paintOrder: Array.isArray(slide.paintOrder)
            ? slide.paintOrder.filter((id) => !removedIds.has(String(id)))
            : slide.paintOrder,
          relationships: Array.isArray(slide.relationships)
            ? (slide.relationships as Record<string, unknown>[]).filter(
                (relationship) => {
                  const from = relationship.from as Record<string, unknown> | undefined;
                  const to = relationship.to as Record<string, unknown> | undefined;
                  return (
                    !removedIds.has(String(from?.nodeId)) &&
                    !removedIds.has(String(to?.nodeId))
                  );
                },
              )
            : slide.relationships,
        };
      })
    : input.slides;
  return { ...input, schema: compositionSchema, slides };
}
function migrateV7Document(input: Record<string, unknown>) {
  const slides = Array.isArray(input.slides)
    ? input.slides.map((value: unknown) => {
        if (!value || typeof value !== "object") return value;
        const slide = value as Record<string, unknown>;
        const components = Array.isArray(slide.components)
          ? slide.components.map((value: unknown) => {
              if (!value || typeof value !== "object") return value;
              const component = value as Record<string, unknown>;
              const appearance =
                component.appearance && typeof component.appearance === "object"
                  ? (component.appearance as Record<string, unknown>)
                  : {};
              if (component.kind !== "visual" || appearance.template !== "image")
                return component;
              return {
                ...component,
                kind: "image",
                appearance: {
                  ...(appearance.border ? { border: appearance.border } : {}),
                  fit: "contain",
                },
              };
            })
          : slide.components;
        return { ...slide, components };
      })
    : input.slides;
  return { ...input, schema: compositionSchema, slides };
}
function migrateV10Document(input: Record<string, unknown>) {
  const slides = Array.isArray(input.slides)
    ? input.slides.map((value: unknown) => {
        if (!value || typeof value !== "object") return value;
        const slide = value as Record<string, unknown>;
        const components = Array.isArray(slide.components)
          ? slide.components.map((value: unknown) => {
              if (!value || typeof value !== "object") return value;
              const component = value as Record<string, unknown>;
              const appearance =
                component.appearance && typeof component.appearance === "object"
                  ? (component.appearance as Record<string, unknown>)
                  : {};
              if (component.kind === "headline")
                return {
                  ...component,
                  kind: "text-block",
                  appearance: {
                    ...appearance,
                    role: "title",
                    layout: "single",
                    orientation: "horizontal",
                    purpose: "narrative",
                    treatment: "plain",
                    logicalOrder: "none",
                  },
                };
              if (component.kind === "footnote")
                return {
                  ...component,
                  kind: "text-block",
                  appearance: {
                    ...appearance,
                    role: "footnote",
                    layout: "single",
                    orientation: "horizontal",
                    purpose: "narrative",
                    treatment: "plain",
                    logicalOrder: "none",
                    titleStyle: "plain",
                  },
                };
              if (component.kind === "text-block")
                return {
                  ...component,
                  appearance: { role: "body", ...appearance },
                };
              if (component.kind === "visual")
                return { ...component, kind: "chart" };
              if (component.kind === "diagram") {
                const { template, ...rest } = appearance;
                return {
                  ...component,
                  appearance: {
                    ...rest,
                    layout: template ?? appearance.layout ?? "linear",
                  },
                };
              }
              if (component.kind === "icon" || component.kind === "shape") {
                const slotIds = Array.isArray(component.slotIds)
                  ? component.slotIds.map(String)
                  : [];
                const slotId = slotIds[0] ?? `${String(component.id)}-content`;
                const primitive = component.kind === "icon"
                  ? {
                      kind: "icon" as const,
                      ...(typeof component.intent === "string" && component.intent.trim()
                        ? { name: component.intent.trim() }
                        : {}),
                      ...(appearance.style ? { style: appearance.style } : {}),
                      ...(appearance.color ? { color: appearance.color } : {}),
                    }
                  : {
                      kind: "shape" as const,
                      shape: appearance.shape ?? "rectangle",
                      ...(appearance.color ? { color: appearance.color } : {}),
                      ...(appearance.fill ? { fill: appearance.fill } : {}),
                    };
                return {
                  ...component,
                  kind: "diagram",
                  slotIds: slotIds.length ? slotIds : [slotId],
                  appearance: {
                    type: "system",
                    layout: "hub-and-spoke",
                    border: appearance.border ?? "none",
                    colorScheme: "accent-with-muted-context",
                    emphasis: "primary",
                    density: "sparse",
                  },
                  topology: {
                    kind: "explicit",
                    nodes: (slotIds.length ? slotIds : [slotId]).map(
                      (currentSlotId, index) => ({
                        id: index
                          ? `${String(component.id)}-slot-${index + 1}`
                          : String(component.id),
                        slotId: currentSlotId,
                        ...(index ? { visible: false } : { primitive }),
                        ...(component.preferredRect && typeof component.preferredRect === "object"
                          ? { preferredRect: component.preferredRect }
                          : {}),
                      }),
                    ),
                    edges: [],
                  },
                };
              }
              return component;
            })
          : slide.components;
        const contentSlots = Array.isArray(slide.contentSlots)
          ? slide.contentSlots.map((value: unknown) => {
              if (!value || typeof value !== "object") return value;
              const slot = value as Record<string, unknown>;
              return slot.role === "icon" || slot.role === "shape"
                ? { ...slot, role: "entity" }
                : slot;
            })
          : slide.contentSlots;
        return { ...slide, components, contentSlots };
      })
    : input.slides;
  return { ...input, schema: "konpeki-composition/v11", slides };
}
function migrateV11Document(input: Record<string, unknown>) {
  const slides = Array.isArray(input.slides)
    ? input.slides.map((value: unknown) => {
        if (!value || typeof value !== "object") return value;
        const slide = value as Record<string, unknown>;
        const components = Array.isArray(slide.components)
          ? slide.components.map((value: unknown) => {
              if (!value || typeof value !== "object") return value;
              const component = value as Record<string, unknown>;
              if (component.kind !== "diagram") return component;
              const appearance =
                component.appearance && typeof component.appearance === "object"
                  ? (component.appearance as Record<string, unknown>)
                  : {};
              const migratedType = migrateLegacyDiagramType(
                appearance.type,
                appearance.layout,
              );
              const { layout, ...rest } = appearance;
              return {
                ...component,
                appearance: {
                  ...rest,
                  type: migratedType ?? null,
                },
              };
            })
          : slide.components;
        return { ...slide, components };
      })
    : input.slides;
  return { ...input, schema: compositionSchema, slides };
}
function migrateInterimV12Sankey(input: unknown) {
  if (!input || typeof input !== "object") return input;
  const document = input as Record<string, unknown>;
  if (document.schema !== compositionSchema || !Array.isArray(document.slides))
    return input;
  const slides = document.slides.map((value: unknown) => {
    if (!value || typeof value !== "object") return value;
    const slide = value as Record<string, unknown>;
    if (!Array.isArray(slide.components)) return value;
    const components = slide.components.map((componentValue: unknown) => {
      if (!componentValue || typeof componentValue !== "object") return componentValue;
      const component = componentValue as Record<string, unknown>;
      const appearance = component.appearance && typeof component.appearance === "object"
        ? component.appearance as Record<string, unknown>
        : {};
      if (component.kind !== "diagram" || appearance.type !== "sankey")
        return componentValue;
      const { type: _type, ...sharedAppearance } = appearance;
      return {
        ...component,
        kind: "chart",
        appearance: { ...sharedAppearance, template: "sankey" },
      };
    });
    return { ...slide, components };
  });
  return { ...document, slides };
}
function preserveLegacyVisualizationChoices(input: unknown) {
  if (!input || typeof input !== "object") return input;
  const document = input as Record<string, unknown>;
  if (!Array.isArray(document.slides)) return input;
  return { ...document, slides: document.slides.map((value: unknown) => {
    if (!value || typeof value !== "object") return value;
    const slide = value as Record<string, unknown>;
    if (!Array.isArray(slide.components)) return value;
    return { ...slide, components: slide.components.map((value: unknown) => {
      if (!value || typeof value !== "object") return value;
      const component = value as Record<string, unknown>;
      if ((component.kind !== "diagram" && component.kind !== "chart") || !component.appearance || typeof component.appearance !== "object") return value;
      return { ...component, appearance: { ...component.appearance, selection: "explicit" } };
    }) };
  }) };
}
export function validateComposition(input: unknown): ValidationResult {
  const legacy = Boolean(
    input &&
      typeof input === "object" &&
      "schema" in input &&
      legacyCompositionSchemas.includes(
        input.schema as (typeof legacyCompositionSchemas)[number],
      ),
  );
  const legacyInput = input as Record<string, unknown>;
  const migrated = legacy
    ? ["konpeki-composition/v12", "konpeki-composition/v13", "konpeki-composition/v14", "konpeki-composition/v15", "konpeki-composition/v16", "konpeki-composition/v17"].includes(
        String(legacyInput.schema),
      )
      ? { ...legacyInput, schema: compositionSchema }
      : migrateV11Document(
        legacyInput.schema === "konpeki-composition/v11"
          ? legacyInput
          : migrateV10Document(
              ["konpeki-composition/v6", "konpeki-composition/v7", "konpeki-composition/v8", "konpeki-composition/v9", "konpeki-composition/v10"].includes(
                String(legacyInput.schema),
              )
                ? migrateV7Document(legacyInput)
                : migrateV7Document(
                    migrateV5Document(
                      legacyInput.schema === "konpeki-composition/v5"
                        ? legacyInput
                        : migratePreV5Document(legacyInput),
                    ),
                  ),
            ),
      )
    : input;
  const normalized = migrateInterimV12Sankey(migrated);
  const candidate = legacy ? preserveLegacyVisualizationChoices(normalized) : normalized;
  if (!structural(candidate))
    return {
      ok: false,
      issues: (structural.errors ?? []).map((error) => ({
        path: error.instancePath,
        message: error.message ?? "Invalid value",
      })),
    };
  const issues: ValidationIssue[] = [];
  const fail = (path: string, message: string) =>
    issues.push({ path, message });
  const unique = (ids: string[], path: string) => {
    if (new Set(ids).size !== ids.length) fail(path, "IDs must be unique");
  };
  unique(
    candidate.slides.map((slide) => slide.id),
    "/slides",
  );
  candidate.slides.forEach((slide, slideIndex) => {
    const base = `/slides/${slideIndex}`;
    const padding = slide.innerPadding;
    if (padding && (padding.left + padding.right >= slide.canvas.width || padding.top + padding.bottom >= slide.canvas.height))
      fail(`${base}/innerPadding`, "Padding leaves no page content area");
    const components = new Map(slide.components.map((item) => [item.id, item]));
    const slots = new Set(slide.contentSlots.map((item) => item.id));
    const groups = new Map(slide.groups.map((item) => [item.id, item]));
    unique([...components.keys(), ...groups.keys()], `${base}/groups`);
    unique(
      slide.components.map((item) => item.id),
      `${base}/components`,
    );
  unique(
    slide.contentSlots.map((item) => item.id),
    `${base}/contentSlots`,
  );
  unique(
    slide.groups.map((item) => item.id),
    `${base}/groups`,
  );
  unique(
    slide.relationships.map((item) => item.id),
    `${base}/relationships`,
  );
  const assigned: string[] = [];
  for (const component of slide.components) {
    const path = `${base}/components/${component.id}`;
    const r = component.preferredRect;
    if (r.x + r.width > slide.canvas.width || r.y + r.height > slide.canvas.height)
      fail(path, "Rectangle exceeds canvas");
    assigned.push(...component.slotIds);
    for (const id of component.slotIds)
      if (!slots.has(id)) fail(path, `Unknown slot: ${id}`);
    if (component.customVisual) {
      if (component.customVisual.format === "svg") {
        const source = component.customVisual.source;
        if (
          /<script\b|<foreignObject\b|<\?xml-stylesheet\b|<!DOCTYPE\b|\son[a-z]+\s*=|(?:href|src)\s*=\s*["'](?!data:|#)|url\(\s*["']?(?!data:|#)/i.test(
            source,
          )
        )
          fail(path, "Custom SVG must be self-contained and cannot include scripts, foreign objects, event handlers, document declarations, or external resources");
        const sourceViewBox = source
          .match(/<svg\b[^>]*\bviewBox\s*=\s*(["'])([^"']+)\1/i)?.[2]
          ?.trim()
          .split(/[\s,]+/)
          .map(Number);
        const declaredViewBox = component.customVisual.viewBox;
        if (
          sourceViewBox?.length !== 4 ||
          sourceViewBox.some((value) => !Number.isFinite(value)) ||
          sourceViewBox[0] !== declaredViewBox.x ||
          sourceViewBox[1] !== declaredViewBox.y ||
          sourceViewBox[2] !== declaredViewBox.width ||
          sourceViewBox[3] !== declaredViewBox.height
        )
          fail(path, "Custom SVG root viewBox must match the declared local viewport");
      } else {
        const known = new Set<string>();
        const kinds = new Map(component.customVisual.elements.map((element) => [element.id, element.kind]));
        for (const element of component.customVisual.elements) {
          if (known.has(element.id)) fail(path, `Duplicate vector element ID: ${element.id}`);
          if (element.parentId && !known.has(element.parentId))
            fail(path, `Vector parent must precede its child: ${element.parentId}`);
          const parentKind = element.parentId ? kinds.get(element.parentId) : undefined;
          if (element.parentId && parentKind !== "g" &&
              !(element.kind === "tspan" && (parentKind === "text" || parentKind === "tspan")))
            fail(path, "Vector children require a group or a text/tspan parent for tspans");
          if (element.kind === "tspan" && parentKind !== "text" && parentKind !== "tspan")
            fail(path, "Vector tspans require a text or tspan parent");
          if (element.text !== undefined && element.kind !== "text" && element.kind !== "tspan")
            fail(path, "Only vector text and tspans may contain text");
          known.add(element.id);
          for (const [name, value] of Object.entries(element.attributes)) {
            if (!validThemeBinding(name, value))
              fail(path, `Invalid theme binding for vector attribute: ${name}`);
            if (!vectorAttributeNames.has(name))
              fail(path, `Unsupported vector attribute: ${name}`);
            if (typeof value === "string" && /url\s*\(|javascript:|data:/i.test(value))
              fail(path, `Unsafe vector attribute value: ${name}`);
          }
        }
      }
    }
    if (component.kind === "chart" && component.topology && component.appearance.template !== "sankey")
      fail(path, "Only Sankey charts may define topology");
    if ((component.kind === "diagram" || component.kind === "chart") && component.topology) {
      const { nodes, edges } = component.topology;
      unique(
        nodes.map((node) => node.id),
        path,
      );
      unique(
        nodes.map((node) => node.slotId),
        path,
      );
      unique(
        edges.map((edge) =>
          JSON.stringify([edge.from, edge.to, edge.label ?? ""]),
        ),
        path,
      );
      const known = new Set(nodes.map((node) => node.id));
      if (nodes.length !== component.slotIds.length)
        fail(path, "Topology must represent every component slot");
      for (const node of nodes) {
        if (!component.slotIds.includes(node.slotId))
          fail(path, "Topology slot must belong to its component");
        const nodeRect = node.preferredRect;
        if (
          nodeRect &&
          (nodeRect.x < r.x ||
            nodeRect.y < r.y ||
            nodeRect.x + nodeRect.width > r.x + r.width ||
            nodeRect.y + nodeRect.height > r.y + r.height)
        )
          fail(path, "Topology node rectangle must stay within its component");
      }
      for (const edge of edges) {
        if (!known.has(edge.from) || !known.has(edge.to))
          fail(path, "Unknown topology endpoint");
        if (edge.from === edge.to)
          fail(path, "Topology self-edges are not supported");
      }
    }
  }
  for (const id of slots)
    if (!assigned.includes(id))
      fail(`${base}/contentSlots`, `Unassigned content slot: ${id}`);
  const grouped: string[] = [];
  for (const group of slide.groups)
    for (const id of group.childIds) {
      grouped.push(id);
      if (!components.has(id))
        fail(`${base}/groups`, "Groups may contain only components");
    }
  unique(grouped, `${base}/groups`);
  const reading = slide.readingOrder.flatMap((entry) => {
    if (entry.kind === "component") {
      if (!components.has(entry.id))
        fail(`${base}/readingOrder`, "Unknown component");
      return [entry.id];
    }
    const group = groups.get(entry.id);
    if (!group) fail(`${base}/readingOrder`, "Unknown group");
    return group?.childIds ?? [];
  });
  for (const [path, order] of [
    ["readingOrder", reading],
    ["paintOrder", slide.paintOrder],
  ] as const) {
    if (
      order.length !== components.size ||
      new Set(order).size !== components.size ||
      order.some((id) => !components.has(id))
    )
      fail(`${base}/${path}`, "Must contain every component exactly once");
  }
  for (const slot of slide.contentSlots)
    if ("targets" in slot)
      for (const id of slot.targets) {
        if (!components.has(id) && !slots.has(id))
          fail(`${base}/contentSlots`, "Unknown qualification/source target");
      }
  for (const relationship of slide.relationships)
    for (const endpoint of [relationship.from, relationship.to]) {
      const component = components.get(endpoint.nodeId);
      if (!component) fail(`${base}/relationships`, "Unknown relationship node");
      if (endpoint.slotId && !component?.slotIds.includes(endpoint.slotId))
        fail(
          `${base}/relationships`,
          "Relationship slot must belong to its endpoint",
        );
    }
  });
  return issues.length
    ? { ok: false, issues }
    : { ok: true, document: legacy ? { ...candidate, slides: candidate.slides.map((slide) => ({
        ...slide, components: slide.components.map((component) => component.kind === "text-block" && !component.customVisual && component.content === undefined
          ? { ...component, content: component.intent ?? "" } : component),
      })) } : candidate };
}
export function assertComposition(input: unknown): CompositionDocument {
  const result = validateComposition(input);
  if (!result.ok)
    throw new Error(
      result.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("\n"),
    );
  return result.document;
}
