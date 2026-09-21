import { Ajv2020 } from "ajv/dist/2020.js";
import { schema } from "./schema.ts";
import {
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
export function validateComposition(input: unknown): ValidationResult {
  if (!structural(input))
    return {
      ok: false,
      issues: (structural.errors ?? []).map((error) => ({
        path: error.instancePath,
        message: error.message ?? "Invalid value",
      })),
    };
  const candidate = input;
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
    : { ok: true, document: input };
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
