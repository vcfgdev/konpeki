import { loadNodeFontContext } from "../composition/fonts.ts";
import { lowerPage } from "../composition/lower.ts";
import { renderSVG } from "../composition/svg.ts";
import { assertComposition } from "../composition/validate.ts";

export type RenderFormat = "png" | "svg" | "pdf";
let fontContext: ReturnType<typeof loadNodeFontContext> | undefined;
export const renderFonts = () => fontContext ??= loadNodeFontContext(new URL("../fonts/", import.meta.url));

export async function renderDocument(input: unknown, options: { format: RenderFormat; page?: number; scale?: number }) {
  const document = assertComposition(input);
  const { format, page, scale = 2 } = options;
  if (!["png", "svg", "pdf"].includes(format)) throw new Error("Format must be png, svg or pdf.");
  if (page !== undefined && (!Number.isInteger(page) || page < 1 || page > document.pages.length))
    throw new Error(`Page must be an integer from 1 to ${document.pages.length}.`);
  if (!Number.isFinite(scale) || scale <= 0 || scale > 8) throw new Error("PNG scale must be greater than 0 and no more than 8.");
  const fonts = await renderFonts();
  if (format === "pdf") {
    const { renderPDF } = await import("../composition/pdf.ts");
    const pages = page === undefined ? document.pages : [document.pages[page - 1]];
    return { bytes: await renderPDF(pages.map(item => lowerPage(document, item, fonts)), fonts), contentType: "application/pdf" };
  }
  const scene = lowerPage(document, document.pages[(page ?? 1) - 1], fonts);
  const svg = renderSVG(scene, fonts);
  if (format === "svg") return { bytes: new TextEncoder().encode(svg), contentType: "image/svg+xml" };
  const { Resvg } = await import("@resvg/resvg-js");
  return { bytes: new Resvg(svg, { font: { loadSystemFonts: false }, fitTo: { mode: "zoom", value: scale } }).render().asPng(), contentType: "image/png" };
}
