import type { GridDocument } from "../../composition/grid.ts";
import { lowerPage } from "../../composition/lower.ts";
import { renderSVG } from "../../composition/svg.ts";
import { sceneFonts } from "./scene-fonts.ts";

export type ExportFormat = "png" | "svg" | "pdf";

export async function renderCompositionSVG(document: GridDocument, pageIndex: number) {
  const fonts = await sceneFonts();
  return renderSVG(lowerPage(document, document.slides[pageIndex], fonts), fonts);
}

export async function exportComposition(document: GridDocument, format: ExportFormat, pageIndex = 0, scale = 2): Promise<Blob> {
  const fonts = await sceneFonts();
  if (format === "pdf") {
    const { renderPDF } = await import("../../composition/pdf.ts");
    const bytes = await renderPDF(document.slides.map(page => lowerPage(document, page, fonts)), fonts);
    return new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" });
  }
  const scene = lowerPage(document, document.slides[pageIndex], fonts);
  const svg = renderSVG(scene, fonts);
  if (format === "svg") return new Blob([svg], { type: "image/svg+xml" });
  const image = new Image();
  image.src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await image.decode();
    const canvas = documentElement("canvas");
    canvas.width = scene.width * scale;
    canvas.height = scene.height * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PNG export is unavailable in this browser.");
    context.scale(scale, scale);
    context.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG encoding failed.")), "image/png"));
  } finally { URL.revokeObjectURL(image.src); }
}

function documentElement<K extends keyof HTMLElementTagNameMap>(tag: K) {
  return globalThis.document.createElement(tag);
}

export async function exportFileSession(token: string, format: ExportFormat, page: number, revision: string) {
  const response = await fetch("/__konpeki/session/export", {
    method: "POST",
    headers: { "content-type": "application/json", "x-konpeki-session": token },
    body: JSON.stringify({ format, page, scale: 2, revision }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? "The file export failed.");
  }
  return response.blob();
}
