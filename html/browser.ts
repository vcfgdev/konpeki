import { constants, promises as fs } from "node:fs";
import { homedir } from "node:os";
import { posix, win32 } from "node:path";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import { documentServer } from "./server.ts";
import { inspectHTMLPage, type Diagnostic } from "./inspect.ts";
import { isGoogleFontResource } from "./document.ts";

export async function installedBrowser(platform = process.platform, env = process.env, home = homedir()): Promise<string | undefined> {
  const paths = platform === "win32" ? win32 : posix;
  const candidates: string[] = [];
  if (platform === "darwin") {
    for (const app of ["Google Chrome", "Chromium"])
      for (const directory of ["/Applications", paths.join(home, "Applications")])
        candidates.push(paths.join(directory, `${app}.app`, "Contents", "MacOS", app));
  } else if (platform === "win32") {
    for (const app of ["Google/Chrome", "Chromium"])
      for (const directory of [env.LOCALAPPDATA, env.PROGRAMFILES, env["PROGRAMFILES(X86)"]])
        if (directory) candidates.push(paths.join(directory, app, "Application", "chrome.exe"));
  }
  const names = platform === "win32" ? ["chrome.exe", "chromium.exe"] : ["google-chrome-stable", "google-chrome", "chromium-browser", "chromium"];
  const directories = (env.PATH ?? "").split(paths.delimiter).map(directory => directory.replace(/^"(.*)"$/, "$1")).filter(directory => paths.isAbsolute(directory));
  for (const name of names) for (const directory of directories) candidates.push(paths.join(directory, name));
  for (const candidate of new Set(candidates)) {
    try {
      if (!(await fs.stat(candidate)).isFile()) continue;
      await fs.access(candidate, platform === "win32" ? constants.F_OK : constants.X_OK);
      return candidate;
    } catch { /* Missing or non-executable candidates are not installed browsers. */ }
  }
}

export async function browserDocument(input: string, options: { page?: number; format?: string; scale?: number; details?: boolean; executablePath?: string } = {}) {
  if (options.format !== undefined && !["png", "pdf"].includes(options.format)) throw new Error("HTML exports support PNG and PDF. Whole-page SVG export is not supported.");
  const scale = options.scale ?? 2;
  if (!Number.isFinite(scale) || scale <= 0 || scale > 8) throw new Error("Scale must be greater than 0 and at most 8.");
  if (options.executablePath !== undefined && !options.executablePath.trim()) throw new Error("The browser executable path must not be empty.");
  const server = await documentServer(input);
  let browser;
  try {
    const snapshot = await server.store.read();
    const selected = options.page;
    if (selected !== undefined && (!Number.isInteger(selected) || selected < 1 || selected > snapshot.pages.length))
      throw new Error(`Page must be an integer from 1 to ${snapshot.pages.length}.`);
    const executablePath = options.executablePath ?? await installedBrowser();
    try { browser = await chromium.launch({ headless: true, executablePath }); }
    catch {
      if (executablePath !== undefined)
        throw new Error(`Could not start Chrome or Chromium at ${JSON.stringify(executablePath)}. Check the executable path, Playwright compatibility, and system libraries, or select another browser with --browser-executable. No fallback browser was used.`);
      throw new Error("No installed Chrome or Chromium was found, and the pinned headless shell could not start. Install Chrome, run `konpeki browser install` to install the pinned headless shell, or use --browser-executable with an existing compatible Chrome or Chromium. Linux also needs Chromium's system libraries.");
    }
    const context = await browser.newContext({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: scale, serviceWorkers: "block" });
    // Local document assets plus Google Fonts; other external requests, including
    // those hidden in CSS, remain blocked.
    await context.route("**/*", route => {
      const request = route.request();
      return request.url().startsWith(`${server.origin}${server.prefix}/`) || isGoogleFontResource(request.url(), request.resourceType()) ? route.continue() : route.abort();
    });
    const tab = await context.newPage(), pages = [], diagnostics: Diagnostic[] = [];
    const cdp = await context.newCDPSession(tab);
    await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
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
      // CSS font-family and FontFaceSet cannot tell which font supplied a glyph.
      // Chromium can: inspect direct text children, retaining their nearest ID
      // even when an inline span has no ID. Include generated text as well.
      const { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "[data-konpeki-current]" });
      const { node } = await cdp.send("DOM.describeNode", { nodeId, depth: -1, pierce: true });
      const fallbacks = new Map<string, Set<string>>();
      async function auditFonts(node: typeof root, target: string) {
        if (node.nodeType !== 1) return;
        const attrs = node.attributes ?? [], idIndex = attrs.indexOf("id");
        if (idIndex >= 0) target = attrs[idIndex + 1];
        const { computedStyle } = await cdp.send("CSS.getComputedStyleForNode", { nodeId: node.nodeId });
        const style = Object.fromEntries(computedStyle.map(s => [s.name, s.value]));
        if (style.display === "none" || Number(style.opacity) === 0) return;
        if (style.visibility === "visible" && (node.pseudoType || node.children?.some(child => child.nodeType === 3 && child.nodeValue.trim()))) {
          const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId: node.nodeId });
          for (const font of fonts) if (font.glyphCount > 0 && !font.isCustomFont) {
            if (!fallbacks.has(target)) fallbacks.set(target, new Set());
            fallbacks.get(target)!.add(font.familyName);
          }
        }
        for (const child of [...node.children ?? [], ...node.pseudoElements ?? []]) await auditFonts(child, target);
      }
      await auditFonts(node, id);
      for (const [target, fonts] of fallbacks) report.diagnostics.push({ code: "font-fallback", severity: "error", page: id, target,
        message: `Text was drawn with installed fonts: ${[...fonts].join(", ")}. Load webfonts covering its families, styles, weights and glyphs from Google Fonts, local files or embedded data instead of relying on this machine.` });
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
