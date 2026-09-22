// Regression check for this deck's authored vector coordinates, not an aesthetic linter.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { getTheme } from "../../design/themes/index.ts";

const base = process.argv[2] ?? "http://localhost:4318";
const output = resolve(process.argv[3] ?? ".amp/in/artifacts/konpeki-intro");
const theme = process.argv[4] ?? "Plex";
const mode = process.argv[5] ?? "paper";
const typography = process.argv[6] ?? getTheme(theme, mode).typographyId;
mkdirSync(output, { recursive: true });
function browser(...args) {
  return execFileSync("agent-browser", ["--session", "intro-review", ...args], { encoding: "utf8" }).trim();
}
const geometryCheck = `(() => {
  const components = [...document.querySelectorAll('.presentation [data-component]')];
  if (!components.length) throw Error('Presentation is not rendered');
  for (const component of components) {
    const svg = component.querySelector('.custom-vector-art');
    if (!svg) {
      const text = component.querySelector('.text-block-content');
      if (!text) throw Error('Missing editable content');
      if (text.scrollHeight > component.clientHeight + 1 || text.scrollWidth > component.clientWidth + 1) throw Error('Text overflow: ' + component.dataset.component);
      continue;
    }
    const rect = component.getBoundingClientRect();
    const view = svg.viewBox.baseVal;
    const matrix = svg.getScreenCTM();
    const origin = new DOMPoint(view.x, view.y).matrixTransform(matrix);
    const end = new DOMPoint(view.x + view.width, view.y + view.height).matrixTransform(matrix);
    // This deck uses equal-aspect component rectangles and local viewBoxes.
    // A role-specific inset or transparent CSS border must not shift the artwork.
    if (Math.abs(origin.x - rect.left) > 0.5 || Math.abs(origin.y - rect.top) > 0.5 ||
        Math.abs(end.x - rect.right) > 0.5 || Math.abs(end.y - rect.bottom) > 0.5)
      throw Error('Authored viewport shifted: ' + component.dataset.component);
    for (const text of svg.querySelectorAll('text')) {
      const box = text.getBBox();
      if (box.x < -1 || box.y < -1 || box.x + box.width > view.width + 1 || box.y + box.height > view.height + 1)
        throw Error('Clipped text: ' + text.textContent);
    }
  }
  return 'PASS: vector coordinates and text bounds';
})()`;
try {
  browser("open", `${base}/?example=introducing-konpeki`);
  browser("set", "viewport", "1556", "1030", "2");
  browser("find", "role", "button", "click", "--name", theme, "--exact");
  browser("find", "role", "button", "click", "--name", mode === "paper" ? "Paper" : "Night", "--exact");
  browser("select", '[name="Font"]', typography);
  browser("eval", `(() => {
    if (document.querySelector('select[name="Authoring mode"]')) throw Error('Authoring mode remains in appearance');
    const canvas = document.querySelector('#canvas-stage .canvas');
    const brand = canvas.querySelector('[data-component="brand"] .text-block-content');
    const expected = getComputedStyle(canvas).getPropertyValue('--slide-accent').trim();
    const sample = document.createElement('span'); sample.style.color = expected; document.body.append(sample);
    if (getComputedStyle(brand).color !== getComputedStyle(sample).color) throw Error('Linked accent did not update');
    sample.remove();
  })()`);
  browser("eval", "document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))");
  browser("screenshot", `${output}/editor.png`);
  browser("find", "role", "button", "click", "--name", "Present", "--exact");
  for (const [width, height, prefix] of [[1920, 1080, "slide"], [1024, 768, "review"]]) {
    browser("set", "viewport", String(width), String(height), "2");
    browser("focus", ".presentation");
    browser("press", "Home");
    for (let page = 1; page <= 6; page++) {
      browser("eval", "document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))");
      console.log(`${width}×${height} page ${page}: ${browser("eval", geometryCheck)}`);
      browser("screenshot", ".presentation .canvas", `${output}/${prefix}-${page}.png`);
      if (page < 6) browser("find", "role", "button", "click", "--name", "Next page", "--exact");
    }
  }
} finally {
  browser("close");
}
