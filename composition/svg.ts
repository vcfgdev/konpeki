import type { FontContext } from "./fonts.ts";
import type { SceneItem, ScenePage } from "./scene.ts";
import type { Rect } from "./types.ts";

const xml = (value: string | number) => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
const attributes = (values: Record<string, string | number | undefined>) => Object.entries(values).filter(([, value]) => value !== undefined).map(([key, value]) => ` ${key}="${xml(value!)}"`).join("");

/** Glyph paths, not SVG text: no writer or viewer gets to shape again. */
function sceneItemSVG(item: SceneItem, fonts: FontContext, index: number, idPrefix: string): string {
  const target = attributes({ "data-component": item.componentId, "data-vector-element": item.elementId, "data-scene-item": index });
  const clipId = `${idPrefix}clip-${index}`;
  const clip = item.clip ? `<defs><clipPath id="${clipId}"><rect${attributes(item.clip)}/></clipPath></defs>` : "";
  const content = item.kind === "shape"
    ? `<${item.tag}${attributes(item.attributes)} transform="matrix(${item.transform.join(" ")})"/>`
    : `<g fill="${xml(item.color)}" opacity="${item.opacity}" aria-label="${xml(item.source)}">${item.layout.lines.map(line => `<g data-line-start="${line.start}" data-line-end="${line.end}" data-baseline="${item.box.y + line.baseline}">${line.glyphs.map(glyph => {
      const scale = item.fontSize / fonts.fonts.get(glyph.fontId)!.unitsPerEm;
      const path = fonts.glyphOutline(glyph.fontId, glyph.glyphId);
      return path ? `<path d="${xml(path)}" transform="translate(${item.box.x + glyph.x} ${item.box.y + glyph.y}) scale(${scale} ${-scale})"/>` : "";
    }).join("")}</g>`).join("")}</g>`;
  return `${clip}<g${target}${item.clip ? ` clip-path="url(#${clipId})"` : ""}>${content}</g>`;
}

export function renderSVG(scene: ScenePage, fonts: FontContext, viewport: Rect = { x: 0, y: 0, width: scene.width, height: scene.height }, idPrefix = ""): string {
  // Inline canvases share the document's ID namespace; standalone exports do not.
  const prefix = encodeURIComponent(idPrefix);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${viewport.width}" height="${viewport.height}" viewBox="${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}" role="img" aria-label="${xml(scene.pageId)}"><rect width="${scene.width}" height="${scene.height}" fill="${xml(scene.background)}"/>${scene.items.map((item, index) => sceneItemSVG(item, fonts, index, prefix)).join("")}</svg>`;
}
