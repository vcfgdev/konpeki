import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import { documentServer } from "./server.ts";
import { inspectHTMLPage, type Diagnostic } from "./inspect.ts";
import { isGoogleFontResource } from "./document.ts";

export async function browserDocument(input: string, options: { page?: number; format?: string; scale?: number; details?: boolean } = {}) {
  if (options.format !== undefined && !["png", "pdf"].includes(options.format)) throw new Error("HTML exports support PNG and PDF. Whole-page SVG export is not supported.");
  const scale = options.scale ?? 2;
  if (!Number.isFinite(scale) || scale <= 0 || scale > 8) throw new Error("Scale must be greater than 0 and at most 8.");
  const server = await documentServer(input);
  let browser;
  try {
    const snapshot = await server.store.read();
    const selected = options.page;
    if (selected !== undefined && (!Number.isInteger(selected) || selected < 1 || selected > snapshot.pages.length))
      throw new Error(`Page must be an integer from 1 to ${snapshot.pages.length}.`);
    try { browser = await chromium.launch({ headless: true }); }
    catch { throw new Error("Chromium could not start. Run `konpeki browser install` to install the pinned browser; Linux also needs Chromium's system libraries."); }
    const context = await browser.newContext({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: scale, serviceWorkers: "block" });
    // Local document assets plus Google Fonts; other external requests, including
    // those hidden in CSS, remain blocked.
    await context.route("**/*", route => {
      const request = route.request();
      return request.url().startsWith(`${server.origin}${server.prefix}/`) || isGoogleFontResource(request.url(), request.resourceType()) ? route.continue() : route.abort();
    });
    const tab = await context.newPage(), pages = [], diagnostics: Diagnostic[] = [];
    const failed = new Set<string>();
    tab.on("requestfailed", request => failed.add(request.url()));
    tab.on("response", response => { if (!response.ok()) failed.add(response.url()); });
    const pdf = options.format === "pdf" ? await PDFDocument.create() : undefined;
    let bytes: Uint8Array | undefined;
    for (let index = 0; index < snapshot.pages.length; index++) {
      if (selected !== undefined && selected !== index + 1) continue;
      if (options.format === "png" && selected === undefined && index > 0) break;
      const id = snapshot.pages[index];
      await tab.goto("about:blank");
      await tab.setViewportSize({ width: 794, height: 1123 });
      failed.clear();
      const response = await tab.goto(`${server.origin}${server.prefix}/document/?page=${encodeURIComponent(id)}&revision=${snapshot.revision}`);
      if (!response?.ok()) throw new Error("The HTML changed while rendering. Inspect and retry the latest source.");
      await tab.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(Array.from(document.images).map(image => image.decode().catch(() => {})));
      });
      const element = tab.locator("[data-konpeki-current]");
      const initial = await element.boundingBox();
      if (!initial || initial.width <= 0 || initial.height <= 0 || initial.width > 8192 || initial.height > 8192) throw new Error("Invalid page dimensions. Use an explicit width and height up to 8192 CSS px.");
      await tab.setViewportSize({ width: Math.ceil(initial.width), height: Math.ceil(initial.height) });
      await tab.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
      await tab.waitForLoadState("networkidle");
      const report = await element.evaluate(inspectHTMLPage);
      if (Math.abs(report.width - initial.width) > .75 || Math.abs(report.height - initial.height) > .75)
        throw new Error("Page dimensions depend on the viewport. Give pages a fixed CSS width and height; their content may use responsive layout.");
      for (const resource of failed) report.diagnostics.push({ code: "missing-resource", severity: "error", page: id, target: id, message: `Resource did not load: ${resource.startsWith(`${server.origin}${server.prefix}/document/`) ? resource.slice(`${server.origin}${server.prefix}/document/`.length) : new URL(resource).origin + new URL(resource).pathname}. Use local assets or check access to Google Fonts.` });
      diagnostics.push(...report.diagnostics);
      pages.push({ pageNumber: index + 1, ...report, ...(options.details ? {} : { text: undefined }) });
      if (options.format === "png") {
        if (report.width * report.height * scale * scale > 64_000_000) throw new Error("PNG exceeds 64 million pixels; reduce --scale.");
        bytes = await element.screenshot({ type: "png", animations: "disabled" });
      } else if (pdf) {
        // Print the screen layout on exactly one authored page, then merge pages
        // to retain mixed paper sizes. Never invent document pagination.
        await tab.emulateMedia({ media: "screen" });
        await tab.addStyleTag({ content: `@page { size: ${report.width}px ${report.height}px; margin: 0; } body { print-color-adjust: exact; }` });
        const part = await PDFDocument.load(await tab.pdf({ preferCSSPageSize: true, printBackground: true, margin: { top: 0, left: 0, right: 0, bottom: 0 } }));
        if (part.getPageCount() !== 1) throw new Error(`Page ${index + 1} printed onto multiple sheets. Fix its overflow before exporting PDF.`);
        for (const page of await pdf.copyPages(part, [0])) pdf.addPage(page);
      }
    }
    if ((await server.store.read()).revision !== snapshot.revision) throw new Error("The source changed during rendering. Retry the latest revision.");
    if (pdf) bytes = await pdf.save();
    return { bytes, report: { schema: "konpeki-html-inspection/v1", revision: snapshot.revision, units: "css-pixels", ok: !diagnostics.some(d => d.severity === "error"), pages, diagnostics } };
  } finally { await browser?.close(); await server.close(); }
}
