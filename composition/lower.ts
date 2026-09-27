import { areaRect, gridMetrics, roleSteps, typeSteps, type GridDocument, type GridSlide, type GridComponent } from "./grid.ts";
import type { Rect, VectorElement } from "./types.ts";
import type { FontContext } from "./fonts.ts";
import { layoutText } from "./text-layout.ts";
import type { ScenePage, SceneShape, SceneText, SceneTarget } from "./scene.ts";
import { composerPalette, themeLabel } from "../src/lib/theme.ts";
import { getTheme } from "../design/themes/index.ts";
import { draftArtwork } from "./draft-artwork.ts";

const identity: SceneShape["transform"] = [1, 0, 0, 1, 0, 0];
const familyName = (value: string) => value.split(",")[0].replaceAll('"', "").trim();
const inheritKeys = new Set(["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "fill-opacity", "stroke-opacity", "font-family", "font-size", "font-weight", "font-style", "text-anchor", "color"]);

/** Shared page-pixel layout. No DOM, viewport, filesystem, or renderer measurement. */
export function lowerPage(document: GridDocument, page: GridSlide, fonts: FontContext): ScenePage {
  const grid = gridMetrics(page.grid);
  const palette = composerPalette(document.theme?.id ?? "plex", document.theme?.mode ?? "paper");
  const theme = getTheme(themeLabel(document.theme?.id ?? "plex"), document.theme?.mode ?? "paper", document.theme?.typography);
  const body = familyName(theme.body), heading = familyName(theme.headline);
  const colors: Record<string, string> = { ink: palette.fg, muted: palette.muted, background: palette.bg, surface: palette.surface, divider: palette.line, accent: palette.accent, "on-accent": palette.bg, wash: palette.wash };
  const color = (value: string | number | undefined, fallback = palette.fg) => value === "none" || value === "transparent" ? "none" : typeof value === "string" && value.startsWith("theme:") ? colors[value.slice(6)] : value === "currentColor" || value === undefined ? fallback : String(value);
  const scene: ScenePage = { pageId: page.id, width: grid.width, height: grid.height, background: palette.bg, items: [], components: [] };
  const target = (componentId?: string, elementId?: string): SceneTarget => ({ pageId: page.id, ...(componentId ? { componentId } : {}), ...(elementId ? { elementId } : {}) });
  function shape(tag: SceneShape["tag"], attributes: SceneShape["attributes"], owner: SceneTarget, transform = identity, clip?: Rect) {
    scene.items.push({ ...owner, kind: "shape", tag, attributes, transform, ...(clip ? { clip } : {}) });
  }
  function text(source: string, box: Rect, owner: SceneTarget, size: number, height: number, fontFamily: string, weight: number, fill: string, align: "left" | "center" | "right" = "left", label = false, style: "normal" | "italic" = "normal", opacity = 1): SceneText {
    const layout = layoutText(fonts, { text: source, width: box.width, fontFamily, fontSize: size, lineHeight: height, fontWeight: weight, fontStyle: style, align, wrap: label ? "no-wrap" : "pre-wrap", overflowWrap: "anywhere" });
    return { ...owner, kind: "text", source, box, layout, fontSize: size, lineHeight: height, fontWeight: weight, color: fill, opacity, label, clip: box };
  }
  for (const id of page.paintOrder) {
    const component = page.components.find(c => c.id === id)!;
    const owner = target(id), box = areaRect(page.grid, component.area), inset = (component.padding ?? 0) * grid.baseline;
    const cell = { x: box.x + inset, y: box.y + inset, width: box.width - 2 * inset, height: box.height - 2 * inset };
    const info: ScenePage["components"][number] = { id, box, contentBox: cell, draft: !component.customVisual && component.kind !== "text-block", chart: component.kind === "chart" };
    scene.components.push(info);
    const appearance = (component.appearance ?? {}) as Record<string, string | undefined>;
    if (appearance.border === "filled" || appearance.treatment === "subtle" || appearance.treatment === "strong") shape("rect", { ...box, fill: appearance.treatment === "strong" ? palette.accent : palette.wash }, owner);
    if (appearance.border === "outline") shape("rect", { ...box, fill: "none", stroke: palette.line, "stroke-width": 1 }, owner);
    if (appearance.rule && appearance.rule !== "none") {
      const y = appearance.rule === "top" ? box.y : box.y + box.height;
      shape("line", { x1: box.x, y1: y, x2: box.x + box.width, y2: y, stroke: palette.line, "stroke-width": 1, fill: "none" }, owner);
    }
    if (component.customVisual) {
      const visual = component.customVisual, view = visual.viewBox;
      const sx = cell.width / view.width, sy = cell.height / view.height;
      const fit = visual.fit === "cover" ? Math.max(sx, sy) : Math.min(sx, sy);
      const scaleX = visual.fit === "stretch" ? sx : fit, scaleY = visual.fit === "stretch" ? sy : fit;
      const dx = cell.x + (cell.width - view.width * scaleX) / 2 - view.x * scaleX;
      const dy = cell.y + (cell.height - view.height * scaleY) / 2 - view.y * scaleY;
      const transform: SceneShape["transform"] = [scaleX, 0, 0, scaleY, dx, dy];
      info.artworkScale = [scaleX, scaleY];
      const children = new Map<string | undefined, VectorElement[]>();
      for (const element of visual.elements) children.set(element.parentId, [...children.get(element.parentId) ?? [], element]);
      function visit(parent: string | undefined, inherited: VectorElement["attributes"], inheritedOpacity: number) {
        for (const element of children.get(parent) ?? []) {
          for (const key of ["dx", "dy", "transform", "dominant-baseline"]) if (key in element.attributes) throw new Error(`${id}/${element.id}: unsupported ${key}`);
          if (element.kind === "g" && element.attributes.opacity !== undefined)
            throw new Error(`${id}/${element.id}: group opacity is unsupported; use fill-opacity or stroke-opacity`);
          const attrs = { ...inherited, ...element.attributes };
          const opacity = inheritedOpacity * Number(element.attributes.opacity ?? 1);
          const elementOwner = target(id, element.id);
          if (element.kind === "text" || element.kind === "tspan") {
            if (element.text !== undefined) {
              const step = String(attrs["font-size"] ?? "scale:caption").replace("scale:", "") as typeof typeSteps[number];
              const size = grid.scale[typeSteps.indexOf(step)], height = grid.lineHeights[typeSteps.indexOf(step)];
              const item = text(element.text, { x: 0, y: 0, width: 0, height: cell.height }, elementOwner, size, height,
                attrs["font-family"] === "theme:heading-font" ? heading : body, Number(attrs["font-weight"] ?? 400), color(attrs.fill, color(attrs.color)), "left", true,
                attrs["font-style"] === "italic" ? "italic" : "normal", opacity * Number(attrs["fill-opacity"] ?? 1));
              const width = Math.max(0, ...item.layout.lines.map(line => line.width));
              const anchor = attrs["text-anchor"] === "middle" ? 0.5 : attrs["text-anchor"] === "end" ? 1 : 0;
              item.box = { x: dx + Number(attrs.x ?? 0) * scaleX - anchor * width, y: dy + Number(attrs.y ?? 0) * scaleY - item.layout.lines[0].baseline, width, height: item.layout.height };
              item.clip = cell;
              if (item.color !== "none") scene.items.push(item);
            }
          } else if (element.kind !== "g") {
            const attributes = Object.fromEntries(Object.entries(attrs).filter(([key]) => !key.startsWith("font-") && key !== "text-anchor" && key !== "opacity"));
            attributes.fill = color(attrs.fill, color(attrs.color));
            attributes.stroke = attrs.stroke === undefined ? "none" : color(attrs.stroke, color(attrs.color));
            attributes.opacity = opacity;
            delete attributes.color;
            shape(element.kind, attributes, elementOwner, transform, cell);
          }
          visit(element.id, Object.fromEntries(Object.entries(attrs).filter(([key]) => inheritKeys.has(key))), opacity);
        }
      }
      visit(undefined, {}, 1);
    } else if (component.kind === "text-block") {
      const step = component.textStyle?.step ?? roleSteps[component.appearance.role], index = typeSteps.indexOf(step);
      const size = grid.scale[index], height = component.textStyle?.leading === undefined ? grid.lineHeights[index] : component.textStyle.leading * grid.baseline;
      const regions = textRegions(component, cell, grid.gutter);
      for (const region of regions) {
        const item = text(region.text, region.box, owner, size, height, component.textStyle?.font === "heading" ? heading : body,
          component.textStyle?.weight ?? 400, appearance.treatment === "strong" ? palette.bg : colors[component.textStyle?.color ?? "ink"],
          appearance.alignment === "center" ? "center" : appearance.alignment === "end" ? "right" : "left");
        // Preserve the canvas's title alignment, including multiline titles and
        // padding. Keep the original clip so overflowing copy is still diagnosed.
        if (component.appearance.role === "title") {
          const offset = Math.max(0, region.box.height - item.layout.height);
          item.box = { ...region.box, y: region.box.y + offset, height: region.box.height - offset };
        }
        scene.items.push(item);
      }
    } else {
      const caption = text(`Draft ${component.kind}`, { ...cell, height: grid.lineHeights[2] }, owner, grid.scale[2], grid.lineHeights[2], heading, 500, palette.fg);
      scene.items.push(caption);
      const intent = text(component.intent ?? "", { ...cell, y: cell.y + caption.layout.height + 12, height: Math.max(0, cell.height - caption.layout.height - 12) }, owner, grid.scale[1], grid.lineHeights[1], body, 400, palette.muted);
      scene.items.push(intent);
      const top = intent.box.y + intent.layout.height + 20;
      const artBox = { ...cell, y: top, height: Math.max(0, cell.y + cell.height - top) };
      const art = draftArtwork(component, palette), s = Math.min(artBox.width / art.width, artBox.height / art.height);
      const dx = artBox.x + (artBox.width - art.width * s) / 2, dy = artBox.y + (artBox.height - art.height * s) / 2;
      for (const element of art.shapes) shape(element.tag, element.attributes, owner, [s, 0, 0, s, dx, dy], cell);
      for (const label of art.labels) {
        const item = text(label.text, { x: 0, y: 0, width: 0, height: 0 }, owner, grid.scale[0], grid.lineHeights[0], body, 400, palette.fg, "left", true);
        item.box = { x: dx + label.x * s - item.layout.lines[0].width / 2, y: dy + label.y * s - item.layout.lines[0].baseline, width: item.layout.lines[0].width, height: item.layout.height };
        item.clip = cell;
        scene.items.push(item);
      }
    }
  }
  if (page.pageNumber && page.pageNumber.style !== "none") {
    const index = document.slides.findIndex(item => item.id === page.id), source = String(index + 1).padStart(2, "0") + (page.pageNumber?.style === "01/02" ? `/${String(document.slides.length).padStart(2, "0")}` : "");
    scene.items.push(text(source, { x: grid.width * 0.65, y: grid.height * 0.978 - grid.scale[0], width: grid.width * (1 - 0.65 - 0.058333333), height: grid.scale[0] }, target(), grid.scale[0], grid.scale[0], body, 400, colors[page.pageNumber?.color ?? "muted"], "right", true));
  }
  return scene;
}

function textRegions(component: Extract<GridComponent, { kind: "text-block" }>, box: Rect, gap: number) {
  const layout = component.appearance.layout ?? "single", source = component.content ?? "";
  if (layout === "single") return [{ box, text: source }];
  const count = layout === "two-column" ? 2 : layout === "three-column" ? 3 : 4;
  const parts = source.split(/\n\n+/), result: { box: Rect; text: string }[] = [];
  for (let i = 0; i < count; i++) {
    const vertical = component.appearance.orientation === "vertical";
    const cols = layout === "two-plus-two" ? 2 : vertical ? 1 : count, rows = layout === "two-plus-two" ? 2 : vertical ? count : 1;
    let cell = { x: box.x + i % cols * (box.width + gap) / cols, y: box.y + Math.floor(i / cols) * (box.height + gap) / rows, width: (box.width - (cols - 1) * gap) / cols, height: (box.height - (rows - 1) * gap) / rows };
    if (layout === "one-plus-three" || layout === "three-plus-one") {
      const primary = layout === "one-plus-three" ? i === 0 : i === 3, n = layout === "one-plus-three" ? i - 1 : i;
      const first = layout === "one-plus-three" ? primary : !primary;
      cell = vertical
        ? { x: box.x + (primary ? 0 : n * (box.width + gap) / 3), y: box.y + (first ? 0 : (box.height + gap) / 2), width: primary ? box.width : (box.width - gap * 2) / 3, height: (box.height - gap) / 2 }
        : { x: box.x + (first ? 0 : (box.width + gap) / 2), y: box.y + (primary ? 0 : n * (box.height + gap) / 3), width: (box.width - gap) / 2, height: primary ? box.height : (box.height - gap * 2) / 3 };
    }
    const perRegion = Math.floor(parts.length / count), extra = parts.length % count;
    const start = i * perRegion + Math.min(i, extra), end = start + perRegion + Number(i < extra);
    result.push({ box: cell, text: parts.slice(start, end).join("\n\n") });
  }
  return result;
}
