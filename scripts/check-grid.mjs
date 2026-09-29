import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { assertComposition } from "../composition/validate.ts";
import { loadNodeFontContext } from "../composition/fonts.ts";
import { lowerPage } from "../composition/lower.ts";
import { renderSVG } from "../composition/svg.ts";
import { checkPageNode } from "../composition/check-node.ts";

const args = process.argv.slice(2), output = resolve(args.find(value => !value.startsWith("--")) ?? "/tmp/konpeki-grid-review");
const baseline = process.env.KONPEKI_GRID_BASELINE;
const files = ["architecture", "sankey", "release", "explainer", "intro"].map(name => ({ name,
  path: baseline ? join(baseline, `${name}.json`) : resolve(name === "intro" ? "slides/introducing-konpeki/composition.json" : `slides/gallery/${name}.json`),
}));
mkdirSync(output, { recursive: true });
const fonts = await loadNodeFontContext(new URL("../fonts/", import.meta.url));
const failures = [], pages = [];
for (const file of files) {
  const document = assertComposition(JSON.parse(readFileSync(file.path, "utf8")));
  for (const [index, page] of document.pages.entries()) {
    const scene = lowerPage(document, page, fonts), diagnostics = checkPageNode(scene, fonts);
    const label = `${file.name}-${index + 1}`, svg = renderSVG(scene, fonts);
    writeFileSync(join(output, `${label}.svg`), svg);
    writeFileSync(join(output, `${label}.png`), new Resvg(svg, { font: { loadSystemFonts: false }, fitTo: { mode: "zoom", value: 2 } }).render().asPng());
    pages.push({ label, diagnostics });
    const errors = diagnostics.filter(diagnostic => diagnostic.severity === "error");
    failures.push(...errors.map(error => `${label}: ${error.code}: ${error.message}`));
    console.log(`${errors.length ? "FAIL" : "PASS"} ${label} — ${diagnostics.length} diagnostic(s)`);
    for (const diagnostic of diagnostics) console.log(`  ${diagnostic.severity.toUpperCase()} ${diagnostic.code} ${diagnostic.componentId ?? "page"}${diagnostic.elementId ? `/${diagnostic.elementId}` : ""}: ${diagnostic.message}`);
  }
}
writeFileSync(join(output, "checks.json"), JSON.stringify({ failures, pages }, null, 2));
if (!args.includes("--report-only")) assert.deepEqual(failures, []);
