import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { createServer } from "vite";
import { chromium, type Page } from "playwright";
import { previewHTML } from "./server.ts";
import { inspectSource } from "./source.ts";
import { isGoogleFontResource } from "./document.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
async function clickTarget(tab: Page, page: string, id: string) {
  const rect = await tab.frameLocator(`iframe[title="${page}"]`).locator(`#${id}`).boundingBox();
  assert(rect);
  await tab.mouse.click(rect.x + 12, rect.y + 12);
}

test("Google Fonts allowlist does not allow unrelated origins, schemes or resource types", () => {
  assert(isGoogleFontResource("https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600", "stylesheet"));
  assert(isGoogleFontResource("https://fonts.gstatic.com/s/ibmplexsans/v1/font.woff2", "font"));
  for (const [url, type] of [
    ["http://fonts.googleapis.com/css2?family=Test", "stylesheet"],
    ["https://fonts.googleapis.com.evil.test/css2", "stylesheet"],
    ["https://fonts.googleapis.com@evil.test/css2", "stylesheet"],
    ["https://fonts.googleapis.com:444/css2", "stylesheet"],
    ["https://fonts.googleapis.com/css2", "script"],
    ["https://fonts.gstatic.com/s/font.woff2", "image"],
    ["https://fonts.gstatic.com/other/font.woff2", "font"],
    ["https://example.com/style.css", "stylesheet"],
  ]) assert.equal(isGoogleFontResource(url, type), false, url);
});

test("static preview works under a Pages base path, isolates comments, and clears only after copy", async t => {
  const server = await createServer({ root, base: "/konpeki/", logLevel: "silent", server: { port: 0, host: "127.0.0.1" } });
  await server.listen(); t.after(() => server.close());
  const address = server.httpServer!.address() as { port: number };
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch(); t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  const font = await readFile(new URL("../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2", import.meta.url));
  let styles = 0, fonts = 0;
  // Test font loading through the real CSP without depending on Google's uptime.
  await context.route("https://fonts.googleapis.com/**", route => {
    styles++;
    return route.fulfill({ contentType: "text/css", body: "@font-face{font-family:'IBM Plex Sans';font-weight:400 600;src:url(https://fonts.gstatic.com/s/test/font.woff2)}" });
  });
  await context.route("https://fonts.gstatic.com/**", route => {
    fonts++;
    return route.fulfill({ contentType: "font/woff2", headers: { "Access-Control-Allow-Origin": "*" }, body: font });
  });
  const tab = await context.newPage();
  const errors: string[] = [], api: string[] = [];
  tab.on("pageerror", error => errors.push(error.message));
  tab.on("request", request => { if (request.url().includes("/__konpeki/")) api.push(request.url()); });
  await tab.goto(`${origin}/konpeki/?example=cover`);
  await tab.frameLocator("iframe").locator("#cover-title").waitFor();
  await clickTarget(tab, "cover-page", "cover-title");
  await tab.getByRole("textbox", { name: "What should change?" }).fill("Shorten this headline.");
  await tab.getByRole("button", { name: "Add", exact: true }).click();
  await tab.reload();
  await tab.getByRole("button", { name: "Comment", exact: true }).click();
  assert.equal(await tab.getByRole("dialog").getByText("Shorten this headline.").count(), 1);
  await tab.evaluate(() => { Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: () => Promise.reject(new Error("Permission denied")) }); });
  await tab.getByRole("button", { name: "Copy & clear" }).click();
  await tab.getByRole("textbox", { name: "Prompt to copy" }).waitFor();
  assert.equal(await tab.locator(".review-count").textContent(), "1");
  assert.match(await tab.getByRole("textbox", { name: "Prompt to copy" }).inputValue(), /examples\/cover\/document.html[\s\S]*cover-title[\s\S]*Shorten this headline/);
  await tab.evaluate(() => { delete (navigator.clipboard as unknown as { writeText?: unknown }).writeText; });
  await tab.getByRole("button", { name: "Copy & clear" }).click();
  await tab.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(await tab.locator(".review-count").count(), 0);
  assert.match(await tab.evaluate(() => navigator.clipboard.readText()), /cover-title[\s\S]*Shorten this headline/);
  await tab.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(await tab.locator(".review-count").textContent(), "1");
  await tab.getByRole("combobox", { name: "Example" }).selectOption("data-brief");
  await tab.frameLocator("iframe").locator("#paid-bar").waitFor();
  assert.equal(await tab.locator(".review-count").count(), 0);
  const widths = await tab.frameLocator("iframe").locator("svg").evaluate(svg => ["initial-bar", "activated-bar", "not-activated-bar", "paid-bar", "free-bar", "left-bar"].map(id => Number(svg.querySelector(`#${id}`)!.getAttribute("width"))));
  assert.deepEqual(widths, [1000, 700, 300, 400, 300, 300]);
  await tab.getByRole("combobox", { name: "Example" }).selectOption("field-guide");
  await tab.frameLocator('iframe[title="the-worker"]').locator("#worker-title").waitFor();
  assert.equal(await tab.locator(".html-page").count(), 2);
  const frame = tab.frames().find(frame => frame.url().startsWith("blob:"))!;
  await frame.evaluate(() => document.fonts.ready);
  assert(styles > 0 && fonts > 0, "stylesheet and font must load through the preview CSP");
  assert.equal(await frame.evaluate(() => [...document.fonts].filter(f => f.family.includes("IBM Plex Sans")).some(f => f.status === "loaded")), true);
  await tab.getByRole("combobox", { name: "Example" }).selectOption("cover");
  await tab.locator(".review-count").waitFor();
  assert.equal(await tab.locator(".review-count").textContent(), "1");
  assert.deepEqual(errors, []);
  assert.deepEqual(api, [], "static hosting must never poll or PATCH a nonexistent API");
});

