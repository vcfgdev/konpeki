import { Resvg } from "@resvg/resvg-js";
import type { FontContext } from "./fonts.ts";
import type { ScenePage } from "./scene.ts";
import type { Rect } from "./types.ts";
import { checkPage, textInkBounds, type Diagnostic } from "./check.ts";
import { renderSVG } from "./svg.ts";

const SCALE = 2;
const luminance = (r: number, g: number, b: number) => {
  const values = [r, g, b].map(value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
  return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
};
const ratio = (a: number[], b: number[]) => { const x = luminance(a[0], a[1], a[2]), y = luminance(b[0], b[1], b[2]); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const raster = (scene: ScenePage, fonts: FontContext, bounds: Rect) =>
  new Resvg(renderSVG(scene, fonts, bounds), { font: { loadSystemFonts: false }, fitTo: { mode: "zoom", value: SCALE } }).render();

/** Node-only paint-aware checks. Raster evidence is intentionally kept out of the browser bundle. */
export function checkPageNode(scene: ScenePage, fonts: FontContext): Diagnostic[] {
  const diagnostics = checkPage(scene, fonts);
  scene.items.forEach((item, index) => {
    if (item.kind !== "text" || item.color === "none" || item.opacity <= 0) return;
    const inkBounds = textInkBounds(item, fonts);
    if (!inkBounds || !inkBounds.width || !inkBounds.height) return;
    const bounds = { x: 0, y: 0, width: 0, height: 0 };
    bounds.x = Math.floor(Math.max(0, inkBounds.x));
    bounds.y = Math.floor(Math.max(0, inkBounds.y));
    bounds.width = Math.ceil(Math.min(scene.width, inkBounds.x + inkBounds.width)) - bounds.x;
    bounds.height = Math.ceil(Math.min(scene.height, inkBounds.y + inkBounds.height)) - bounds.y;
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const prefix = raster({ ...scene, items: scene.items.slice(0, index) }, fonts, bounds);
    const ink = raster({ ...scene, background: "transparent", items: [{ ...item, color: "#000000", opacity: 1 }] }, fonts, bounds);
    const background = prefix.pixels, mask = ink.pixels;
    let minimum = Infinity, samples = 0, at: [number, number] | undefined;
    const fg = parseColor(item.color);
    if (!fg) return;
    for (let p = 0; p < mask.length; p += 4) {
      // Anti-aliased edge pixels are resolution-dependent. Fully covered mask
      // pixels represent actual glyph interiors, never rectangle probes.
      if (mask[p + 3] !== 255) continue;
      const alpha = item.opacity * fg[3], bg = [background[p], background[p + 1], background[p + 2]];
      const composite = [0, 1, 2].map(channel => fg[channel] * alpha + bg[channel] * (1 - alpha));
      const value = ratio(composite, bg); samples++;
      if (value < minimum) { minimum = value; at = [bounds.x + p / 4 % prefix.width / SCALE, bounds.y + Math.floor(p / 4 / prefix.width) / SCALE]; }
    }
    const large = item.fontSize >= (item.fontWeight >= 700 ? 18.667 : 24), required = large ? 3 : 4.5;
    if (samples && minimum < required) diagnostics.push({ code: "text-contrast", severity: "error", pageId: scene.pageId,
      ...(item.componentId ? { componentId: item.componentId } : {}), ...(item.elementId ? { elementId: item.elementId } : {}),
      message: `Text contrast is ${minimum.toFixed(2)}:1; WCAG requires ${required}:1.`,
      evidence: { source: item.source, minimumRatio: minimum, requiredRatio: required, largeText: large, sampleCount: samples, worstPagePoint: at,
        method: "2x resvg paint-order prefix; all fully covered glyph-mask pixels; foreground alpha composited over rendered background",
        resolutionLimitation: "2x raster sampling excludes anti-aliased edge pixels and may miss glyphs with no fully covered pixel." } });
  });
  return diagnostics;
}

function parseColor(value: string): [number, number, number, number] | undefined {
  const hex = /^#([\da-f]{6})([\da-f]{2})?$/i.exec(value);
  if (hex) return [Number.parseInt(hex[1].slice(0, 2), 16), Number.parseInt(hex[1].slice(2, 4), 16), Number.parseInt(hex[1].slice(4, 6), 16), hex[2] ? Number.parseInt(hex[2], 16) / 255 : 1];
  return undefined;
}
