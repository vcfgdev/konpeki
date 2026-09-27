// Conformance check for the two scene writers. Chromium is deliberately the
// SVG oracle: resvg is a second SVG implementation, not the browser target.
// Requires Vite on http://localhost:4318 plus Poppler and ImageMagick.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { loadNodeFontContext } from "../composition/fonts.ts";
import { lowerPage } from "../composition/lower.ts";
import { renderPDF } from "../composition/pdf.ts";
import { renderSVG } from "../composition/svg.ts";

const documents = [
  "slides/gallery/architecture.json", "slides/gallery/sankey.json",
  "slides/gallery/release.json", "slides/gallery/explainer.json",
  "slides/introducing-konpeki/composition.json",
];
const keep = process.argv.includes("--keep");
const root = resolve(import.meta.dirname, "..");
const output = await mkdtemp(join(tmpdir(), "konpeki-scene-writers-"));
const session = "writer-check";
const browser = (...args) => execFileSync("agent-browser", ["--session", session, ...args], { encoding: "utf8", maxBuffer: 32 << 20 }).trim();
const run = (command, args) => {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
};
const metric = (left, right, extra = []) => {
  const result = spawnSync("compare", ["-metric", "RMSE", ...extra, left, right, "null:"], { encoding: "utf8" });
  const match = /\(([\d.e+-]+)\)/i.exec(result.stderr);
  if (!match) throw new Error(`compare did not report RMSE: ${result.stderr}`);
  return Number(match[1]);
};
const blur = path => {
  const target = path.replace(/\.png$/, "-blur.png");
  run("magick", [path, "-blur", "0x0.65", target]);
  return target;
};
const characters = value => [...value.normalize("NFC").replace(/\s+/gu, "").replace(/\u00ad/gu, "")].reduce((map, character) => map.set(character, (map.get(character) ?? 0) + 1), new Map());

try {
  const fonts = await loadNodeFontContext(new URL("../fonts/", import.meta.url));
  const pages = [];
  for (const relative of documents) {
    const document = JSON.parse(await readFile(resolve(root, relative), "utf8"));
    document.slides.forEach((page, index) => pages.push({ document, page, index, label: `${basename(relative, ".json")}-${index + 1}` }));
  }
  if (pages.length !== 11) throw new Error(`Expected 11 fixture pages, found ${pages.length}`);
  const scenes = pages.map(({ document, page }) => lowerPage(document, page, fonts));
  const pdfPath = join(output, "all.pdf");
  await writeFile(pdfPath, await renderPDF(scenes, fonts));
  run("pdftoppm", ["-r", "192", "-png", pdfPath, join(output, "pdf")]);
  run("pdftotext", ["-layout", pdfPath, join(output, "all.txt")]);

  browser("open", "http://localhost:4318");
  browser("set", "viewport", "1280", "720", "2");
  const results = [];
  for (let index = 0; index < pages.length; index++) {
    const { label } = pages[index], scene = scenes[index], svg = renderSVG(scene, fonts);
    const svgPath = join(output, `${label}.svg`), resvgPath = join(output, `${label}-resvg.png`), chromePath = join(output, `${label}-chrome.png`);
    await writeFile(svgPath, svg);
    await writeFile(resvgPath, new Resvg(svg, { font: { loadSystemFonts: false }, fitTo: { mode: "zoom", value: 2 } }).render().asPng());
    browser("open", `file://${svgPath}`);
    const encoded = JSON.parse(browser("eval", `(async()=>{const s=new XMLSerializer().serializeToString(document.documentElement),u=URL.createObjectURL(new Blob([s],{type:'image/svg+xml'})),i=new Image();await new Promise((r,j)=>{i.onload=r;i.onerror=j;i.src=u});const c=document.createElementNS('http://www.w3.org/1999/xhtml','canvas');c.width=i.width*2;c.height=i.height*2;const x=c.getContext('2d');x.scale(2,2);x.drawImage(i,0,0);URL.revokeObjectURL(u);return c.toDataURL('image/png').slice(22)})()`));
    await writeFile(chromePath, Buffer.from(encoded, "base64"));
    const pdfRaster = join(output, `pdf-${String(index + 1).padStart(2, "0")}.png`);
    const svgRmse = metric(chromePath, resvgPath), pdfRmse = metric(chromePath, pdfRaster);
    const svgEdge = metric(blur(chromePath), blur(resvgPath)), pdfEdge = metric(blur(chromePath), blur(pdfRaster));
    // Raw RMSE admits rasterizer edge coverage differences; blurred RMSE prevents
    // those differences from hiding displaced geometry, wrong fills, or glyphs.
    const passed = svgRmse <= 0.01 && svgEdge <= 0.006 && pdfRmse <= 0.05 && pdfEdge <= 0.035;
    results.push({ page: label, svgRmse, svgEdge, pdfRmse, pdfEdge, passed });
  }
  const extracted = (await readFile(join(output, "all.txt"), "utf8")).split("\f");
  const missing = scenes.flatMap((scene, page) => {
    const expected = characters(scene.items.filter(item => item.kind === "text").map(item => item.source).join(""));
    const actual = characters(extracted[page] ?? "");
    return [...expected].filter(([character, count]) => (actual.get(character) ?? 0) < count).map(([character, count]) => ({ page: pages[page].label, character, expected: count, actual: actual.get(character) ?? 0 }));
  });
  console.table(results);
  console.log(`PDF text: ${scenes.reduce((n, scene) => n + scene.items.filter(item => item.kind === "text").length, 0)} scene strings checked; ${missing.length} missing.`);
  if (missing.length) console.error("Missing extracted PDF characters:", missing);
  if (results.some(result => !result.passed) || missing.length) throw new Error(`Scene writer conformance failed; inspect ${output}`);
  console.log(`PASS: 11 pages; scratch output ${output}${keep ? " retained" : " removed"}.`);
} finally {
  try { browser("close"); } catch {}
  if (!keep) await rm(output, { recursive: true, force: true });
}
