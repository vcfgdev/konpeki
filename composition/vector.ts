import { DOMParser } from "@xmldom/xmldom";
import {
  vectorElementKinds,
  type VectorElement,
  type VectorElementKind,
} from "./types.ts";

export const vectorAttributeNames = new Set([
  "x", "y", "dx", "dy", "x1", "y1", "x2", "y2", "width", "height", "rx", "ry",
  "cx", "cy", "r", "d", "points", "transform", "fill", "fill-opacity",
  "stroke", "stroke-width", "stroke-opacity", "stroke-linecap", "stroke-linejoin",
  "stroke-dasharray", "opacity", "font-family", "font-size", "font-weight",
  "font-style", "text-anchor", "dominant-baseline", "vector-effect",
]);

/** Remove a subtree, never leaving orphaned descendants. */
export function removeVectorElement(elements: VectorElement[], id: string) {
  const removed = new Set([id]);
  for (const element of elements) {
    if (element.parentId && removed.has(element.parentId)) removed.add(element.id);
  }
  return elements.filter((element) => !removed.has(element.id));
}

/** Swap sibling subtrees while retaining parent-before-child serialization. */
export function moveVectorElement(elements: VectorElement[], id: string, direction: -1 | 1) {
  const selected = elements.find((element) => element.id === id);
  if (!selected) return elements;
  const children = new Map<string | undefined, VectorElement[]>();
  for (const element of elements) {
    const peers = children.get(element.parentId) ?? [];
    peers.push(element);
    children.set(element.parentId, peers);
  }
  const siblings = children.get(selected.parentId)!;
  const index = siblings.indexOf(selected);
  const other = siblings[index + direction];
  if (!other) return elements;
  [siblings[index], siblings[index + direction]] = [other, selected];
  const result: VectorElement[] = [];
  function visit(parentId?: string) {
    for (const child of children.get(parentId) ?? []) {
      result.push(child);
      visit(child.id);
    }
  }
  visit();
  return result;
}

function uniqueId(preferred: string, used: Set<string>, index: number) {
  const base = preferred.trim().replace(/[^a-zA-Z0-9_-]+/g, "-") || `vector-${index}`;
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function attributesOf(element: Element) {
  const attributes: Record<string, string | number> = {};
  for (let index = 0; index < element.attributes.length; index += 1) {
    const attribute = element.attributes.item(index);
    if (!attribute || attribute.name === "id") continue;
    if (attribute.name === "style") {
      for (const declaration of attribute.value.split(";")) {
        const separator = declaration.indexOf(":");
        if (separator < 0) continue;
        const name = declaration.slice(0, separator).trim();
        const value = declaration.slice(separator + 1).trim();
        if (vectorAttributeNames.has(name) && value && !/url\s*\(/i.test(value))
          attributes[name] = value;
      }
      continue;
    }
    if (vectorAttributeNames.has(attribute.name)) attributes[attribute.name] = attribute.value;
  }
  return attributes;
}

export function parseEditableSvg(source: string) {
  const document = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = document.documentElement;
  if (!root || root.localName !== "svg") throw new Error("The visual must have an SVG root.");
  const values = root.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (!values || values.length !== 4 || values.some((value) => !Number.isFinite(value)))
    throw new Error("The SVG root needs a numeric viewBox.");
  const [x, y, width, height] = values;
  if (width <= 0 || height <= 0) throw new Error("The SVG viewBox must be positive.");

  const elements: VectorElement[] = [];
  const used = new Set<string>();
  function visit(element: Element, parentId?: string) {
    const kind = element.localName as VectorElementKind;
    if (!vectorElementKinds.includes(kind))
      throw new Error(`Unsupported editable SVG element: ${element.localName}.`);
    const id = uniqueId(element.getAttribute("id") ?? "", used, elements.length + 1);
    used.add(id);
    const mixedText = (kind === "text" || kind === "tspan") &&
      Array.from({ length: element.childNodes.length }, (_, index) =>
        element.childNodes.item(index),
      ).some((node) => node?.nodeType === 1);
    const text = [...Array.from({ length: element.childNodes.length }, (_, index) =>
      element.childNodes.item(index),
    )]
      .filter((node) => node?.nodeType === 3)
      .map((node) => node?.nodeValue ?? "")
      .join("");
    elements.push({
      id,
      kind,
      ...(parentId ? { parentId } : {}),
      attributes: attributesOf(element),
      ...(!mixedText && text && (kind === "text" || kind === "tspan") ? { text } : {}),
    });
    for (let index = 0; index < element.childNodes.length; index += 1) {
      const child = element.childNodes.item(index);
      if (mixedText && child?.nodeType === 3 && child.nodeValue) {
        const textId = uniqueId("", used, elements.length + 1);
        used.add(textId);
        elements.push({ id: textId, kind: "tspan", parentId: id, attributes: {}, text: child.nodeValue });
      }
      if (child?.nodeType !== 1) continue;
      visit(child as unknown as Element, id);
    }
  }

  const rootAttributes = attributesOf(root as unknown as Element);
  let parentId: string | undefined;
  if (Object.keys(rootAttributes).length) {
    parentId = "vector-root";
    used.add(parentId);
    elements.push({ id: parentId, kind: "g", attributes: rootAttributes });
  }
  for (let index = 0; index < root.childNodes.length; index += 1) {
    const child = root.childNodes.item(index);
    if (child?.nodeType !== 1) continue;
    const name = (child as unknown as Element).localName;
    if (name === "title" || name === "desc") continue;
    visit(child as unknown as Element, parentId);
  }
  if (!elements.length) throw new Error("The SVG contains no editable elements.");
  return { viewBox: { x, y, width, height }, elements };
}
