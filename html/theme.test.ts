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
  for (const asset of ["theme.css", "theme-base.css", "fonts/OFL.txt", "fonts/plex-mono-OFL.txt", "fonts/ibm-plex-mono-latin-400-normal.woff2", "fonts/ibm-plex-sans-latin-400-italic.woff2", ...[400, 600, 700].map(w => `fonts/ibm-plex-sans-latin-${w}-normal.woff2`)])
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
    ["presentation", 1920, 1080, [24, 28, 32, 40, 52, 84, 112]],
    ["portrait", 1080, 1350, [24, 28, 32, 40, 52, 80, 128]],
    ["square", 1080, 1080, [24, 28, 32, 40, 52, 80, 128]],
    ["link", 1200, 630, [24, 28, 32, 40, 48, 72, 88]],
    ["article", 1600, 600, [24, 28, 32, 40, 48, 72, 96]],
    ["a4", 210 / 25.4 * 96, 297 / 25.4 * 96, [11, 12, 14, 18, 24, 32, 44]],
    ["explainer", 1200, 1600, [24, 28, 32, 40, 52, 84, 112]],
    ["gallery", 1600, 1000, [24, 28, 32, 40, 52, 84, 112]],
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
  assert.deepEqual(caption, ["H2", "28px", "36px", "400", '"IBM Plex Sans", sans-serif']);
  for (const [index, role] of ["fine", "caption", "body", "lead", "heading", "title", "display"].entries()) {
    const actual = await tab.locator("#title").evaluate((el, role) => {
      el.setAttribute("data-type", role);
      const s = getComputedStyle(el);
      return { size: parseFloat(s.fontSize), leading: parseFloat(s.lineHeight), weight: Number(s.fontWeight), tracking: parseFloat(s.letterSpacing) || 0, family: s.fontFamily };
    }, role);
    const size = [24, 28, 32, 40, 48, 72, 88][index];
    assert.equal(actual.size, size, role);
    assert.equal(actual.leading, [32, 36, 44, 50, 56, 80, 92][index], role);
    assert.equal(actual.weight, [400, 400, 400, 400, 400, 600, 600][index], role);
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

test("the packaged starter inspects cleanly with the bundled theme", async () => {
  const { report } = await browserDocument(join(root, "skills/konpeki/assets/blank.html"));
  assert.deepEqual(report.diagnostics, []);
  assert.equal(report.pages.length, 1);
});

test("tight adjacent HTML roles render while translated and SVG text collisions still fail", async t => {
  const dir = await mkdtemp(join(tmpdir(), "konpeki-leading-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "document.html");
  await writeFile(file, `<!doctype html><link rel="stylesheet" href="theme.css"><main id="page" data-page data-size="link">
    <h1 id="title" style="width:600px">A heading wrapping onto a second line</h1>
    <p id="copy">A paragraph with <strong>inline emphasis</strong>.</p>
    <h2 id="heading">Supporting heading</h2><p id="caption" data-type="caption">Immediately followed by a caption.</p>
    <svg width="400" height="110" style="fill:var(--kp-fg)"><text id="svg-one" x="0" y="40">SVG text</text><text id="svg-two" x="0" y="90">Second line</text></svg>
    </main>`);
  const rendered = await browserDocument(file, { format: "png" });
  assert.deepEqual(rendered.report.diagnostics, []);
  assert(rendered.bytes!.length > 1000);
  const browser = await chromium.launch(); t.after(() => browser.close());
  const server = await documentServer(file); t.after(() => server.close());
  const tab = await browser.newPage(); await tab.goto(`${server.origin}${server.prefix}/document/`);
  await tab.evaluate(() => document.fonts.ready);
  const page = tab.locator("[data-page]");
  for (const translate of ["0 0px", "0 -18px", "0 0px"]) {
    await tab.locator("#copy").evaluate((el, translate) => (el as HTMLElement).style.translate = translate, translate);
    assert.equal((await page.evaluate(inspectHTMLPage)).diagnostics.some(d => d.code === "text-overlap"), translate === "0 -18px", translate);
  }
  await tab.locator("#svg-two").evaluate(el => el.setAttribute("y", "45"));
  assert((await page.evaluate(inspectHTMLPage)).diagnostics.some(d => d.code === "text-overlap" && d.target === "svg-two"));
});

test("font auditing catches actual system fallback, missing weights and styles, but not hidden text", async t => {
  const dir = await mkdtemp(join(tmpdir(), "konpeki-font-audit-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "document.html");
  await writeFile(file, `<!doctype html><link rel="stylesheet" href="theme.css"><style>
    #generated::before { content:"Generated"; font-family:serif; }
    </style><main id="page" data-page data-size="link">
    <p id="undeclared" style="font-family:Undeclared">Missing family</p>
    <p id="nested">Inline <span style="font-family:Georgia">fallback</span></p>
    <p id="weight" style="font-weight:800">Missing weight</p>
    <p id="italic-mono" style="font-family:var(--kp-font-family-mono);font-style:italic">Missing italic</p>
    <p id="italic"><em>Real italic</em></p><p id="generated"></p>
    <p id="hidden" style="display:none;font-family:serif">Hidden</p>
    <div style="opacity:0"><p id="transparent" style="font-family:serif">Hidden by parent</p></div>
    <svg width="300" height="50"><text id="svg-font" x="0" y="30" style="font-family:serif;fill:var(--kp-fg)">SVG fallback</text></svg>
    </main>`);
  const { report } = await browserDocument(file);
  const fallback = report.diagnostics.filter(d => d.code === "font-fallback").map(d => d.target);
  assert.deepEqual(fallback.sort(), ["generated", "nested", "svg-font", "undeclared"]);
  const faces = report.diagnostics.filter(d => d.code === "font-face").map(d => d.target);
  assert.deepEqual(faces.sort(), ["italic-mono", "weight"]);
  assert.equal(report.ok, false);
  const output = join(dir, "result.png");
  assert.throws(() => execFileSync(process.execPath, [join(root, "bin/konpeki.mjs"), "render", file, "--output", output], { stdio: "pipe" }), /installed fonts/);
  await assert.rejects(readFile(output), /ENOENT/);
});

test("theme diagnostics isolate invalid sizes, shadowed page tokens, roles and painted shapes", async t => {
  const dir = await mkdtemp(join(tmpdir(), "konpeki-theme-diagnostics-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "document.html");
  await writeFile(file, `<!doctype html><link rel="stylesheet" href="theme.css"><main id="page" data-page data-size="link">
    <p id="role" data-type="subtitle">Unknown role</p>
    <p id="pill" style="border-radius:999px;border:9px solid var(--kp-accent)">Off-theme shape</p>
    <svg width="400" height="100" style="stroke:var(--kp-accent);stroke-width:var(--kp-stroke)">
      <line id="line" x1="0" y1="10" x2="100" y2="10"/>
      <path id="path" d="M0 30 L100 30 L50 50Z"/>
      <polyline id="polyline" points="150,30 250,30 200,50"/>
      <circle id="circle" cx="300" cy="30" r="20" style="fill:var(--kp-accent)"/>
      <line id="stroke" x1="0" y1="80" x2="100" y2="80" style="stroke-width:7px"/>
    </svg></main>`);
  const browser = await chromium.launch(); t.after(() => browser.close());
  const server = await documentServer(file); t.after(() => server.close());
  const tab = await browser.newPage(); await tab.goto(`${server.origin}${server.prefix}/document/`);
  await tab.evaluate(() => document.fonts.ready);
  const page = tab.locator("[data-page]");
  let diagnostics = (await page.evaluate(inspectHTMLPage)).diagnostics;
  assert.deepEqual(diagnostics.filter(d => d.code === "theme-value").map(d => d.target).sort(), ["path", "pill", "polyline", "stroke"]);
  assert(diagnostics.some(d => d.code === "theme-role" && d.target === "role"));
  assert.match(diagnostics.find(d => d.target === "pill")!.message, /border width 9px.*corner radius 999px/);
  for (const size of ["calc(30px)", "2rem"]) {
    await page.evaluate((el, size) => (el as HTMLElement).style.setProperty("--kp-font-lead", size), size);
    assert.equal((await page.evaluate(inspectHTMLPage)).diagnostics.find(d => d.code === "theme-definition")?.message, "invalid lead type treatment");
  }
  await page.evaluate(el => (el as HTMLElement).style.removeProperty("--kp-font-lead"));
  await tab.addStyleTag({ content: ':root { --kp-font-title:40px; --kp-leading-title:48px; --kp-page-margin:20px; }' });
  diagnostics = (await page.evaluate(inspectHTMLPage)).diagnostics;
  const rootWarning = diagnostics.find(d => d.code === "theme-root")!;
  assert.match(rootWarning.message, /--kp-font-title, --kp-leading-title, --kp-page-margin/);
  assert(!rootWarning.message.includes("--kp-font-family"));
  await tab.locator("#pill").evaluate(el => el.setAttribute("data-theme", "custom"));
  assert(!(await page.evaluate(inspectHTMLPage)).diagnostics.some(d => d.target === "pill"));
});

test("unused theme roles require faces and declared weight ranges include both boundaries", async t => {
  const dir = await mkdtemp(join(tmpdir(), "konpeki-theme-faces-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "document.html");
  await writeFile(file, '<!doctype html><link rel="stylesheet" href="theme.css"><main id="page" data-page data-size="link"></main>');
  const browser = await chromium.launch(); t.after(() => browser.close());
  const server = await documentServer(file); t.after(() => server.close());
  const tab = await browser.newPage(); await tab.goto(`${server.origin}${server.prefix}/document/`);
  const page = tab.locator("[data-page]");
  // FontFace descriptors are the contract being checked, not binary metadata.
  await tab.evaluate(() => document.fonts.add(new FontFace("Range", 'url("fonts/ibm-plex-sans-latin-400-normal.woff2")', { weight: "300 800" })));
  await page.evaluate(el => (el as HTMLElement).style.setProperty("--kp-font-family-heading", '"Range"'));
  for (const weight of [299, 300, 800, 801]) {
    await page.evaluate((el, weight) => (el as HTMLElement).style.setProperty("--kp-weight-title", String(weight)), weight);
    assert.equal((await page.evaluate(inspectHTMLPage)).diagnostics.some(d => d.code === "theme-font"), weight < 300 || weight > 800, String(weight));
  }
  await page.evaluate(el => { (el as HTMLElement).style.setProperty("--kp-font-family-heading", '"IBM Plex Mono"'); (el as HTMLElement).style.setProperty("--kp-weight-title", "800"); });
  assert.match((await page.evaluate(inspectHTMLPage)).diagnostics.find(d => d.code === "theme-font")!.message, /title.*IBM Plex Mono.*800/);
});

test("minimum type warnings use the page format, including unthemed HTML and SVG, but ignore hidden text", async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  const tab = await browser.newPage();
  await tab.setContent(`<main id="page" data-page data-theme="custom" style="width:1200px;height:1000px">
    <p id="below">Below <span>the floor</span></p><p id="boundary">At the floor</p><p id="above">Above</p>
    <p id="hidden" style="display:none;font-size:1px">Hidden</p><div style="opacity:0"><p style="font-size:1px">Transparent</p></div>
    <svg width="400" height="100"><defs><text style="font-size:1px">Definition</text></defs><text id="svg-small" x="0" y="50">SVG label</text></svg>
    </main>`);
  const page = tab.locator("[data-page]");
  for (const [preset, minimum] of [["link", 24], ["presentation", 24], ["portrait", 24], ["square", 24], ["article", 24], ["explainer", 24], ["gallery", 24], ["a4", 11], ["", 24]] as const) {
    await page.evaluate((el, { preset, minimum }) => {
      if (preset) el.setAttribute("data-size", preset); else el.removeAttribute("data-size");
      for (const [id, size] of [["below", minimum - .01], ["boundary", minimum], ["above", minimum + .01], ["svg-small", minimum - .01]] as const)
        (el.querySelector(`#${id}`) as HTMLElement).style.fontSize = `${size}px`;
    }, { preset, minimum });
    const small = (await page.evaluate(inspectHTMLPage)).diagnostics.filter(d => d.code === "small-text");
    assert.deepEqual(small.map(d => d.target), ["below", "svg-small"], preset);
    assert(small.every(d => d.severity === "warning" && d.message.includes(`at least ${minimum}px`)), preset);
  }
});
