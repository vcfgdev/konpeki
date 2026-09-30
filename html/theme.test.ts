import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { documentServer } from "./server.ts";
import { browserDocument } from "./browser.ts";
import { inspectHTMLPage } from "./inspect.ts";

const root = fileURLToPath(new URL("../", import.meta.url));

test("portable starter loads bundled fonts and preserves page scales and both palette modes", async t => {
  const dir = await mkdtemp(join(tmpdir(), "konpeki-theme-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "document.html");
  const prepare = join(root, "skills/konpeki/scripts/prepare-document.mjs");
  const cli = join(root, "bin/konpeki.mjs");
  execFileSync(process.execPath, [prepare, cli, file], { stdio: "pipe" });
  for (const asset of ["theme.css", "fonts/OFL.txt", ...[400, 600, 700].map(w => `fonts/ibm-plex-sans-latin-${w}-normal.woff2`)])
    assert.deepEqual(await readFile(join(dir, asset)), await readFile(join(root, asset)), asset);
  const before = await readFile(file, "utf8");
  assert.equal(JSON.parse(execFileSync(process.execPath, [prepare, cli, file], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })).created, false);
  assert.equal(await readFile(file, "utf8"), before);
  const server = await documentServer(file); t.after(() => server.close());
  const browser = await chromium.launch(); t.after(() => browser.close());
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
      return { width: box.width, height: box.height, title: parseFloat(getComputedStyle(page.querySelector("h1")!).fontSize), scale: ["fine", "caption", "body", "lead", "heading", "title", "display"].map(step => parseFloat(style.getPropertyValue(`--font-${step}`))) };
    }, preset);
    assert(Math.abs(actual.width - width) < .02 && Math.abs(actual.height - height) < .02, preset);
    assert.deepEqual(actual.scale, scale, preset); assert.equal(actual.title, scale[5], preset);
  }
  for (const [palette, light, dark] of [
    ["plex", "rgb(36, 88, 184)", "rgb(145, 185, 255)"],
    ["precision", "rgb(61, 58, 143)", "rgb(182, 178, 255)"],
    ["editorial", "rgb(147, 69, 31)", "rgb(242, 179, 140)"],
    ["blue-cyan", "rgb(0, 124, 136)", "rgb(99, 214, 227)"],
    ["orange-coral", "rgb(162, 62, 32)", "rgb(255, 178, 142)"],
    ["yellow", "rgb(117, 96, 0)", "rgb(241, 214, 109)"],
    ["green", "rgb(33, 107, 61)", "rgb(152, 220, 175)"],
    ["graphite", "rgb(36, 36, 36)", "rgb(242, 242, 242)"],
  ]) for (const [mode, color] of [["light", light], ["dark", dark]]) {
    const actual = await page.evaluate((page, { palette, mode }) => {
      page.setAttribute("data-size", "link"); page.setAttribute("data-palette", palette); page.setAttribute("data-mode", mode);
      return getComputedStyle(page.querySelector("h1")!).color;
    }, { palette, mode });
    assert.equal(actual, color, `${palette}/${mode}`);
    assert.deepEqual((await page.evaluate(inspectHTMLPage)).diagnostics, [], `${palette}/${mode}`);
  }
  assert.deepEqual(external, []);
});

test("the three HTML fixtures inspect cleanly with the bundled theme", async () => {
  for (const example of ["cover", "data-brief", "field-guide"]) {
    const { report } = await browserDocument(join(root, `examples/${example}/document.html`));
    assert.deepEqual(report.diagnostics, [], example);
    assert.equal(report.pages.length, example === "field-guide" ? 2 : 1);
  }
});
