import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { PDFDocument } from "pdf-lib";
import { browserDocument } from "./browser.ts";
import { documentServer } from "./server.ts";
import { referenceGuides } from "../src/lib/alignment.ts";

const source = `<!doctype html><html><head><style>
*{box-sizing:border-box}body{font:16px/20px Arial}p{margin:0}
[data-page]{position:relative;width:420px;height:300px;background:white}
body>main:nth-of-type(2){width:300px;height:420px}
#sample{position:absolute;left:23px;top:51px;width:137px;height:63px;padding:7px;border:1px solid black}
</style></head><body><main id="one" data-page><p id="sample">Short text.</p></main><main id="two" data-page><p id="second">Second page</p></main></body></html>`;

async function fixture(run: (path: string, directory: string) => Promise<void>, html = source) {
  const directory = await mkdtemp(join(tmpdir(), "konpeki-html-")), path = join(directory, "document.html");
  try { await writeFile(path, html); await run(path, directory); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test("browser measures padded text separately, preserves page selectors, and exports mixed-size artifacts", async () => fixture(async path => {
  const { report } = await browserDocument(path, { details: true });
  assert.equal(report.ok, true, JSON.stringify(report.diagnostics));
  assert.deepEqual(report.pages.map(p => [p.id, p.width, p.height]), [["one", 420, 300], ["two", 300, 420]]);
  assert.deepEqual(report.pages[0].blocks.find(b => b.id === "sample")?.bounds, { x: 23, y: 51, width: 137, height: 63 });
  assert.equal(report.pages[0].text?.find(t => t.target === "sample")?.bounds[0].x, 31);
  const png = Buffer.from((await browserDocument(path, { page: 2, format: "png", scale: 2 })).bytes!);
  assert.equal(png.readUInt32BE(16), 600); assert.equal(png.readUInt32BE(20), 840);
  const pdf = await PDFDocument.load((await browserDocument(path, { format: "pdf" })).bytes!);
  assert.equal(pdf.getPageCount(), 2);
  assert.deepEqual(pdf.getPages().map(p => [Math.round(p.getWidth()), Math.round(p.getHeight())]), [[315, 225], [225, 315]]);
}));

test("overflow checks distinguish a touching edge, crossing edge, clipped text, hidden content and missing assets", async () => fixture(async path => {
  const { report } = await browserDocument(path);
  assert.equal(report.ok, false);
  const codes = report.diagnostics.map(d => `${d.target}/${d.code}`);
  assert(codes.includes("outside/page-overflow"));
  assert(codes.includes("clip/clipped-text"));
  assert(codes.includes("missing/missing-image"));
  assert(!codes.some(c => c.startsWith("edge/") || c.startsWith("hidden/")));
}, source.replace('<p id="sample">Short text.</p>', `<p id="edge" style="position:absolute;left:389px;top:40px;width:31px;height:20px"></p>
<p id="outside" style="position:absolute;left:391px;top:40px;width:31px;height:20px"></p>
<p id="clip" style="position:absolute;left:20px;top:80px;width:90px;height:20px;overflow:hidden">Several words need more than one line of text.</p>
<p id="hidden" style="display:none;position:absolute;left:900px">Not rendered</p><img id="missing" src="missing.png" alt="Missing">`)));

test("document and assets require the capability, deny symlink escapes, and reject stale corrections", async () => fixture(async (path, directory) => {
  await writeFile(join(directory, "local.css"), "p{color:blue}");
  await symlink(join(directory, ".."), join(directory, "outside"));
  const server = await documentServer(path);
  try {
    assert.equal((await fetch(`${server.origin}/__konpeki/html`)).status, 403);
    assert.equal((await fetch(`${server.origin}/__konpeki/html/wrong/document`)).status, 403);
    assert.equal((await fetch(`${server.origin}${server.prefix}/document/local.css`)).status, 200);
    assert.equal((await fetch(`${server.origin}${server.prefix}/document/document.html`)).status, 403);
    const external = join(tmpdir(), `konpeki-outside-${Date.now()}.css`);
    await writeFile(external, "private");
    try { assert.equal((await fetch(`${server.origin}${server.prefix}/document/outside/${external.split("/").at(-1)}`)).status, 403); }
    finally { await rm(external); }
    const result = await fetch(`${server.origin}/__konpeki/html`, { method: "PATCH", headers: { "x-konpeki-session": server.token, "content-type": "application/json" }, body: JSON.stringify({ revision: "stale", edit: { kind: "delete", page: "one", id: "sample" } }) });
    assert.equal(result.status, 409);
  } finally { await server.close(); }
}));

test("relative CSS and inline SVG references work at the page's own viewport width", async () => fixture(async (path, directory) => {
  await writeFile(join(directory, "local.css"), "@media(max-width:500px){#sample{width:113px}}");
  const { report } = await browserDocument(path);
  assert.equal(report.ok, true, JSON.stringify(report.diagnostics));
  assert.equal(report.pages[0].blocks.find(b => b.id === "sample")?.bounds.width, 113);
  assert.equal(report.pages[0].blocks.find(b => b.id === "instance")?.bounds.width, 37);
}, source.replace("</head>", '<link rel="stylesheet" href="local.css"></head>').replace('Short text.</p>', 'Short text.</p><svg width="100" height="40"><defs><rect id="shape" width="37" height="19"/><path id="unpainted" d="M-100 -100L1000 1000"/></defs><use id="instance" href="#shape" x="7" y="9"/></svg>')));

test("first-child margins stay inside the page rather than shifting the page in its iframe", async () => fixture(async path => {
  const { report } = await browserDocument(path);
  assert.equal(report.ok, true, JSON.stringify(report.diagnostics));
  assert.equal(report.pages[0].blocks.find(b => b.id === "title")?.bounds.y, 20);
}, '<!doctype html><style>[data-page]{width:300px;height:200px}h1{margin:20px 0;font:24px/30px Arial}</style><main id="page" data-page><h1 id="title">Heading</h1></main>'));

test("inspection reports missing stylesheets and background assets instead of accepting a fallback", async () => fixture(async path => {
  const { report } = await browserDocument(path);
  assert.equal(report.ok, false);
  assert(report.diagnostics.some(d => d.code === "missing-resource" && d.message.includes("absent.css")));
  assert(report.diagnostics.some(d => d.code === "missing-resource" && d.message.includes("absent.png")));
}, source.replace("</head>", '<link rel="stylesheet" href="absent.css"></head>').replace("background:white", "background:url(absent.png)")));

test("inspection distinguishes text parents for overlap and handles inline text and contrast boundaries", async () => fixture(async path => {
  const { report } = await browserDocument(path);
  const diagnostics = report.diagnostics.map(d => `${d.target}/${d.code}`);
  assert(diagnostics.includes("over/text-overlap"), "overlap is reported even when only the later text is narrow");
  assert(diagnostics.includes("nested/text-overlap"), "nested absolute text must not be exempted as inline flow");
  assert(!diagnostics.some(d => d.startsWith("inline/") && d.endsWith("text-overlap")), "inline descendants in one text parent do not overlap each other");
  assert(diagnostics.includes("normal-fail/low-contrast"));
  assert(!diagnostics.includes("normal-pass/low-contrast"));
  assert(!diagnostics.includes("large-pass/low-contrast"));
  assert(diagnostics.includes("large-fail/low-contrast"));
  assert(!diagnostics.includes("bold-pass/low-contrast"));
}, `<!doctype html><style>[data-page]{position:relative;width:500px;height:420px;font:16px/30px Arial}p{margin:0}.pos{position:absolute}.large{font-size:24px}.bold{font-size:18.6667px;font-weight:700}</style><main id="page" data-page>
<p id="under" class="pos" style="left:20px;top:20px;width:220px">A broad underlying line</p><p id="over" class="pos" style="left:30px;top:20px;width:30px">XX</p>
<p id="inline" class="pos" style="top:60px">One <strong>inline</strong> sentence</p>
<p id="parent" class="pos" style="top:100px">Headline<span id="nested" style="position:absolute;left:10px;top:0">subtitle</span></p>
<section style="position:absolute;top:160px">
<p id="normal-pass" style="color:#767676">normal pass</p><p id="normal-fail" style="color:#777777">normal fail</p>
<p id="large-pass" class="large" style="color:#777777">large pass</p><p id="large-fail" class="large" style="color:#959595">large fail</p><p id="bold-pass" class="bold" style="color:#777777">bold pass</p></section></main>`));

test("theme diagnostics use computed values and honor a custom-theme ancestor", async () => fixture(async path => {
  const { report } = await browserDocument(path);
  const warnings = report.diagnostics.filter(d => d.code === "theme-value").map(d => d.target);
  assert(warnings.includes("off-size")); assert(warnings.includes("off-color"));
  assert(!warnings.includes("token-values")); assert(!warnings.includes("custom"));
}, `<!doctype html><style>:root{--font-family:Arial;--font-body:16px;--font-title:32px;--bg:#fff;--fg:#111;--muted:#666}[data-page]{width:400px;height:250px;background:var(--bg);color:var(--fg);font-family:var(--font-family)}p{font-size:var(--font-body)}</style><main id="page" data-page><p id="token-values">tokens</p><p id="off-size" style="font-size:17px">odd size</p><p id="off-color" style="color:#123456">odd color</p><section data-theme="custom"><p id="custom" style="font-size:13px;color:#abcdef">custom</p></section></main>`));

test("CLI render refuses missing resources and leaves no output", async () => fixture(async (path, directory) => {
  const output = join(directory, "result.png");
  const result = await new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [join(process.cwd(), "bin/konpeki.mjs"), "render", path, "--output", output], { cwd: process.cwd() });
    let stderr = ""; child.stderr.on("data", chunk => stderr += chunk); child.on("error", reject); child.on("close", code => resolve({ code, stderr }));
  });
  assert.notEqual(result.code, 0); assert.match(result.stderr, /missing|failed|refused/i);
  await assert.rejects(readFile(output), /ENOENT/);
}, `<!doctype html><style>@font-face{font-family:Missing;src:url(absent.woff2)}[data-page]{width:200px;height:100px;font-family:Missing;background:url(absent.png)}</style><main id="page" data-page>Missing assets</main>`));

test("alignment references are inclusive at two pixels and never snap the source rectangle", () => {
  const rect = { x: 39, y: 71, width: 42, height: 18 };
  assert.deepEqual(referenceGuides(rect, { x: [11, 62], y: [92] }), [{ axis: "x", value: 62 }]);
  assert.deepEqual(rect, { x: 39, y: 71, width: 42, height: 18 });
});
