import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createHTTPServer } from "node:http";
import { test } from "node:test";
import { createServer } from "vite";
import { chromium, type Page } from "playwright";
import { previewHTML } from "./server.ts";
import { inspectSource } from "./source.ts";
import { isGoogleFontResource } from "./document.ts";
import { hintLabels } from "./review-hints.ts";
import { testFontCSS } from "../scripts/test-fonts.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
async function waitForPage(tab: Page, page: string) {
  const surface = tab.locator(`.html-page[data-html-page="${page}"][aria-busy="false"]`);
  await surface.click({ trial: true }); // Wait for resources, saves and fitted geometry without selecting anything.
}
async function clickTarget(tab: Page, page: string, id: string, clickCount = 1) {
  await waitForPage(tab, page);
  const rect = await tab.frameLocator(`iframe[title="${page}"]`).locator(`#${id}`).boundingBox();
  assert(rect);
  await tab.mouse.click(rect.x + 12, rect.y + 12, { clickCount });
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
  // Two independent targets exercise review state without depending on showcase
  // documents. The unmodified packaged starter is exercised separately below.
  const fixture = '<!doctype html><link rel="stylesheet" href="theme.css"><style>p{margin-top:24px}</style><main id="cover-page" data-page data-size="link"><h1 id="cover-title">Editable heading</h1><p id="cover-summary">Supporting text for a second review target.</p></main>';
  const server = await createServer({ root, base: "/konpeki/", logLevel: "silent", server: { port: 0, host: "127.0.0.1" },
    plugins: [{ name: "review-test-document", enforce: "pre", load(id) {
      if (id === join(root, "skills/konpeki/assets/blank.html") + "?raw") return `export default ${JSON.stringify(fixture)}`;
    } }],
  });
  await server.listen(); t.after(() => server.close());
  const address = server.httpServer!.address() as { port: number };
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch(); t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  const external: string[] = [];
  await context.route(/^https?:\/\//, route => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1") return route.continue();
    external.push(route.request().url()); return route.abort("blockedbyclient");
  });
  const tab = await context.newPage();
  const errors: string[] = [], api: string[] = [];
  tab.on("pageerror", error => errors.push(error.message));
  tab.on("request", request => { if (request.url().includes("/__konpeki/")) api.push(request.url()); });
  let releaseFonts!: () => void;
  const fonts = new Promise<void>(resolve => { releaseFonts = resolve; });
  t.after(() => releaseFonts());
  await tab.route("https://fonts.googleapis.com/**", async route => {
    await fonts;
    await route.fulfill({ contentType: "text/css", body: testFontCSS });
  });
  await tab.goto(`${origin}/konpeki/`, { waitUntil: "domcontentloaded" });
  await tab.frameLocator("iframe").locator("#cover-title").waitFor();
  assert.equal(await tab.locator(".html-page").getAttribute("aria-busy"), "true", "visible text is not ready for selection while fonts are loading");
  const loadingTitle = await tab.frameLocator("iframe").locator("#cover-title").boundingBox(); assert(loadingTitle);
  await tab.mouse.click(loadingTitle.x + 12, loadingTitle.y + 12);
  assert.equal(await tab.locator(".html-outline").count(), 0, "loading geometry must not be selected");
  releaseFonts();
  await tab.getByRole("link", { name: "Authoring guide" }).focus();
  await tab.keyboard.press("Tab");
  assert.equal(await tab.getByRole("button", { name: "Keyboard shortcuts", exact: true }).evaluate(button => button === document.activeElement), true);
  await tab.keyboard.press("Tab");
  assert.equal(await tab.locator(".html-page").evaluate(page => page === document.activeElement), true);
  assert.notEqual(await tab.locator(".html-page").evaluate(page => getComputedStyle(page).outlineStyle), "none", "keyboard navigation retains the page focus indicator");
  await clickTarget(tab, "cover-page", "cover-title");
  await tab.locator(".html-outline").waitFor();
  assert.equal(await tab.locator(".html-page").evaluate(page => getComputedStyle(page).outlineStyle), "none", "component selection must not also outline its page");
  assert.equal(await tab.getByRole("dialog").count(), 0, "one click selects without opening notes");
  await tab.keyboard.press("Delete");
  assert.equal(await tab.frameLocator("iframe").locator("#cover-title").count(), 1, "static selection must not enable source corrections");
  await tab.keyboard.press("Enter");
  await tab.getByRole("dialog", { name: "Add comment" }).waitFor();
  assert.equal(await tab.locator(".revision-note-scope").textContent(), "cover-title", "Enter comments on the selected component");
  assert.equal(await tab.getByRole("textbox", { name: "What should change?" }).evaluate(input => input === document.activeElement), true);
  await tab.keyboard.press("Escape");
  assert.equal(await tab.locator(".html-outline").count(), 1, "first Escape closes only the composer");
  assert.equal(await tab.locator(".html-page").evaluate(page => page === document.activeElement), true);
  await tab.keyboard.press("Escape");
  assert.equal(await tab.locator(".html-outline").count(), 0, "second Escape clears selection");
  assert.equal(await tab.locator(".html-page").evaluate(page => getComputedStyle(page).outlineStyle), "none", "Escape must not leave a whole-page focus ring");
  await clickTarget(tab, "cover-page", "cover-title");
  await tab.getByRole("heading", { name: "Konpeki", exact: true }).click();
  assert.equal(await tab.locator(".html-outline").count(), 0, "outside click deselects");
  await clickTarget(tab, "cover-page", "cover-summary");
  await clickTarget(tab, "cover-page", "cover-title", 2);
  await tab.getByRole("dialog", { name: "Add comment" }).waitFor();
  assert.equal(await tab.locator(".revision-note-scope").textContent(), "cover-title", "double-click opens notes for the hit component, not the previous selection");
  assert.equal(await tab.locator(".html-outline").count(), 1);
  assert.equal(await tab.evaluate(() => window.getSelection()?.isCollapsed), true);
  await tab.keyboard.press("Escape");
  assert.equal(await tab.getByRole("dialog").count(), 0);
  await clickTarget(tab, "cover-page", "cover-page", 2);
  assert.equal(await tab.getByRole("dialog").count(), 0, "double-clicking blank paper must not open page notes");
  assert.equal(await tab.locator(".html-outline").count(), 0);
  assert.equal(await tab.evaluate(() => window.getSelection()?.isCollapsed), true, "double-click must not select the iframe");
  await tab.keyboard.press("c");
  assert.equal(await tab.getByRole("button", { name: "Comment", exact: true }).getAttribute("aria-pressed"), "true", "C without selection starts target picking");
  await tab.keyboard.press("Escape");
  assert.equal(await tab.getByRole("button", { name: "Comment", exact: true }).getAttribute("aria-pressed"), "false");
  await tab.getByRole("button", { name: "Comment", exact: true }).click();
  await clickTarget(tab, "cover-page", "cover-page");
  await tab.getByRole("dialog", { name: "Add comment" }).waitFor();
  assert.equal(await tab.locator(".revision-note-scope").textContent(), "cover-page", "explicit review mode still supports page comments");
  await tab.keyboard.press("Escape");
  assert.equal(await tab.getByRole("dialog").count(), 0, "Escape dismisses an empty composer with textarea focus");
  assert.equal(await tab.getByRole("button", { name: "Comment", exact: true }).evaluate(button => button === document.activeElement), true);
  await tab.getByRole("button", { name: "Comment", exact: true }).click();
  await clickTarget(tab, "cover-page", "cover-title");
  await tab.getByRole("textbox", { name: "What should change?" }).fill("Shorten this headline.");
  await tab.getByRole("textbox", { name: "What should change?" }).dispatchEvent("keydown", { key: "Escape", isComposing: true });
  assert.equal(await tab.getByRole("dialog").count(), 1, "Escape used by an IME must not dismiss the draft");
  await tab.keyboard.press("Escape");
  assert.equal(await tab.getByRole("dialog").count(), 0);
  await tab.getByRole("button", { name: "Comment", exact: true }).click();
  assert.equal(await tab.locator(".revision-note-scope").textContent(), "cover-title", "the launcher uses the existing selection without another target click");
  assert.equal(await tab.getByRole("textbox", { name: "What should change?" }).inputValue(), "Shorten this headline.", "Escape preserves unfinished drafts");
  await tab.getByRole("heading", { name: "Konpeki", exact: true }).click();
  assert.equal(await tab.getByRole("dialog").count(), 0, "outside click dismisses a nonempty draft");
  await clickTarget(tab, "cover-page", "cover-summary");
  await tab.keyboard.press("c");
  assert.equal(await tab.locator(".revision-note-scope").textContent(), "cover-summary");
  assert.equal(await tab.getByRole("textbox", { name: "What should change?" }).inputValue(), "", "drafts stay with their target");
  await tab.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await tab.locator(".html-page").evaluate(page => page === document.activeElement), true);
  await clickTarget(tab, "cover-page", "cover-title");
  await tab.keyboard.press("c");
  assert.equal(await tab.getByRole("textbox", { name: "What should change?" }).inputValue(), "Shorten this headline.", "outside click also preserves drafts");
  await tab.getByRole("textbox", { name: "What should change?" }).dispatchEvent("keydown", { key: "Enter", ctrlKey: true, isComposing: true });
  assert.equal(await tab.locator(".review-count").count(), 0, "IME confirmation must not submit a comment");
  await tab.getByRole("textbox", { name: "What should change?" }).dispatchEvent("keydown", { key: "Enter", ctrlKey: true, repeat: true });
  assert.equal(await tab.locator(".review-count").count(), 0, "a held shortcut must not submit repeatedly");
  await tab.keyboard.down("Control"); await tab.keyboard.down("Enter");
  await tab.getByRole("dialog", { name: "Pending reviews" }).waitFor();
  assert.equal(await tab.getByRole("button", { name: "Copy & clear" }).evaluate(button => button === document.activeElement), true, "submission focuses the primary queue action");
  await tab.keyboard.down("Enter");
  await tab.keyboard.up("Enter"); await tab.keyboard.up("Control");
  assert.equal(await tab.getByRole("dialog", { name: "Pending reviews" }).count(), 1, "holding the submit shortcut must not also copy and clear the queue");
  for (const width of [390, 1280]) {
    await tab.setViewportSize({ width, height: 900 });
    const geometry = await tab.locator(".revision-note-list li").evaluate(li => {
      const button = li.querySelector("button")!.getBoundingClientRect(), icon = li.querySelector("svg")!.getBoundingClientRect();
      const badge = li.querySelector(".revision-note-number")!.getBoundingClientRect(), label = li.querySelector(".revision-note-label")!.getBoundingClientRect();
      const count = document.querySelector<HTMLElement>(".review-count")!;
      return { button: [button.width, button.height], count: [count.offsetWidth, count.offsetHeight], offsets: [icon.x + icon.width / 2 - button.x - button.width / 2, icon.y + icon.height / 2 - button.y - button.height / 2, badge.y + badge.height / 2 - button.y - button.height / 2, label.y + label.height / 2 - button.y - button.height / 2] };
    });
    assert.deepEqual(geometry.button, width < 600 ? [32, 32] : [28, 28]);
    assert.deepEqual(geometry.count, [24, 24], "single-digit counts must be circular");
    assert(geometry.offsets.every(offset => Math.abs(offset) < .5), "remove icon, badge and title must share a centerline");
  }
  await tab.locator(".html-pin").hover();
  await tab.waitForFunction(() => getComputedStyle(document.querySelector(".html-pin")!).backgroundColor === "rgb(0, 109, 167)");
  assert.deepEqual(await tab.locator(".html-pin").evaluate(pin => { const style = getComputedStyle(pin); return [style.color, style.borderColor]; }), ["rgb(255, 255, 255)", "rgb(255, 255, 255)"], "hover must preserve the white number and border");
  await clickTarget(tab, "cover-page", "cover-summary");
  assert.equal(await tab.getByRole("dialog").count(), 0, "clicking a component dismisses a nonempty queue");
  await tab.keyboard.press("Enter");
  assert.equal(await tab.locator(".revision-note-scope").textContent(), "cover-summary", "the same click selects the next component");
  await tab.keyboard.press("Escape");
  await tab.getByRole("button", { name: "Comment", exact: true }).click();
  await tab.keyboard.press("Escape");
  assert.equal(await tab.getByRole("dialog").count(), 0, "Escape dismisses the queue with button focus");
  assert.equal(await tab.locator(".review-count").textContent(), "1", "dismissing the queue must not remove comments");
  await tab.getByRole("button", { name: "Comment on cover-title", exact: true }).click();
  await tab.getByRole("dialog", { name: "Add comment" }).waitFor();
  assert.equal(await tab.locator(".revision-note-scope").textContent(), "cover-title", "comment pins still open their target's notes");
  await tab.reload();
  await tab.getByRole("button", { name: "Comment", exact: true }).click();
  assert.equal(await tab.getByRole("dialog").getByText("Shorten this headline.").count(), 1);
  await tab.evaluate(() => { Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: () => Promise.reject(new Error("Permission denied")) }); });
  await tab.getByRole("button", { name: "Copy & clear" }).click();
  await tab.getByRole("textbox", { name: "Prompt to copy" }).waitFor();
  assert.equal(await tab.getByRole("textbox", { name: "Prompt to copy" }).evaluate((input: HTMLTextAreaElement) => input === document.activeElement && input.selectionStart === 0 && input.selectionEnd === input.value.length), true, "clipboard failure focuses and selects the recoverable prompt");
  const dismissGeometry = await tab.getByRole("button", { name: "Dismiss error" }).evaluate(button => {
    const bounds = button.getBoundingClientRect(), icon = button.querySelector("svg")!.getBoundingClientRect();
    return [bounds.width, bounds.height, icon.x + icon.width / 2 - bounds.x - bounds.width / 2, icon.y + icon.height / 2 - bounds.y - bounds.height / 2];
  });
  assert(dismissGeometry.every((value, index) => Math.abs(value - (index < 2 ? 36 : 0)) < .5), "error dismissal also uses a square, centered icon control");
  assert.equal(await tab.locator(".review-count").textContent(), "1");
  assert.match(await tab.getByRole("textbox", { name: "Prompt to copy" }).inputValue(), /skills\/konpeki\/assets\/blank.html[\s\S]*cover-title[\s\S]*Shorten this headline/);
  await tab.evaluate(() => { delete (navigator.clipboard as unknown as { writeText?: unknown }).writeText; });
  await tab.getByRole("button", { name: "Copy & clear" }).click();
  await tab.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(await tab.getByRole("button", { name: "Comment", exact: true }).evaluate(button => button === document.activeElement), true, "copying restores focus after re-enabling the launcher");
  assert.equal(await tab.locator(".review-count").count(), 0);
  assert.match(await tab.evaluate(() => navigator.clipboard.readText()), /cover-title[\s\S]*Shorten this headline/);
  await tab.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(await tab.locator(".review-count").textContent(), "1");
  assert.deepEqual(external, [], "preview must not request external resources beyond Google Fonts");
  await tab.getByRole("button", { name: "Comment", exact: true }).click();
  await tab.getByRole("button", { name: "Remove comment 1" }).click();
  assert.equal(await tab.getByRole("button", { name: "New comment" }).evaluate(button => button === document.activeElement), true, "an empty queue focuses its remaining action");
  assert.deepEqual(errors, []);
  assert.deepEqual(api, [], "static hosting must never poll or PATCH a nonexistent API");
});

