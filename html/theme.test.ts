import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { documentServer } from "./server.ts";
import { browserDocument } from "./browser.ts";
import { inspectHTMLPage } from "./inspect.ts";

const root = fileURLToPath(new URL("../", import.meta.url));

test("portable starter loads bundled fonts and preserves page scales and the light-blue theme", async t => {
  const dir = await mkdtemp(join(tmpdir(), "konpeki-theme-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "document.html");
  const prepare = join(root, "skills/konpeki/scripts/prepare-document.mjs");
  const cli = join(root, "bin/konpeki.mjs");
  execFileSync(process.execPath, [prepare, cli, file], { stdio: "pipe" });
  for (const asset of ["theme.css", "theme-base.css", "fonts/OFL.txt", "fonts/plex-mono-OFL.txt", "fonts/ibm-plex-mono-latin-400-normal.woff2", ...[400, 600, 700].map(w => `fonts/ibm-plex-sans-latin-${w}-normal.woff2`)])
    assert.deepEqual(await readFile(join(dir, asset)), await readFile(join(root, asset)), asset);
  const before = await readFile(file, "utf8");
  assert.equal(JSON.parse(execFileSync(process.execPath, [prepare, cli, file], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })).created, false);
  assert.equal(await readFile(file, "utf8"), before);
  const browser = await chromium.launch(); t.after(() => browser.close());
  const server = await documentServer(file); t.after(() => server.close());
  const tab = await browser.newPage();
  const external: string[] = [];
  await tab.route("**/*", route => {
    if (route.request().url().startsWith(server.origin)) return route.continue();
    external.push(route.request().url()); return route.abort();
  });
  await tab.goto(`${server.origin}${server.prefix}/document/`);
  await tab.evaluate(() => document.fonts.ready);
  assert.equal(await tab.evaluate(() => [...document.fonts].some(f => f.family === "IBM Plex Sans" && f.weight === "600" && f.status === "loaded")), true);
  const page = tab.locator("[data-page]");
  const presets = [
    ["presentation", 1920, 1080, [20, 24, 28, 36, 44, 60, 76]],
    ["portrait", 1080, 1350, [18, 22, 28, 34, 44, 60, 76]],
    ["square", 1080, 1080, [18, 22, 28, 34, 44, 60, 76]],
    ["link", 1200, 630, [16, 20, 24, 30, 40, 52, 64]],
    ["article", 1600, 600, [18, 22, 28, 34, 44, 56, 72]],
    ["a4", 210 / 25.4 * 96, 297 / 25.4 * 96, [10, 12, 14, 18, 24, 32, 44]],
    ["explainer", 1200, 1600, [20, 24, 28, 36, 44, 60, 76]],
    ["gallery", 1600, 1000, [20, 24, 28, 34, 44, 56, 72]],
  ] as const;
  for (const [preset, width, height, scale] of presets) {
    const actual = await page.evaluate((page, preset) => {
      page.setAttribute("data-size", preset);
      const style = getComputedStyle(page), box = page.getBoundingClientRect();
      return { width: box.width, height: box.height, title: parseFloat(getComputedStyle(page.querySelector("h1")!).fontSize), scale: ["fine", "caption", "body", "lead", "heading", "title", "display"].map(step => parseFloat(style.getPropertyValue(`--kp-font-${step}`))) };
    }, preset);
    assert(Math.abs(actual.width - width) < .02 && Math.abs(actual.height - height) < .02, preset);
    assert.deepEqual(actual.scale, scale, preset); assert.equal(actual.title, scale[5], preset);
    assert.deepEqual((await page.evaluate(inspectHTMLPage)).diagnostics, [], preset);
  }
  for (const colorScheme of ["light", "dark"] as const) {
    await tab.emulateMedia({ colorScheme });
    const actual = await page.evaluate(page => {
      // Old mode/palette attributes must not revive the removed variants.
      document.documentElement.setAttribute("data-mode", "dark");
      page.setAttribute("data-mode", "dark"); page.setAttribute("data-palette", "editorial");
      const style = getComputedStyle(page);
      return [style.colorScheme, style.backgroundColor, getComputedStyle(page.querySelector("h1")!).color];
    });
    assert.deepEqual(actual, ["light", "rgb(250, 249, 246)", "rgb(36, 88, 184)"], colorScheme);
    assert.deepEqual((await page.evaluate(inspectHTMLPage)).diagnostics, []);
  }
  assert.deepEqual(external, []);
});

test("the default theme applies complete type roles and loads Sans and Mono locally", async t => {
  const dir = await mkdtemp(join(tmpdir(), "konpeki-theme-roles-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = `<!doctype html><html lang="en"><head><link rel="stylesheet" href="theme.css">
    <style>.flow { display:grid; gap:var(--kp-space-3) } .evidence { border:var(--kp-rule-width) solid var(--kp-line); border-radius:var(--kp-radius); padding:var(--kp-space-2) }</style>
    </head><body><main id="page" data-page data-size="link"><div class="flow">
      <h1 id="title">Quiet evidence</h1><p id="copy">One document, complete type roles.</p>
      <h2 id="caption" data-type="caption">A caption treatment, still a level-two heading.</h2>
      <h2 id="heading">Supporting detail</h2>
      <p id="evidence" class="evidence">Preserve the <strong>meaning</strong> in <code>theme.css</code>.</p><hr>
    </div></main></body></html>`;
  const file = join(dir, "document.html"); await writeFile(file, source);
  // Close Chromium's connections before waiting for the HTTP server to drain.
  const browser = await chromium.launch(); t.after(() => browser.close());
  const server = await documentServer(file); t.after(() => server.close());
  const tab = await browser.newPage({ viewport: { width: 1200, height: 630 }, colorScheme: "dark" });
  const failures: string[] = [];
  tab.on("requestfailed", request => failures.push(request.url()));
  tab.on("response", response => { if (!response.ok()) failures.push(response.url()); });
  await tab.route("**/*", route => route.request().url().startsWith(server.origin) ? route.continue() : route.abort());
  await tab.goto(`${server.origin}${server.prefix}/document/`);
  await tab.waitForFunction(() => document.fonts.status === "loaded");
  const page = tab.locator("[data-page]");
  const geometry = await page.evaluate(el => {
    const box = el.getBoundingClientRect(), flow = getComputedStyle(el.querySelector(".flow")!), evidence = getComputedStyle(el.querySelector(".evidence")!);
    return [box.width, box.height, parseFloat(flow.gap), parseFloat(evidence.borderTopWidth), parseFloat(evidence.borderRadius)];
  });
  assert.deepEqual(geometry, [1200, 630, 24, 1, 0]);
  const caption = await tab.locator("#caption").evaluate(el => {
    const s = getComputedStyle(el); return [el.tagName, s.fontSize, s.lineHeight, s.fontWeight, s.fontFamily];
  });
  assert.deepEqual(caption, ["H2", "20px", "24px", "400", '"IBM Plex Sans", sans-serif']);
  for (const [index, role] of ["fine", "caption", "body", "lead", "heading", "title", "display"].entries()) {
    const actual = await tab.locator("#title").evaluate((el, role) => {
      el.setAttribute("data-type", role);
      const s = getComputedStyle(el);
      return { size: parseFloat(s.fontSize), leading: parseFloat(s.lineHeight), weight: Number(s.fontWeight), tracking: parseFloat(s.letterSpacing) || 0, family: s.fontFamily };
    }, role);
    const size = [16, 20, 24, 30, 40, 52, 64][index];
    assert.equal(actual.size, size, role);
    assert.equal(actual.leading, [20, 24, 32, 36, 48, 60, 72][index], role);
    assert.equal(actual.weight, [400, 400, 400, 600, 600, 600, 600][index], role);
    assert(Math.abs(actual.tracking - [0, 0, 0, 0, -.02, -.035, -.035][index] * size) < .001, role);
    assert.equal(actual.family, '"IBM Plex Sans", sans-serif', role);
  }
  await tab.locator("#title").evaluate(el => el.removeAttribute("data-type"));
  const loaded = await tab.evaluate(() => [...document.fonts].filter(f => f.status === "loaded").map(f => `${f.family}/${f.weight}`));
  for (const face of ["IBM Plex Sans/400", "IBM Plex Sans/600", "IBM Plex Mono/400"])
    assert(loaded.includes(face), `Font face must really load: ${face}`);
  assert.deepEqual(await tab.locator("code").evaluate(el => [getComputedStyle(el).fontFamily, getComputedStyle(el).fontWeight]), ['"IBM Plex Mono", monospace', "400"]);
  assert.deepEqual((await page.evaluate(inspectHTMLPage)).diagnostics, []);
  await tab.locator("#copy").evaluate(el => { el.style.color = "#010203"; });
  assert((await page.evaluate(inspectHTMLPage)).diagnostics.some(d => d.code === "theme-value" && d.target === "copy"));
  assert.deepEqual(failures, [], "all CSS imports and font assets must resolve locally");
});

test("theme definitions validate unused slots, ordered type, text contrast, and category marks", async t => {
  const dir = await mkdtemp(join(tmpdir(), "konpeki-theme-check-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "document.html");
  await writeFile(file, '<!doctype html><html><head><link rel="stylesheet" href="theme.css"></head><body><main id="page" data-page data-size="link"></main></body></html>');
  const browser = await chromium.launch(); t.after(() => browser.close());
  const server = await documentServer(file); t.after(() => server.close());
  const tab = await browser.newPage();
  await tab.goto(`${server.origin}${server.prefix}/document/`);
  const page = tab.locator("[data-page]");
  assert.deepEqual((await page.evaluate(inspectHTMLPage)).diagnostics, []);
  for (const [token, value, code, message] of [
    ["font-family-mono", "initial", "theme-definition", "missing --kp-font-family-mono"],
    ["font-heading", "29px", "theme-definition", "invalid heading type treatment"],
    ["font-caption", "20garbage", "theme-definition", "invalid caption type treatment"],
    ["leading-body", "23px", "theme-definition", "invalid body type treatment"],
    ["line-strong", "not-a-color", "theme-definition", "invalid --kp-line-strong color"],
    ["fg", "var(--kp-bg)", "theme-contrast", "fg on bg: 1.00:1"],
    ["on-contrast-muted", "var(--kp-contrast)", "theme-contrast", "on-contrast-muted on contrast: 1.00:1"],
    ["category-4", "var(--kp-bg)", "theme-chart-contrast", "category-4 on bg: 1.00:1"],
    ["category-2", "var(--kp-category-5)", "theme-categories", "exact duplicates"],
  ]) {
    await page.evaluate((el, [token, value]) => (el as HTMLElement).style.setProperty(`--kp-${token}`, value), [token, value]);
    const report = await page.evaluate(inspectHTMLPage);
    assert(report.diagnostics.some(d => d.code === code && d.message.includes(message)), `${token}: ${JSON.stringify(report.diagnostics)}`);
    await page.evaluate((el, token) => (el as HTMLElement).style.removeProperty(`--kp-${token}`), token);
  }
  await page.evaluate(el => (el as HTMLElement).style.setProperty("--kp-font-family-display", "var(--kp-font-family-mono)"));
  assert.equal((await page.evaluate(inspectHTMLPage)).theme?.type.display.family, '"IBM Plex Mono", monospace');
});

test("the three HTML fixtures inspect cleanly with the bundled theme", async () => {
  for (const example of ["cover", "data-brief", "field-guide"]) {
    const { report } = await browserDocument(join(root, `examples/${example}/document.html`));
    assert.deepEqual(report.diagnostics, [], example);
    assert.equal(report.pages.length, example === "field-guide" ? 2 : 1);
  }
});
