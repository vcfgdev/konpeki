import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
import { assertComposition } from "../composition/validate.ts";
import { gridMetrics, resolveDocument, typeSteps } from "../composition/grid.ts";

const [base = "http://localhost:4318", output = "/tmp/konpeki-grid-review"] = process.argv.slice(2);
const baseline = process.env.KONPEKI_GRID_BASELINE;
const files = ["architecture", "sankey", "release", "explainer", "intro"].map(name => ({ name,
  path: baseline ? join(baseline, `${name}.json`) : resolve(name === "intro" ? "slides/introducing-konpeki/composition.json" : `slides/gallery/${name}.json`),
}));
mkdirSync(output, { recursive: true });
const b = (...args) => execFileSync("agent-browser", ["--session", "grid-review", ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trim();
const evaluate = code => JSON.parse(b("eval", code));
const click = name => b("find", "role", "button", "click", "--name", name, "--exact");
const settle = () => b("eval", "document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))");
const failures = [];
try {
  b("open", base);
  b("set", "viewport", "1920", "1080", "2");
  b("wait", ".canvas");
  for (const { name, path } of files) {
    const wire = assertComposition(JSON.parse(readFileSync(path, "utf8")));
    const doc = resolveDocument(wire);
    b("upload", 'input[type="file"]', path);
    b("wait", "--fn", `document.querySelector('.document-title input')?.value === ${JSON.stringify(doc.title)}`);
    click("Present");
    for (const [width, height, suffix] of [[1920, 1080, "full"], [1024, 768, "review"]]) {
      b("set", "viewport", String(width), String(height), "2");
      b("focus", ".presentation"); b("press", "Home");
      for (const [index, slide] of doc.slides.entries()) {
        settle();
        const issues = evaluate(`(() => {
          const slide = ${JSON.stringify(slide)};
          const metrics = ${JSON.stringify(slide.grid ? gridMetrics(slide.grid) : null)};
          const steps = ${JSON.stringify(typeSteps)};
          const canvas = document.querySelector('.presentation .canvas');
          const bounds = canvas.getBoundingClientRect(), scale = bounds.width / slide.canvas.width, bad = [];
          if (${wire.schema === "konpeki-composition/v2"} && getComputedStyle(canvas.querySelector('.component-grid')).display !== 'grid') bad.push('not CSS Grid');
          for (const c of slide.components) {
            const el = canvas.querySelector('[data-component="'+c.id+'"]'), r = el.getBoundingClientRect();
            const expected = c.preferredRect;
            for (const [key, actual] of [['x', (r.left-bounds.left)/scale], ['y',(r.top-bounds.top)/scale], ['width',r.width/scale], ['height',r.height/scale]]) {
              if (Math.abs(actual-expected[key]) > 0.2/scale) bad.push(c.id+' grid '+key+': '+actual+' != '+expected[key]);
            }
            const text = el.querySelector('.text-block-content');
            const surface = el.querySelector('.component-surface'), surfaceStyle = getComputedStyle(surface);
            const padding = ['paddingTop','paddingRight','paddingBottom','paddingLeft'].map(key => parseFloat(surfaceStyle[key]));
            if (metrics && padding.some(value => Math.abs(value / scale - (c.padding ?? 0) * metrics.baseline) > 0.1)) bad.push(c.id+' wrong padding');
            if (text && (text.scrollHeight > surface.clientHeight-padding[0]-padding[2]+1 || text.scrollWidth > surface.clientWidth-padding[1]-padding[3]+1)) bad.push(c.id+' text overflow');
            if (text && c.textStyle?.size && Math.abs(parseFloat(getComputedStyle(text).fontSize)/scale - c.textStyle.size) > 0.1) bad.push(c.id+' wrong type size');
            const vectorSteps = new Map();
            for (const element of c.customVisual?.elements ?? []) {
              const named = element.attributes['font-size'];
              vectorSteps.set(element.id, named?.startsWith?.('scale:') ? named.slice(6) : vectorSteps.get(element.parentId) ?? 'caption');
            }
            for (const t of el.querySelectorAll('svg text')) {
              const tr = t.getBoundingClientRect();
              if (tr.left < r.left-1 || tr.top < r.top-1 || tr.right > r.right+1 || tr.bottom > r.bottom+1) bad.push(c.id+' clipped vector text '+t.textContent);
              const matrix = t.getScreenCTM();
              if (metrics && Math.abs(parseFloat(getComputedStyle(t).fontSize) * Math.hypot(matrix.c,matrix.d) / scale - metrics.scale[steps.indexOf(vectorSteps.get(t.dataset.vectorElement))]) > 0.1) bad.push(c.id+' wrong vector type size');
            }
          }
          for (let i=0;i<slide.components.length;i++) for(let j=i+1;j<slide.components.length;j++) {
            const a=slide.components[i], b=slide.components[j];
            if(a.layer || b.layer) continue;
            const x=a.preferredRect, y=b.preferredRect;
            if(Math.min(x.x+x.width,y.x+y.width)-Math.max(x.x,y.x)>1 && Math.min(x.y+x.height,y.y+y.height)-Math.max(x.y,y.y)>1) bad.push('overlap '+a.id+' / '+b.id);
          }
          return bad;
        })()`);
        const label = `${name}-${index + 1}-${suffix}`;
        console.log(`${issues.length ? "FAIL" : "PASS"} ${label}${issues.length ? ": " + issues.join("; ") : " — grid geometry, type sizes, bounds and overlaps"}`);
        failures.push(...issues.map(issue => `${label}: ${issue}`));
        b("screenshot", ".presentation .canvas", join(resolve(output), `${label}.png`));
        if (index + 1 < doc.slides.length) click("Next page");
      }
    }
    click("Exit");
  }
  writeFileSync(join(output, "checks.json"), JSON.stringify({ failures }, null, 2));
  if (!process.argv.includes("--report-only")) assert.deepEqual(failures, []);
} finally { b("close"); }