test("local HTML preview still saves moves, deletions and undo to the exact source", async t => {
  const dir = await mkdtemp(join(tmpdir(), "konpeki-preview-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = '<!doctype html><style>body{margin:0}[data-page]{width:800px;height:500px;padding:40px;box-sizing:border-box}p{width:300px;height:100px}</style><main id="page" data-page><p id="target" style="color: #1d4ed8; margin-top: 30px">Move this paragraph.</p></main>';
  const file = join(dir, "document.html"); await writeFile(file, source);
  const preview = await previewHTML(file, "127.0.0.1", 0, root);
  t.after(() => preview.server.close());
  const browser = await chromium.launch(); t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  const tab = await context.newPage();
  await tab.goto(preview.url);
  await tab.frameLocator("iframe").locator("#target").waitFor();
  await clickTarget(tab, "page", "target", 2);
  await tab.getByRole("dialog", { name: "Add comment" }).waitFor();
  assert.equal(await tab.locator(".revision-note-scope").textContent(), "target");
  assert.equal(await tab.locator(".html-outline").count(), 1);
  assert.equal(await readFile(file, "utf8"), source, "double-click must not save a move");
  await tab.keyboard.press("Escape");
  assert.equal(await tab.getByRole("dialog").count(), 0);
  const rect = await tab.frameLocator("iframe").locator("#target").boundingBox(); assert(rect);
  await tab.mouse.move(rect.x + 15, rect.y + 15); await tab.mouse.down();
  await tab.mouse.move(rect.x + 38, rect.y + 32, { steps: 5 }); await tab.mouse.up();
  await tab.getByRole("status").getByText("Saved", { exact: true }).waitFor();
  assert.match(await readFile(file, "utf8"), /style="color: #1d4ed8; margin-top: 30px;? translate: [1-9][\d]*px [1-9][\d]*px;"/);
  await waitForPage(tab, "page");
  await tab.keyboard.press("Control+z");
  await tab.waitForFunction(() => { const target = document.querySelector("iframe")?.contentDocument?.getElementById("target"); return target && !target.style.translate; });
  assert.equal(await readFile(file, "utf8"), source);
  await waitForPage(tab, "page");
  const horizontal = await tab.frameLocator("iframe").locator("#target").boundingBox(); assert(horizontal);
  const saved = tab.waitForResponse(response => response.request().method() === "PATCH");
  await tab.mouse.move(horizontal.x + 15, horizontal.y + 15); await tab.mouse.down();
  await tab.mouse.move(horizontal.x + 50, horizontal.y + 15, { steps: 5 }); await tab.mouse.up();
  assert.equal((await saved).status(), 200, "horizontal moves must retain the zero y coordinate in the payload");
  assert.match(await readFile(file, "utf8"), /translate: [1-9][\d]*px 0px;/);
  await waitForPage(tab, "page");
  await tab.keyboard.press("Control+z");
  await tab.waitForFunction(() => { const target = document.querySelector("iframe")?.contentDocument?.getElementById("target"); return target && !target.style.translate; });
  assert.equal(await readFile(file, "utf8"), source);
  await clickTarget(tab, "page", "target"); await tab.keyboard.press("c");
  await tab.getByRole("textbox", { name: "What should change?" }).fill("Keep the exact source path.");
  await tab.keyboard.press("Control+Enter");
  await tab.getByRole("button", { name: "Copy & clear" }).click();
  const copied = await tab.evaluate(() => navigator.clipboard.readText());
  assert.match(copied, new RegExp(`Revise the HTML document ${JSON.stringify(file).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  await clickTarget(tab, "page", "target"); await tab.keyboard.press("Delete");
  await tab.frameLocator("iframe").locator("#target").waitFor({ state: "detached" });
  assert.equal(inspectSource(await readFile(file, "utf8")).elements.some(el => el.attrs.some(a => a.name === "id" && a.value === "target")), false);
  await waitForPage(tab, "page");
  await tab.keyboard.press("Control+z");
  await tab.frameLocator("iframe").locator("#target").waitFor();
  assert.equal(await readFile(file, "utf8"), source);
});

test("preview falls back from a busy default port but explicit ports are strict", async t => {
  const blocker = createHTTPServer((_req, res) => res.end("busy"));
  await new Promise<void>((resolve, reject) => blocker.listen(0, "127.0.0.1", resolve).once("error", reject));
  t.after(() => new Promise<void>(resolve => blocker.close(() => resolve())));
  const port = (blocker.address() as { port: number }).port;
  const dir = await mkdtemp(join(tmpdir(), "konpeki-port-test-")); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "document.html");
  await writeFile(file, '<main id="page" data-page style="width:100px;height:100px"></main>');
  const fallback = await previewHTML(file, "127.0.0.1", port, root);
  t.after(() => fallback.server.close());
  assert.notEqual(new URL(fallback.url).port, String(port));
  await assert.rejects(previewHTML(file, "127.0.0.1", port, root, true), /already in use|EADDRINUSE/i);
});

test("packaged starter renders the default theme without external examples or missing assets", async t => {
  const server = await createServer({ root, base: "/konpeki/", logLevel: "silent", server: { port: 0, host: "127.0.0.1" } });
  await server.listen(); t.after(() => server.close());
  const origin = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}/konpeki/`;
  const browser = await chromium.launch(); t.after(() => browser.close());
  const tab = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await tab.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: testFontCSS }));
  const failures: string[] = [];
  tab.on("pageerror", error => failures.push(error.message));
  tab.on("response", response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  await tab.goto(origin);
  await waitForPage(tab, "page-1");
  assert.equal(await tab.locator(".html-page").count(), 1);
  assert.deepEqual(await tab.locator(".html-diagnostics li").allTextContents(), []);
  const style = await tab.frameLocator("iframe").locator("#title").evaluate(el => {
    const s = getComputedStyle(el); return [el.textContent, s.fontFamily, s.fontSize];
  });
  assert.deepEqual(style, ["Untitled visual", '"IBM Plex Sans", sans-serif', "72px"]);
  assert.equal(await tab.getByRole("combobox", { name: "Theme" }).count(), 0);
  assert.equal(await tab.getByRole("combobox", { name: "Example" }).count(), 0);
  assert.equal(await tab.getByRole("link", { name: "Authoring guide" }).getAttribute("href"), "https://github.com/vcfgdev/konpeki/blob/main/html/README.md");
  assert.equal(await tab.locator('a[href*="vcfgdev/wf"]').count(), 0, "public preview must not direct users to a private workspace");
  assert.equal(await tab.locator('a[href*="brand-conversion"]').count(), 0);
  assert.deepEqual(failures, []);
});

test("hint codes remain unique and prefix-free across alphabet boundaries", () => {
  assert.deepEqual(hintLabels(0), []);
  assert.deepEqual(hintLabels(9), ["a", "s", "d", "f", "g", "h", "j", "k", "l"]);
  assert.deepEqual(hintLabels(10), ["aa", "as", "ad", "af", "ag", "ah", "aj", "ak", "al", "sa"]);
  assert.equal(hintLabels(81).at(-1), "ll");
  assert.equal(hintLabels(82).at(-1), "saa");
  for (const count of [1, 9, 10, 81, 82, 730]) {
    const labels = hintLabels(count);
    assert.equal(new Set(labels).size, count);
    assert.equal(new Set(labels.map(label => label.length)).size, 1);
  }
});

test("Vim review supports hints, mixed-page navigation, drafts and deliberate queue export", async t => {
  const fixture = `<!doctype html><style>
    body { margin: 0 } [data-page] { position: relative; box-sizing: border-box; width: 960px; height: 540px; padding: 40px; font: 24px sans-serif }
    h1, p { margin: 0 } .items { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-top: 40px }
    #portrait { width: 450px; height: 900px } #last-page { width: 700px; height: 400px }
  </style><main id="first-page" data-page data-theme="custom"><section id="group"><h1 id="first-title">Review this heading</h1><p id="summary">Supporting text</p></section>
    <div class="items">${Array.from({ length: 7 }, (_, i) => `<p id="item-${i}">Item ${i}</p>`).join("")}</div>
    <p id="hidden" hidden>Hidden</p><p id="transparent" style="opacity:0">Transparent</p><p id="offscreen" style="position:absolute;left:1500px">Outside page</p>
  </main><main id="portrait" data-page data-theme="custom"><h1 id="second-title">Portrait target</h1></main><main id="last-page" data-page data-theme="custom"><h1 id="last-title">Last target</h1></main>`;
  const server = await createServer({ root, base: "/konpeki/", logLevel: "silent", server: { port: 0, host: "127.0.0.1" },
    plugins: [{ name: "keyboard-review-fixture", enforce: "pre", load(id) {
      if (id === join(root, "skills/konpeki/assets/blank.html") + "?raw") return `export default ${JSON.stringify(fixture)}`;
    } }],
  });
  await server.listen(); t.after(() => server.close());
  const browser = await chromium.launch(); t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  // Exercise the Mac label branch in Chromium without claiming native macOS rendering.
  await context.addInitScript(() => Object.defineProperty(navigator, "platform", { value: "MacIntel" }));
  const tab = await context.newPage(), errors: string[] = [];
  tab.on("pageerror", error => errors.push(error.message));
  await tab.goto(`http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}/konpeki/`);
  await tab.waitForFunction(() => document.querySelectorAll('.html-page[aria-busy="false"]').length === 3);
  const status = tab.locator(".review-status"), hints = tab.locator(".review-hint"), input = tab.getByRole("textbox", { name: "What should change?" });
  const position = () => tab.locator(".workspace").evaluate(el => [el.scrollLeft, el.scrollTop]);
  const zoom = () => tab.locator(".page-board-content").evaluate(el => Number((el as HTMLElement).style.zoom));
  const settleZoom = () => tab.waitForFunction(() => !document.querySelector("[data-zooming]"));
  await tab.keyboard.press("f");
  assert.equal(await hints.count(), 0, "letter commands are opt-in");
  await tab.keyboard.press("?");
  await tab.getByRole("checkbox", { name: "Vim review mode" }).check();
  await tab.keyboard.press("Escape");
  assert.match(await status.innerText(), /NORMAL.*Page 1 \/ 3/s);
  assert.equal(await tab.evaluate(() => localStorage.getItem("html-review:vim")), "true");
  await tab.keyboard.press("f");
  await hints.first().waitFor(); // Key dispatch can finish before React commits the overlay.
  assert.equal(await hints.count(), 10, "only visible ID targets from the active page receive hints");
  await tab.locator(".workspace").dispatchEvent("scroll");
  assert.equal(await hints.count(), 10, "a delayed scroll event at the measured position must not cancel fresh hints");
  const original = await hints.evaluateAll(elements => elements.map(el => [el.getAttribute("data-target"), el.textContent]));
  assert.deepEqual(original.slice(0, 3), [["group", "aa"], ["first-title", "as"], ["summary", "ad"]]);
  const boxes = await hints.evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    assert(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top, "nested targets must not share a badge position");
  }
  await tab.keyboard.press("a");
  assert.equal(await hints.count(), 9);
  await tab.keyboard.press("z");
  assert.equal(await hints.count(), 9, "an invalid hint letter must not leak into canvas commands");
  await tab.keyboard.press("Backspace");
  assert.deepEqual(await hints.evaluateAll(elements => elements.map(el => [el.getAttribute("data-target"), el.textContent])), original, "filtering must not reassign codes");
  const beforeComment = await position();
  await tab.keyboard.type("as");
  assert.equal(await tab.locator(".revision-note-scope").textContent(), "first-title");
  assert.equal(await tab.locator(".comment-composer .primary kbd").textContent(), "⌘ Enter");
  assert.equal(await tab.locator(".comment-composer .primary kbd").evaluate(el => getComputedStyle(el).fontSize), "12px", "shortcut labels must not shrink into tiny symbols");
  assert.equal(await input.evaluate(el => el === document.activeElement), true);
  await input.fill("Shorten this headline. ");
  await tab.keyboard.type("fjk?q[]0");
  assert.equal(await input.inputValue(), "Shorten this headline. fjk?q[]0", "shortcuts stay literal while typing");
  await input.dispatchEvent("keydown", { key: "Escape", isComposing: true });
  await input.dispatchEvent("keydown", { key: "Enter", ctrlKey: true, isComposing: true });
  await input.dispatchEvent("keydown", { key: "Enter", ctrlKey: true, keyCode: 229 });
  await input.dispatchEvent("keydown", { key: "Enter", ctrlKey: true, repeat: true });
  assert.equal(await tab.locator(".review-count").count(), 0);
  assert.equal(await input.isVisible(), true, "IME confirmation must neither submit nor dismiss");
  await tab.keyboard.press("Escape");
  await tab.keyboard.press("c");
  assert.equal(await input.inputValue(), "Shorten this headline. fjk?q[]0", "Escape preserves the target's draft");
  await input.fill("Shorten this headline.");
  await tab.keyboard.down("Control"); await tab.keyboard.down("Enter");
  await input.waitFor({ state: "hidden" });
  await tab.keyboard.down("Enter"); await tab.keyboard.up("Enter"); await tab.keyboard.up("Control");
  assert.equal(await tab.locator(".review-count").textContent(), "1");
  assert.equal(await tab.getByRole("dialog", { name: "Pending reviews" }).count(), 0, "submit returns to the canvas, not the export action");
  assert.deepEqual(await position(), beforeComment, "submission preserves the viewport");
  assert.equal(await tab.locator('.html-page[data-html-page="first-page"]').evaluate(el => el === document.activeElement), true);

  await tab.keyboard.press("="); await tab.keyboard.press("="); await settleZoom();
  assert.equal(await zoom(), 1.44);
  await tab.keyboard.press("]");
  assert.match(await status.innerText(), /Page 2 \/ 3/);
  assert.equal(await zoom(), 1.44, "navigation retains zoom even across aspect ratios");
  const panned = await position();
  await tab.keyboard.press("j");
  assert((await position())[1] > panned[1]);
  await tab.keyboard.press("k");
  assert.deepEqual(await position(), panned);
  await tab.keyboard.press("l");
  assert((await position())[0] > panned[0]);
  await tab.keyboard.press("h");
  assert.deepEqual(await position(), panned);
  await tab.keyboard.press("-"); await tab.keyboard.press("-"); await settleZoom();
  assert.equal(await zoom(), 1);
  await tab.keyboard.press("G");
  assert.match(await status.innerText(), /Page 3 \/ 3/);
  await tab.keyboard.press("]");
  assert.match(await status.innerText(), /Page 3 \/ 3/, "last-page navigation clamps");
  await tab.keyboard.type("gg");
  assert.match(await status.innerText(), /Page 1 \/ 3/);
  await tab.keyboard.press("[");
  assert.match(await status.innerText(), /Page 1 \/ 3/, "first-page navigation clamps");
  await tab.keyboard.press("]");
  await tab.keyboard.press("+"); await settleZoom();
  await tab.keyboard.press("0");
  assert.equal(await zoom(), 1);
  const fit = await tab.locator('.board-page[data-page="portrait"]').boundingBox(); assert(fit);
  assert(fit.y >= 0 && fit.y + fit.height <= 900 && fit.x >= 0 && fit.x + fit.width <= 1280, "fit contains the whole portrait page");
  await tab.keyboard.press("C");
  assert.equal(await tab.locator(".revision-note-scope").textContent(), "portrait");
  await tab.keyboard.press("Escape");
  await tab.keyboard.press("f");
  assert.deepEqual(await hints.allTextContents(), ["a"]);
  await tab.keyboard.press("a");
  await input.fill("Explain the portrait example.");
  await tab.keyboard.press("Meta+Enter");
  assert.equal(await tab.locator(".review-count").textContent(), "2", "both Mac and Ctrl submit bindings work");
  await tab.keyboard.press("q");
  const queue = tab.getByRole("dialog", { name: "Pending reviews" });
  await queue.waitFor();
  assert.equal(await queue.locator(".primary kbd").textContent(), "⌘ Enter");
  assert.match(await queue.locator(".review-queue-heading").innerText(), /Enter locate/);
  assert.equal(await queue.locator(".revision-note-target").first().evaluate(el => el === document.activeElement), true);
  const queuePosition = await position();
  await tab.keyboard.press("j");
  assert.equal(await queue.locator(".revision-note-target").nth(1).evaluate(el => el === document.activeElement), true);
  await tab.keyboard.press("k");
  assert.deepEqual(await position(), queuePosition, "queue navigation must not pan the board");
  await tab.keyboard.press("Enter");
  assert.equal(await tab.locator(".revision-note-scope").textContent(), "first-title");
  assert.match(await status.innerText(), /Page 1 \/ 3/);
  assert.match(await tab.getByRole("dialog", { name: "Add comment" }).innerText(), /Shorten this headline/);
  await tab.keyboard.press("Escape");
  await queue.waitFor();
  await queue.dispatchEvent("keydown", { key: "Enter", ctrlKey: true, repeat: true });
  await queue.dispatchEvent("keydown", { key: "Enter", ctrlKey: true, isComposing: true });
  assert.equal(await tab.locator(".review-count").textContent(), "2", "repeat and IME events cannot export");
  await tab.evaluate(() => Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: () => Promise.reject(new Error("Permission denied")) }));
  await tab.keyboard.press("Control+Enter");
  await tab.getByRole("textbox", { name: "Prompt to copy" }).waitFor();
  assert.equal(await tab.locator(".review-count").textContent(), "2", "failed copying preserves every comment");
  await tab.evaluate(() => { delete (navigator.clipboard as unknown as { writeText?: unknown }).writeText; });
  await tab.keyboard.press("Control+Enter");
  await queue.waitFor({ state: "hidden" });
  assert.equal(await tab.locator(".review-count").count(), 0);
  const copied = await tab.evaluate(() => navigator.clipboard.readText());
  assert.match(copied, /Page: "first-page"\nElement: "first-title"\nComment:\nShorten this headline\./);
  assert.match(copied, /Page: "portrait"\nElement: "second-title"\nComment:\nExplain the portrait example\./);
  await tab.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(await tab.locator(".review-count").textContent(), "2");
  await tab.keyboard.press("f"); await hints.first().waitFor();
  await tab.setViewportSize({ width: 1000, height: 800 });
  await hints.first().waitFor({ state: "hidden" });
  assert.equal(await hints.count(), 0, "viewport changes invalidate hint positions");
  await tab.keyboard.press("0");
  await tab.keyboard.press("=");
  await tab.keyboard.press("f");
  await hints.first().waitFor();
  assert.equal(await tab.locator("[data-zooming]").count(), 0, "hinting freezes an in-flight zoom rather than dropping the f command");
  const frozenPosition = await position(), frozenZoom = await zoom();
  await tab.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert(await hints.count() > 0);
  assert.deepEqual(await position(), frozenPosition);
  assert.equal(await zoom(), frozenZoom);
  await tab.reload();
  await tab.waitForFunction(() => document.querySelectorAll('.html-page[aria-busy="false"]').length === 3);
  assert.equal(await status.isVisible(), true, "mode preference survives reload");
  assert.equal(await tab.locator(".review-count").textContent(), "2", "comments survive reload separately from mode preference");
  await tab.keyboard.press("?");
  await tab.getByRole("checkbox", { name: "Vim review mode" }).uncheck();
  await tab.keyboard.press("Escape");
  await tab.keyboard.press("f");
  assert.equal(await status.count(), 0);
  assert.equal(await hints.count(), 0);
  assert.deepEqual(errors, []);
});

