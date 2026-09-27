import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
import { assertComposition } from "../composition/validate.ts";
import { gridMetrics, resolveDocument, typeSteps } from "../composition/grid.ts";
import { contrastRatio } from "../lib/contrast.ts";

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
const measurements = [];
const hex = rgb => '#' + rgb.match(/[\d.]+/g).slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('');
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
        const { bad: issues, pairs, chartScales, alignments } = evaluate(`(() => {
          const slide = ${JSON.stringify(slide)};
          const metrics = ${JSON.stringify(slide.grid ? gridMetrics(slide.grid) : null)};
          const steps = ${JSON.stringify(typeSteps)};
          const canvas = document.querySelector('.presentation .canvas');
          const bounds = canvas.getBoundingClientRect(), scale = bounds.width / slide.canvas.width;
          const bad = [], pairs = [], chartScales = [], alignments = [];
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
            if (text && c.textStyle?.lineHeight && Math.abs(parseFloat(getComputedStyle(text).lineHeight)/scale - c.textStyle.size*c.textStyle.lineHeight) > 0.1) bad.push(c.id+' wrong leading');
            const svg = el.querySelector('.custom-vector-art');
            if (svg && c.kind === 'chart') {
              const matrix = svg.getScreenCTM();
              chartScales.push({ id:c.id, x:Math.hypot(matrix.a,matrix.b)/scale, y:Math.hypot(matrix.c,matrix.d)/scale });
            }
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
              // Sample actual opaque fills behind the text, not semantic tokens
              // alone. Transparent stacks and text across components need review.
              const opaque = node => {
                for (let n=node; n && n!==svg; n=n.parentElement) if (Number(getComputedStyle(n).opacity)!==1) return false;
                const s=getComputedStyle(node);
                return Number(s.fillOpacity)===1 && s.fill.startsWith('rgb(');
              };
              if (!svg || !opaque(t)) continue;
              const shapes = [...svg.querySelectorAll('[data-vector-element]')].filter(n =>
                n instanceof SVGGeometryElement && (n.compareDocumentPosition(t)&Node.DOCUMENT_POSITION_FOLLOWING) && opaque(n));
              const backgrounds = new Set();
              for (const fraction of [0.1,0.5,0.9]) {
                const point = new DOMPoint(tr.left+tr.width*fraction,tr.top+tr.height/2);
                const under = shapes.findLast(n => n.isPointInFill(point.matrixTransform(n.getScreenCTM().inverse())));
                if (under) backgrounds.add(under);
              }
              for (const under of backgrounds) pairs.push({ text:t.dataset.vectorElement, shape:under.dataset.vectorElement,
                foreground:getComputedStyle(t).fill, background:getComputedStyle(under).fill });
            }
          }
          const aligned = ${JSON.stringify(slide.id === "release"
            ? [0, 1, 2].map(i => [`document-${i}`, `step-${i + 1}`])
            : slide.id === "brief-to-page" ? [0, 1, 2, 3].map(i => [`flow-n${i}`, `step${i + 1}-head`]) : [])};
          for (const [artId, labelId] of aligned) {
            const art = canvas.querySelector('[data-vector-element="'+artId+'"]');
            const label = canvas.querySelector('[data-component="'+labelId+'"] .text-block-content');
            const matrix = art.getScreenCTM();
            const stroke = parseFloat(getComputedStyle(art).strokeWidth)*Math.hypot(matrix.a,matrix.b);
            const offset = (art.getBoundingClientRect().left-stroke/2-label.getBoundingClientRect().left)/scale;
            alignments.push({ artId, labelId, offset });
            if (Math.abs(offset)>1) bad.push(artId+' is '+offset.toFixed(2)+'px off its label column');
          }
          for (let i=0;i<slide.components.length;i++) for(let j=i+1;j<slide.components.length;j++) {
            const a=slide.components[i], b=slide.components[j];
            if(a.layer || b.layer) continue;
            const x=a.preferredRect, y=b.preferredRect;
            if(Math.min(x.x+x.width,y.x+y.width)-Math.max(x.x,y.x)>1 && Math.min(x.y+x.height,y.y+y.height)-Math.max(x.y,y.y)>1) bad.push('overlap '+a.id+' / '+b.id);
          }
          return { bad, pairs, chartScales, alignments };
        })()`);
        const label = `${name}-${index + 1}-${suffix}`;
        for (const pair of pairs) {
          pair.ratio = contrastRatio(hex(pair.foreground), hex(pair.background));
          if (pair.ratio < 4.5) issues.push(`${pair.text} on ${pair.shape}: ${pair.ratio.toFixed(2)}:1 contrast (requires 4.5:1)`);
        }
        for (const chart of chartScales) if (Math.abs(chart.x-1)>0.001 || Math.abs(chart.y-1)>0.001)
          console.log(`WARN ${label} ${chart.id}: artwork scale ${chart.x.toFixed(3)}×${chart.y.toFixed(3)}; verify any pixel-unit claims`);
        measurements.push({ label, pairs, chartScales, alignments });
        console.log(`${issues.length ? "FAIL" : "PASS"} ${label}${issues.length ? ": " + issues.join("; ") : " — grid geometry, type sizes, bounds and overlaps"}`);
        failures.push(...issues.map(issue => `${label}: ${issue}`));
        b("screenshot", ".presentation .canvas", join(resolve(output), `${label}.png`));
        if (suffix === "full") {
          // Account for Present's 48px sides and 40px/84px top/bottom chrome.
          b("set", "viewport", String(slide.canvas.width+96), String(slide.canvas.height+124), "2");
          settle();
          const path = join(resolve(output), `${name}-${index + 1}-page-2x.png`);
          b("screenshot", ".presentation .canvas", path);
          const png = readFileSync(path);
          assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)], [slide.canvas.width*2,slide.canvas.height*2], 'exact 2× page capture');
          b("set", "viewport", String(width), String(height), "2");
        }
        if (index + 1 < doc.slides.length) click("Next page");
      }
    }
    click("Exit");
  }
  writeFileSync(join(output, "checks.json"), JSON.stringify({ failures, measurements }, null, 2));
  if (!process.argv.includes("--report-only")) assert.deepEqual(failures, []);
} finally { b("close"); }
