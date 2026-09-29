import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gridSchema, lineLengthWarnings, resolveDocument, roleSteps, typeSteps } from "../composition/grid.ts";
import { validateComposition } from "../composition/validate.ts";

// Optional third argument selects another v1 Git revision for comparison.
const [base = "http://localhost:4318", output = "/tmp/konpeki-grid-evaluation", baselineRef = "a7143746947608c1f0e596996e0ba4012bf5a3d2"] = process.argv.slice(2);
const presets = ["presentation", "portrait", "link"];
const sources = [
  ["architecture", "slides/gallery/architecture.json"],
  ["sankey", "slides/gallery/sankey.json"],
  ["release", "slides/gallery/release.json"],
  ["explainer", "slides/gallery/explainer.json"],
  ["intro", "slides/introducing-konpeki/composition.json"],
];
const variants = join(output, "variants");
const captures = join(output, "captures");
rmSync(variants, { recursive: true, force: true });
rmSync(captures, { recursive: true, force: true });
mkdirSync(variants, { recursive: true });
mkdirSync(captures, { recursive: true });

const canonicalBytes = value => Buffer.byteLength(JSON.stringify(value));
const parse = path => JSON.parse(readFileSync(path, "utf8"));
const documents = sources.map(([name, path]) => {
  const v2 = parse(path), v1 = JSON.parse(execFileSync("git", ["show", `${baselineRef}:${path}`], { encoding: "utf8" }));
  assert.equal(v1.schema, "konpeki-composition/v1", `${baselineRef}:${path} is not v1`);
  assert.equal(v2.schema, gridSchema, `${path} is not v2`);
  const type = { textBlocks: 0, namedTextSteps: 0, vectorLabels: 0, namedVectorSteps: 0, violations: [] };
  const used = new Set();
  const v1Sizes = new Set(v1.pages.flatMap(s => s.components.flatMap(c => [c.textStyle?.size,
    ...(c.customVisual?.elements ?? []).map(e => Number(e.attributes["font-size"]))])).filter(n => n > 0));
  for (const slide of v2.pages) for (const component of slide.components) {
    if (component.kind === "text-block") {
      type.textBlocks++;
      const step = component.textStyle?.step ?? roleSteps[component.appearance.role];
      used.add(step);
      if (typeSteps.includes(step)) type.namedTextSteps++;
      else type.violations.push(`${slide.id}/${component.id}: missing named text step`);
    }
    const inherited = new Map();
    for (const element of component.customVisual?.elements ?? []) {
      const value = element.attributes["font-size"];
      const step = value === undefined ? inherited.get(element.parentId) ?? "caption" : String(value).replace(/^scale:/, "");
      inherited.set(element.id, step);
      if (element.kind !== "text" && element.kind !== "tspan") continue;
      type.vectorLabels++;
      used.add(step);
      if (typeSteps.includes(step)) type.namedVectorSteps++;
      else type.violations.push(`${slide.id}/${component.id}/${element.id}: missing named vector step`);
    }
  }
  return {
    name, path, v2,
    metrics: {
      pages: v2.pages.length,
      canonicalBytes: { v1: canonicalBytes(v1), v2: canonicalBytes(v2) },
      distinctSizes: { v1: [...v1Sizes].sort((a, b) => a - b), v2Steps: typeSteps.filter(step => used.has(step)) },
      typeSteps: type,
      lineLengthWarnings: lineLengthWarnings(v2),
    },
  };
});