test("live source changes invalidate hints without retargeting saved comments or deleting source", async t => {
  const dir = await mkdtemp(join(tmpdir(), "konpeki-vim-live-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "document.html");
  const source = '<!doctype html><style>body{margin:0}main{width:800px;height:500px;padding:40px;box-sizing:border-box}h1{font:40px sans-serif}p{font:24px sans-serif}</style><main id="page" data-page data-theme="custom"><h1 id="old-title">Original title</h1><p id="summary">Supporting text</p></main>';
  await writeFile(file, source);
  const preview = await previewHTML(file, "127.0.0.1", 0, root);
  t.after(() => preview.server.close());
  const browser = await chromium.launch(); t.after(() => browser.close());
  const tab = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const patches: string[] = [];
  tab.on("request", request => { if (request.method() === "PATCH") patches.push(request.url()); });
  await tab.addInitScript(() => localStorage.setItem("html-review:vim", "true"));
  await tab.goto(preview.url);
  await waitForPage(tab, "page");
  await tab.keyboard.press("f"); await tab.keyboard.press("a");
  await tab.getByRole("textbox", { name: "What should change?" }).fill("Keep this note attached to the original ID.");
  await tab.keyboard.press("Control+Enter");
  await tab.keyboard.press("f");
  await tab.keyboard.press("Backspace");
  assert.equal(await readFile(file, "utf8"), source, "Backspace edits a hint prefix, never the selected source element");
  const revised = source.replace('id="old-title"', 'id="new-title"');
  await writeFile(file, revised);
  await tab.frameLocator("iframe").locator("#new-title").waitFor();
  await tab.locator(".review-hint").first().waitFor({ state: "hidden" });
  await tab.keyboard.press("q"); await tab.keyboard.press("Enter");
  assert.match(await tab.getByRole("status").innerText(), /target is unavailable/);
  assert.equal(await tab.getByRole("dialog", { name: "Add comment" }).count(), 0);
  assert.match(await tab.getByRole("dialog", { name: "Pending reviews" }).innerText(), /old-title/);
  assert.equal(await tab.locator(".review-count").textContent(), "1");
  await tab.keyboard.press("Escape");
  await waitForPage(tab, "page");
  await tab.keyboard.press("f");
  assert.equal(await tab.locator('.review-hint[data-target="new-title"]').textContent(), "a");
  assert.deepEqual(patches, [], "review-only commands must not mutate the document");
  assert.equal(await readFile(file, "utf8"), revised);
});
