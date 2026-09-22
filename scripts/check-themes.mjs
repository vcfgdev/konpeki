// Requires pnpm dev and agent-browser. Isolated browser storage; no user data.
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const base = process.argv[2] ?? "http://localhost:4318";
const scratch = mkdtempSync(join(tmpdir(), "konpeki-themes-"));
const deck = JSON.parse(readFileSync(new URL("../slides/introducing-konpeki/composition.json", import.meta.url), "utf8"));
deck.theme = { id: "precision", mode: "paper" };
deck.slides[0].components[0].customVisual = { format: "vector", description: "Legacy vector fixture", viewBox: { x: 0, y: 0, width: 820, height: 177 }, elements: [{ id: "brand-line-1", kind: "text", text: "Konpeki", attributes: { x: 0, y: 120, fill: "theme:accent", "font-family": "theme:heading-font" } }] };
const element = deck.slides[0].components[0].customVisual.elements[0];
element.attributes.fill = "#123456";
element.attributes["font-size"] = 500;
const file = join(scratch, "overflow.json");
writeFileSync(file, JSON.stringify(deck));
function browser(...args) { return execFileSync("agent-browser", ["--session", "theme-check", ...args], { encoding: "utf8" }).trim(); }
function click(name) { browser("find", "role", "button", "click", "--name", name, "--exact"); }
function check(code) { browser("eval", code); }
function fonts(headline, body, typography) {
  check(`(() => {
    const canvas = document.querySelector('.presentation .canvas') ?? document.querySelector('#canvas-stage .canvas');
    const heading = canvas.querySelector('[data-vector-element="brand-line-1"]');
    const native = canvas.querySelector('[data-component="summary"] .text-block-content');
    if (!getComputedStyle(heading).fontFamily.includes(${JSON.stringify(headline)})) throw Error('Wrong vector heading font');
    if (!getComputedStyle(native).fontFamily.includes(${JSON.stringify(body)})) throw Error('Wrong native body font');
    const picker = document.querySelector('select[name="Font"]');
    if (picker && picker.value !== ${JSON.stringify(typography)}) throw Error('Font control disagrees with canvas');
  })()`);
}
function savedTheme(expected) {
  browser("wait", "--fn", `JSON.stringify(JSON.parse(localStorage.getItem('konpeki-composer/v1'))?.document.theme) === ${JSON.stringify(JSON.stringify(expected))}`);
}
try {
  browser("open", base);
  browser("set", "viewport", "1556", "1030", "2");
  browser("upload", 'input[type="file"]', file);
  browser("wait", "--text", "text element exceeds");
  fonts("Noto Sans", "Noto Sans", "noto-sans");
  check(`(() => {
    const label = document.querySelector('[name="Font"]').previousElementSibling;
    const legend = document.querySelector('.theme-picker legend');
    if (label.textContent !== 'Font' || getComputedStyle(label).fontWeight !== '500' ||
      ['fontWeight', 'fontSize', 'fontFamily', 'color'].some(property => getComputedStyle(label)[property] !== getComputedStyle(legend)[property]))
      throw Error('Font label must match Color palette typography and color');
  })()`);
  click("Collapse right panel");
  check("Promise.all(document.querySelector('.right-panel').getAnimations().map(animation => animation.finished))");
  browser("hover", 'button[aria-label="Expand right panel"]');
  check(`(() => {
    const panel = document.querySelector('.right-panel.collapsed').getBoundingClientRect();
    const toggle = document.querySelector('.right-panel .panel-toggle');
    const button = toggle.getBoundingClientRect();
    if (!toggle.matches(':hover') || Math.abs(button.left - panel.left - (panel.right - button.right)) > 0.5)
      throw Error('Collapsed toggle hover is off-center');
  })()`);
  click("Expand right panel");
  check("Promise.all(document.querySelector('.right-panel').getAnimations().map(animation => animation.finished))");
  for (const theme of ["Plex", "Precision", "Editorial", "Blue–cyan", "Orange–coral", "Yellow", "Green", "Graphite"]) {
    click(theme);
    for (const mode of ["paper", "night"]) {
      click(mode === "paper" ? "Paper" : "Night");
      fonts("Noto Sans", "Noto Sans", "noto-sans");
      check(`(() => {
        const canvas = document.querySelector('#canvas-stage .canvas');
        const fixed = canvas.querySelector('[data-vector-element="brand-line-1"]');
        if (getComputedStyle(fixed).fill !== 'rgb(18, 52, 86)') throw Error('Fixed override changed');
        if (fixed.getAttribute('font-size') !== '500') throw Error('Overflow silently resized');
        const linked = canvas.querySelector('[data-component="promise"] .text-block-content');
        const expected = '${mode}' === 'night' ? 'rgb(242, 242, 242)' : '${theme}' === 'Graphite' ? 'rgb(32, 32, 32)' : 'rgb(32, 36, 42)';
        if (getComputedStyle(linked).color !== expected) throw Error('Linked ink failed');
      })()`);
    }
  }
  for (const [id, headline, body] of [
    ["hanken-grotesk", "Hanken Grotesk", "Hanken Grotesk"],
    ["plex-sans", "IBM Plex Sans", "IBM Plex Sans"],
    ["noto-sans", "Noto Sans", "Noto Sans"],
    ["plex-serif", "IBM Plex Serif", "IBM Plex Sans"],
  ]) {
    browser("select", '[name="Font"]', id);
    check("document.activeElement.blur()");
    check(`Promise.all([400, 500, 600].map(weight => document.fonts.load(weight + ' 32px "${headline}"')))
      .then(faces => { if (faces.some(group => !group.length || group.some(face => face.status !== 'loaded'))) throw Error('Selected font weights failed to load'); })`);
    fonts(headline, body, id);
    savedTheme({ id: "graphite", mode: "night", typography: id });
  }
  browser("press", "Control+z");
  fonts("Noto Sans", "Noto Sans", "noto-sans");
  browser("press", "Control+Shift+z");
  fonts("IBM Plex Serif", "IBM Plex Sans", "plex-serif");
  click("Precision");
  fonts("IBM Plex Serif", "IBM Plex Sans", "plex-serif");
  browser("press", "Control+z");
  savedTheme({ id: "graphite", mode: "night", typography: "plex-serif" });
  browser("press", "Control+Shift+z");
  click("Paper");
  savedTheme({ id: "precision", mode: "paper", typography: "plex-serif" });
  const saved = JSON.parse(JSON.parse(browser("eval", "localStorage.getItem('konpeki-composer/v1')"))).document;
  assert.deepEqual(saved.slides, deck.slides, "appearance edits changed content or geometry");
  const roundtrip = join(scratch, "roundtrip.json");
  writeFileSync(roundtrip, JSON.stringify(saved));
  browser("select", '[name="Font"]', "plex-sans");
  browser("upload", 'input[type="file"]', roundtrip);
  browser("wait", "--fn", `document.querySelector('[name="Font"]')?.value === 'plex-serif'`);
  fonts("IBM Plex Serif", "IBM Plex Sans", "plex-serif");
  click("Select Text block 1");
  browser("press", "Enter");
  browser("select", ".custom-visual-summary select", "brand-line-1");
  browser("fill", '[name="vector-fill"]', "theme:accent");
  check("document.activeElement.blur()");
  browser("press", "Control+z");
  check(`if(document.querySelector('#canvas-stage [data-vector-element="brand-line-1"]').getAttribute('fill') !== '#123456') throw Error('Undo lost fixed override')`);
  browser("press", "Control+Shift+z");
  check(`if(document.querySelector('#canvas-stage [data-vector-element="brand-line-1"]').getAttribute('fill') !== 'var(--vector-accent)') throw Error('Redo lost binding')`);
  browser("wait", "--fn", `JSON.parse(localStorage.getItem('konpeki-composer/v1')).document.slides[0].components[0].customVisual.elements[0].attributes.fill === 'theme:accent'`);
  browser("reload");
  browser("wait", "--text", "Meet Konpeki");
  fonts("IBM Plex Serif", "IBM Plex Sans", "plex-serif");
  click("Present");
  fonts("IBM Plex Serif", "IBM Plex Sans", "plex-serif");
  check(`if(document.querySelector('.presentation [data-vector-element="brand-line-1"]').getAttribute('fill') !== 'var(--vector-accent)') throw Error('Reload/present lost binding')`);
  click("Exit");
  deck.theme = { id: "editorial", mode: "paper" };
  writeFileSync(file, JSON.stringify(deck));
  browser("upload", 'input[type="file"]', file);
  browser("wait", "--fn", `document.querySelector('button[data-theme="editorial"]')?.getAttribute('aria-pressed') === 'true'`);
  fonts("IBM Plex Serif", "IBM Plex Sans", "plex-serif");
  click("Plex");
  fonts("IBM Plex Serif", "IBM Plex Sans", "plex-serif");
  console.log("PASS: legacy fonts, independent typography across 8 palettes × 2 backgrounds, fixed overrides, overflow warning, geometry preservation, JSON roundtrip, undo/redo, autosave/reload/presentation");
} finally {
  try { browser("close"); } finally { rmSync(scratch, { recursive: true, force: true }); }
}
