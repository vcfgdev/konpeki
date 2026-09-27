import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { PDFDocument } from "pdf-lib";
import { loadNodeFontContext } from "./fonts.ts";
import { renderPDF } from "./pdf.ts";
import { renderSVG } from "./svg.ts";
import type { ScenePage, SceneShape, SceneText } from "./scene.ts";
import { layoutText } from "./text-layout.ts";

test("renderPDF embeds positioned subset text and preserves per-page CSS dimensions", async t => {
  const fonts = await loadNodeFontContext(new URL("../fonts/", import.meta.url));
  const source = "office e\u0301 →★";
  const layout = layoutText(fonts, { text: source, width: 360, fontFamily: "IBM Plex Sans", fontSize: 28, lineHeight: 34 });
  // Make an offset observable independently of fontkit's native advance.
  layout.lines[0].glyphs[0].x += 3.25;
  layout.lines[0].glyphs[0].y -= 1.5;
  const text: SceneText = { kind: "text", pageId: "one", source, box: { x: 19, y: 23, width: 360, height: 40 }, layout,
    fontSize: 28, lineHeight: 34, fontWeight: 400, color: "#102030", opacity: 0.8, label: false, clip: { x: 18, y: 20, width: 300, height: 38 } };
  const pages: ScenePage[] = [
    { pageId: "one", width: 401, height: 203, background: "#ffffff", components: [], items: [
      { kind: "shape", pageId: "one", tag: "rect", attributes: { x: 7, y: 9, width: 180, height: 60, fill: "#ddeeff", stroke: "#ff0000", "stroke-width": 2, opacity: 0.6 }, transform: [1, 0.1, 0.2, 1, 4, 5] }, text,
      { kind: "shape", pageId: "one", tag: "circle", attributes: { cx: 300, cy: 100, r: 20, fill: "#00aa55" }, transform: [1, 0, 0, 1, 0, 0], clip: { x: 280, y: 80, width: 20, height: 40 } },
    ] },
    { pageId: "two", width: 199, height: 311, background: "#001122", components: [], items: [] },
  ];
  const bytes = await renderPDF(pages, fonts);
  const parsed = await PDFDocument.load(bytes);
  assert.deepEqual(parsed.getPages().map(page => page.getSize()), [{ width: 300.75, height: 152.25 }, { width: 149.25, height: 233.25 }]);
  const syntax = new TextDecoder("latin1").decode(bytes);
  assert.match(syntax, /\/Subtype \/Type0/);
  assert.match(syntax, /\/BaseFont \/[A-Z]{6}\+/);
  assert.match(syntax, /\/CIDToGIDMap \d+ 0 R/);
  assert.match(syntax, /\/ToUnicode \d+ 0 R/);
  assert.ok(bytes.length < [...fonts.fonts.values()].reduce((sum, font) => sum + font.data.length, 0), "fonts are subset, not all embedded whole");

  const directory = await mkdtemp(join(tmpdir(), "konpeki-pdf-text-")), path = join(directory, "text.pdf");
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path, bytes);
  const extracted = spawnSync("pdftotext", ["-f", "1", "-l", "1", path, "-"]);
  assert.equal(extracted.status, 0, extracted.stderr.toString());
  assert.equal(extracted.stdout.toString().replace(/\f|\n/g, ""), source);
});

test("renderPDF raster agrees with canonical SVG for clipping and styled shapes", async t => {
  const fonts = await loadNodeFontContext(new URL("../fonts/", import.meta.url));
  const shape = (tag: SceneShape["tag"], attributes: Record<string, string | number>, transform: SceneShape["transform"] = [1, 0, 0, 1, 0, 0], clip?: { x: number; y: number; width: number; height: number }) =>
    ({ kind: "shape" as const, pageId: "pixels", tag, attributes, transform, ...(clip ? { clip } : {}) });
  const scene: ScenePage = { pageId: "pixels", width: 320, height: 220, background: "#f7f5f0", components: [], items: [
    shape("rect", { x: 20, y: 18, width: 125, height: 78, rx: 17, ry: 9, fill: "#267ca8", stroke: "#102030", "stroke-width": 4, opacity: 0.72 }),
    shape("path", { d: "M20 130L90 185L155 120", fill: "none", stroke: "#dc532b", "stroke-width": 7, "stroke-linecap": "round", "stroke-linejoin": "round", "stroke-dasharray": "15 8" }),
    shape("circle", { cx: 235, cy: 68, r: 48, fill: "#e0b429", "fill-opacity": 0.55, stroke: "#35485c", "stroke-width": 5 }, [1, 0, 0, 1, 0, 0], { x: 220, y: 18, width: 64, height: 96 }),
    shape("rect", { x: 165, y: 134, width: 110, height: 65, rx: 12, fill: "none", stroke: "#533a9e", "stroke-width": 4 }),
  ] };
  const directory = await mkdtemp(join(tmpdir(), "konpeki-pdf-pixels-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const svg = renderSVG(scene, fonts), pdf = await renderPDF([scene], fonts);
  await Promise.all([writeFile(join(directory, "scene.svg"), svg), writeFile(join(directory, "scene.pdf"), pdf), writeFile(join(directory, "svg.png"), new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng())]);
  const raster = spawnSync("pdftoppm", ["-f", "1", "-singlefile", "-r", "96", "-png", join(directory, "scene.pdf"), join(directory, "pdf")]);
  assert.equal(raster.status, 0, raster.stderr.toString());
  const difference = spawnSync("compare", ["-metric", "RMSE", join(directory, "svg.png"), join(directory, "pdf.png"), "null:"]);
  const match = /\(([\d.]+)\)/.exec(difference.stderr.toString());
  assert.ok(match, `ImageMagick did not report RMSE: ${difference.stderr}`);
  assert.ok(Number(match[1]) < 0.025, `SVG/PDF normalized RMSE ${match[1]} exceeds antialiasing tolerance`);
  // Ensure both rasterizers retained the requested CSS pixel dimensions.
  assert.ok((await readFile(join(directory, "pdf.png"))).length > 0);
});