test("local HTML preview still saves moves, deletions and undo to the exact source", async t => {
  const dir = await mkdtemp(join(tmpdir(), "konpeki-preview-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = '<!doctype html><style>body{margin:0}[data-page]{width:800px;height:500px;padding:40px;box-sizing:border-box}p{width:300px;height:100px}</style><main id="page" data-page><p id="target">Move this paragraph.</p></main>';
  const file = join(dir, "document.html"); await writeFile(file, source);
  const preview = await previewHTML(file, "127.0.0.1", 0, root);
  t.after(() => preview.server.close());
  const browser = await chromium.launch(); t.after(() => browser.close());
  const tab = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await tab.goto(preview.url);
  await tab.frameLocator("iframe").locator("#target").waitFor();
  const rect = await tab.frameLocator("iframe").locator("#target").boundingBox(); assert(rect);
  await tab.mouse.move(rect.x + 15, rect.y + 15); await tab.mouse.down();
  await tab.mouse.move(rect.x + 38, rect.y + 32, { steps: 5 }); await tab.mouse.up();
  await tab.getByRole("status").getByText("Saved", { exact: true }).waitFor();
  assert.match(await readFile(file, "utf8"), /style="translate: [1-9][\d]*px [1-9][\d]*px;"/);
  await tab.keyboard.press("Control+z");
  await tab.waitForFunction(() => { const target = document.querySelector("iframe")?.contentDocument?.getElementById("target"); return target && !target.hasAttribute("style"); });
  assert.equal(await readFile(file, "utf8"), source);
  await clickTarget(tab, "page", "target"); await tab.keyboard.press("Delete");
  await tab.frameLocator("iframe").locator("#target").waitFor({ state: "detached" });
  assert.equal(inspectSource(await readFile(file, "utf8")).elements.some(el => el.attrs.some(a => a.name === "id" && a.value === "target")), false);
  await tab.keyboard.press("Control+z");
  await tab.frameLocator("iframe").locator("#target").waitFor();
  assert.equal(await readFile(file, "utf8"), source);
});
