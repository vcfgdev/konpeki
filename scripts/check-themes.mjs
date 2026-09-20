// Requires pnpm dev and agent-browser. Isolated browser storage; no user data.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const base = process.argv[2] ?? "http://localhost:4318";
const scratch = mkdtempSync(join(tmpdir(), "konpeki-themes-"));
const deck = JSON.parse(readFileSync(new URL("../slides/introducing-konpeki/composition.json", import.meta.url), "utf8"));
deck.slides[0].components[0].customVisual = { format: "vector", description: "Legacy vector fixture", viewBox: { x: 0, y: 0, width: 820, height: 177 }, elements: [{ id: "brand-line-1", kind: "text", text: "Konpeki", attributes: { x: 0, y: 120, fill: "theme:accent", "font-family": "theme:heading-font" } }] };
const element = deck.slides[0].components[0].customVisual.elements[0];
element.attributes.fill = "#123456";
element.attributes["font-size"] = 500;
const file = join(scratch, "overflow.json");
writeFileSync(file, JSON.stringify(deck));
function browser(...args) { return execFileSync("agent-browser", ["--session", "theme-check", ...args], { encoding: "utf8" }).trim(); }
function click(name) { browser("find", "role", "button", "click", "--name", name, "--exact"); }
function check(code) { browser("eval", code); }
try {
  browser("open", base);
  browser("set", "viewport", "1556", "1030", "2");
  browser("upload", 'input[type="file"]', file);
  browser("wait", "--text", "text element exceeds");
  for (const theme of ["Plex", "Precision", "Editorial", "Blue–cyan", "Orange–coral", "Yellow", "Green", "Graphite"]) {
    click(theme);
    for (const mode of ["paper", "night"]) {
      click(mode === "paper" ? "Paper" : "Night");
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
  click("Prompt");
  check(`if(document.querySelector('select[name="Authoring mode"]')) throw Error('Unneeded authoring control remains')`);
  browser("wait", "--text", "Resolve authoring mode to default");
  click("Settings");
  click("Select Text block 1");
  browser("press", "Enter");
  browser("select", ".custom-visual-summary select", "brand-line-1");
  browser("fill", '[name="vector-fill"]', "theme:accent");
  check("document.activeElement.blur()");
  click("Undo");
  check(`if(document.querySelector('#canvas-stage [data-vector-element="brand-line-1"]').getAttribute('fill') !== '#123456') throw Error('Undo lost fixed override')`);
  click("Redo");
  check(`if(document.querySelector('#canvas-stage [data-vector-element="brand-line-1"]').getAttribute('fill') !== 'var(--vector-accent)') throw Error('Redo lost binding')`);
  browser("wait", "--fn", `JSON.parse(localStorage.getItem('konpeki-composer/v1')).document.slides[0].components[0].customVisual.elements[0].attributes.fill === 'theme:accent'`);
  browser("reload");
  browser("wait", "--text", "Meet Konpeki");
  click("Present");
  check(`if(document.querySelector('.presentation [data-vector-element="brand-line-1"]').getAttribute('fill') !== 'var(--vector-accent)') throw Error('Reload/present lost binding')`);
  console.log("PASS: 8 themes × 2 modes, fixed overrides, overflow warning, prompt guidance, linking, undo/redo, autosave/reload/presentation");
} finally { browser("close"); }
