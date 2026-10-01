import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { documentServer } from "./server.ts";
import { inspectHTMLPage } from "./inspect.ts";
import { floorRules, reviewChecklist } from "./floor.ts";

test("every floor rule has one ID, and inspect rules are emitted under that ID", async () => {
  const rules = floorRules(), ids = rules.flatMap(rule => rule.ids);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...new Set(rules.map(rule => rule.tier))], ["ban", "default", "verify"]);
  const sources = (await Promise.all(["inspect.ts", "browser.ts"].map(name => readFile(new URL(name, import.meta.url), "utf8")))).join("\n");
  for (const rule of rules.filter(rule => rule.check === "inspect"))
    for (const id of rule.ids) assert(sources.includes(`"${id}"`), `No diagnostic emits ${id}`);
  const checklist = reviewChecklist(rules);
  assert.equal(checklist.length, rules.filter(rule => rule.check === "review").length);
  assert(checklist.every(line => /^[a-z-]+: .+\.$/.test(line)), checklist.join("\n"));
  assert.match(checklist.find(line => line.startsWith("slogan-copy"))!, /"Not a feature\. A platform\.".+em dashes\.$/);
  assert.match(checklist.find(line => line.startsWith("page-footer"))!, /source notes and page numbers together in a reserved footer, clear of body content\./);
});

test("labels above headlines and stranded words are flagged, deliberate structure is not", async t => {
  const dir = await mkdtemp(join(tmpdir(), "konpeki-floor-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "document.html");
  const head = (id: string, n: number) => `<header id="${id}" data-type="fine"><span>Offline check-in pilot</span> · <span>0${n} / 02</span></header>`;
  await writeFile(file, `<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="theme.css"></head><body>
    <main id="kicker" data-page data-size="link"><p id="blog" data-type="caption">Engineering blog</p><h1 id="kicker-title">Cold starts fell 62% after the move</h1>
      <p id="step" data-type="fine" style="margin-top:32px">01 · Prepare</p><h2 id="step-title">Download the list</h2></main>
    <main id="row" data-page data-size="portrait"><header style="display:flex;justify-content:space-between"><p id="row-kicker" data-type="fine">Tide 1.2</p><p id="row-date" data-type="fine">15 October 2026</p></header>
      <h1 id="row-title" style="width:600px">Check in guests, even offline</h1></main>
    <main id="quiet" data-page data-size="link"><p id="corner" data-type="caption" style="text-align:right">Before</p><h1 id="quiet-title" style="width:520px">Short headline</h1>
      <p id="allowed" data-type="caption" data-kp-allow="label-above-headline">After</p><h2 id="allowed-title">Offline check-in</h2>
      <p id="caveat" data-type="caption">A connection is required first.</p><h2 id="caveat-title">Check in guests</h2>
      <p id="up-to" data-type="caption">Up to</p><p id="figure" data-type="display">2,000</p></main>
    <main id="print-1" data-page data-size="a4">${head("running-1", 1)}<h1 id="print-title-1">Run another pilot before rollout</h1></main>
    <main id="print-2" data-page data-size="a4">${head("running-2", 2)}<h1 id="print-title-2">Verify the full offline cycle</h1>
      <p id="print-kicker" data-type="fine" style="margin-top:24px">Infrastructure review · Q3 2026</p><h2 id="print-heading">Where we are</h2></main>
    <main id="lines" data-page data-size="link">
      <h1 id="stranded" style="width:520px"><span style="display:inline-block;width:500px">Alpha beta</span> gamma</h1>
      <h1 id="broken" style="width:520px">Alpha beta<br>gamma</h1>
      <h1 id="stacked" style="width:520px">Alpha<br>beta<br>gamma</h1>
      <h1 id="before-break" style="width:520px"><span style="display:inline-block;width:500px">Alpha beta</span> gamma<br>Delta epsilon</h1></main>
  </body></html>`);
  const browser = await chromium.launch(); t.after(() => browser.close());
  const server = await documentServer(file); t.after(() => server.close());
  const tab = await browser.newPage();
  const flagged: Record<string, string[]> = {};
  for (const page of ["kicker", "row", "quiet", "print-1", "print-2", "lines"]) {
    await tab.goto(`${server.origin}${server.prefix}/document/?page=${page}`);
    await tab.evaluate(() => document.fonts.ready);
    const { diagnostics } = await tab.locator("[data-konpeki-current]").evaluate(inspectHTMLPage);
    for (const d of diagnostics.filter(d => ["label-above-headline", "stranded-word"].includes(d.code))) {
      assert.equal(d.severity, "warning");
      (flagged[d.code] ??= []).push(d.target);
    }
  }
  assert.deepEqual(flagged, { "label-above-headline": ["blog", "step", "row-kicker", "print-kicker"], "stranded-word": ["stranded", "before-break"] });
});