const report = { baselineRef, documents: [], outcomes: [] };
for (const { name, metrics } of documents) report.documents.push({ name, ...metrics });
const b = (...args) => execFileSync("agent-browser", ["--session", "grid-presets", ...args], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim();
const evaluate = code => JSON.parse(b("eval", code));
const click = name => b("find", "role", "button", "click", "--name", name, "--exact");
const settle = () => b("eval", "document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))");

try {
  b("open", base);
  b("set", "viewport", "1920", "1080", "2");
  b("wait", ".canvas");
  for (const { name, v2 } of documents) for (const [pageIndex, page] of v2.pages.entries()) for (const preset of presets) {
    const variant = structuredClone(v2);
    variant.pages[pageIndex].grid.preset = preset; // Deliberately change nothing else.
    const validation = validateComposition(variant);
    const label = `${name}-${pageIndex + 1}-${preset}`;
    if (!validation.ok) {
      report.outcomes.push({ document: name, page: pageIndex + 1, pageId: page.id, preset, status: "manual-recomposition", validationIssues: validation.issues });
      console.log(`MANUAL ${label}: ${validation.issues.map(issue => `${issue.path} ${issue.message}`).join("; ")}`);
      continue;
    }
    const variantPath = resolve(variants, `${label}.json`);
    writeFileSync(variantPath, JSON.stringify(variant, null, 2) + "\n");
    b("upload", 'input[type="file"]', variantPath);
    b("wait", "--fn", `document.querySelector('.document-title input')?.value === ${JSON.stringify(v2.title)}`);
    click("Present");
    b("focus", ".presentation"); b("press", "Home");
    for (let i = 0; i < pageIndex; i++) click("Next page");
    settle();
    const resolved = resolveDocument(variant).pages[pageIndex];
    const issues = evaluate(`(() => {
      const slide = ${JSON.stringify(resolved)};
      const canvas = document.querySelector('.presentation .canvas');
      const bounds = canvas.getBoundingClientRect(), scale = bounds.width / slide.canvas.width, bad = [];
      if (getComputedStyle(canvas.querySelector('.component-grid')).display !== 'grid') bad.push('not CSS Grid');
      for (const c of slide.components) {
        const el = canvas.querySelector('[data-component="'+c.id+'"]');
        if (!el) { bad.push(c.id+' missing'); continue; }
        const r = el.getBoundingClientRect(), expected = c.preferredRect;
        for (const [key, actual] of [['x',(r.left-bounds.left)/scale],['y',(r.top-bounds.top)/scale],['width',r.width/scale],['height',r.height/scale]])
          if (Math.abs(actual-expected[key]) > 0.2/scale) bad.push(c.id+' grid '+key+': '+actual+' != '+expected[key]);
        if (r.left < bounds.left-1 || r.top < bounds.top-1 || r.right > bounds.right+1 || r.bottom > bounds.bottom+1) bad.push(c.id+' outside canvas');
        const text = el.querySelector('.text-block-content');
        const surface = el.querySelector('.component-surface'), style = getComputedStyle(surface);
        const innerHeight = surface.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
        const innerWidth = surface.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
        if (text && (text.scrollHeight > innerHeight+1 || text.scrollWidth > innerWidth+1)) bad.push(c.id+' text overflow');
        if (text && c.textStyle?.size && Math.abs(parseFloat(getComputedStyle(text).fontSize)/scale-c.textStyle.size)>0.1) bad.push(c.id+' wrong type size');
        for (const t of el.querySelectorAll('svg text')) { const q=t.getBoundingClientRect(); if(q.left<r.left-1||q.top<r.top-1||q.right>r.right+1||q.bottom>r.bottom+1) bad.push(c.id+' clipped vector text '+t.textContent); }
      }
      for(let i=0;i<slide.components.length;i++) for(let j=i+1;j<slide.components.length;j++) {
        const a=slide.components[i], d=slide.components[j]; if(a.layer||d.layer) continue; const x=a.preferredRect,y=d.preferredRect;
        if(Math.min(x.x+x.width,y.x+y.width)-Math.max(x.x,y.x)>1&&Math.min(x.y+x.height,y.y+y.height)-Math.max(x.y,y.y)>1) bad.push('overlap '+a.id+' / '+d.id);
      }
      return bad;
    })()`);
    const capturePath = resolve(captures, `${label}.png`);
    b("screenshot", ".presentation .canvas", capturePath);
    report.outcomes.push({ document: name, page: pageIndex + 1, pageId: page.id, preset, status: issues.length ? "render-fail" : "render-pass", issues, variantPath, capturePath });
    console.log(`${issues.length ? "FAIL" : "PASS"} ${label}${issues.length ? `: ${issues.join("; ")}` : ""}`);
    click("Exit");
  }
} finally {
  try { b("close"); } catch {}
  writeFileSync(join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
}

console.log(`REPORT ${join(output, "report.json")}`);
for (const item of report.documents) console.log(`METRIC ${item.name}: v1=${item.canonicalBytes.v1} v2=${item.canonicalBytes.v2} pages=${item.pages} text=${item.typeSteps.namedTextSteps}/${item.typeSteps.textBlocks} vector=${item.typeSteps.namedVectorSteps}/${item.typeSteps.vectorLabels} warnings=${item.lineLengthWarnings.length}`);
