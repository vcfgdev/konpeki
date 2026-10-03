import assert from "node:assert/strict";
import { test } from "node:test";
import { constants, promises as fs, type PathLike } from "node:fs";
import { mkdtemp, readFile, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { PDFDocument } from "pdf-lib";
import { chromium } from "playwright";
import { browserDocument, installedBrowser } from "./browser.ts";
import { documentServer } from "./server.ts";
import { referenceGuides } from "../src/lib/alignment.ts";
import { fontData, testFontCSS } from "../scripts/test-fonts.ts";

const source = `<!doctype html><html><head><style>
*{box-sizing:border-box}body{font:16px/20px "IBM Plex Sans"}p{margin:0}
[data-page]{position:relative;width:420px;height:300px;background:white}
body>main:nth-of-type(2){width:300px;height:420px}
#sample{position:absolute;left:23px;top:51px;width:137px;height:63px;padding:7px;border:1px solid black}
</style></head><body><main id="one" data-page><p id="sample">Short text.</p></main><main id="two" data-page><p id="second">Second page</p></main></body></html>`;

async function fixture(run: (path: string, directory: string) => Promise<void>, html = source) {
  const directory = await mkdtemp(join(tmpdir(), "konpeki-html-")), path = join(directory, "document.html");
  try { await writeFile(path, html.replace("<style>", `<style>${testFontCSS}body{font-family:"IBM Plex Sans"}`)); await run(path, directory); }
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

test("browser discovery checks stable Chrome before Chromium and covers platform install locations", async t => fixture(async (path, directory) => {
  const file = await fs.stat(path), folder = await fs.stat(directory);
  let files = new Set<string>(), denied = new Set<string>(), folders = new Set<string>();
  t.mock.method(fs, "stat", async (candidate: PathLike) => {
    if (folders.has(String(candidate))) return folder;
    if (files.has(String(candidate))) return file;
    throw new Error("Not installed");
  });
  const access = t.mock.method(fs, "access", async (candidate: PathLike) => {
    if (denied.has(String(candidate))) throw new Error("Not executable");
  });
  files = new Set(["/early/chromium", "/with spaces/google-chrome-stable", "/with spaces/google-chrome"]);
  folders = new Set(["/early/google-chrome-stable"]);
  assert.equal(await installedBrowser("linux", { PATH: ":relative:/early:/with spaces" }), "/with spaces/google-chrome-stable");
  assert.equal(access.mock.calls.at(-1)!.arguments[1], constants.X_OK);
  denied = new Set(["/with spaces/google-chrome-stable", "/with spaces/google-chrome"]);
  assert.equal(await installedBrowser("linux", { PATH: "/early:/with spaces" }), "/early/chromium");
  assert.equal(await installedBrowser("linux", { PATH: ":relative" }), undefined, "never search the document's working directory implicitly");

  files = new Set([
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Users/test/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ]);
  for (const expected of [...files]) {
    assert.equal(await installedBrowser("darwin", {}, "/Users/test"), expected);
    files.delete(expected);
  }

  files = new Set([
    "C:\\Users\\test\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Users\\test\\AppData\\Local\\Chromium\\Application\\chrome.exe",
    "D:\\Browser Tools\\chrome.exe",
  ]);
  const env = { LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local", PROGRAMFILES: "C:\\Program Files", "PROGRAMFILES(X86)": "C:\\Program Files (x86)", PATH: ';relative;"D:\\Browser Tools"' };
  for (const expected of [...files]) {
    assert.equal(await installedBrowser("win32", env), expected);
    assert.equal(access.mock.calls.at(-1)!.arguments[1], constants.F_OK);
    files.delete(expected);
  }
  assert.equal(await installedBrowser("win32", {}), undefined);
}));

test("browser selection prefers installed Chrome, honors explicit paths, and uses pinned only when none is found", async t => fixture(async (path, directory) => {
  const executablePath = join(directory, "Custom Chrome", "chrome");
  const installed = join(directory, process.platform === "win32" ? "chrome.exe" : "google-chrome-stable");
  await writeFile(installed, "test executable", { mode: 0o755 });
  const previousPath = process.env.PATH;
  process.env.PATH = `${directory}${delimiter}${previousPath ?? ""}`;
  t.after(() => { if (previousPath === undefined) delete process.env.PATH; else process.env.PATH = previousPath; });
  // Isolate discovery from whichever browsers the test host has installed.
  const access = t.mock.method(fs, "access", async (candidate: PathLike) => { if (candidate !== installed) throw new Error("Not installed"); });
  const launch = chromium.launch.bind(chromium);
  const selected = t.mock.method(chromium, "launch", async () => launch({ headless: true }));
  for (const executable of [undefined, executablePath]) {
    const { report } = await browserDocument(path, { page: 1, executablePath: executable });
    assert.equal(report.ok, true, JSON.stringify(report.diagnostics));
    assert.deepEqual(report.pages[0].blocks.find(b => b.id === "sample")?.bounds, { x: 23, y: 51, width: 137, height: 63 });
  }
  const probes = access.mock.callCount();
  await browserDocument(path, { page: 1, executablePath });
  assert.equal(access.mock.callCount(), probes, "explicit paths bypass installed-browser discovery");
  await rm(installed);
  await browserDocument(path, { page: 1 });
  assert.deepEqual(selected.mock.calls.map(call => call.arguments[0]), [
    { headless: true, executablePath: installed }, { headless: true, executablePath },
    { headless: true, executablePath }, { headless: true, executablePath: undefined },
  ]);
  selected.mock.restore();
  const failed = t.mock.method(chromium, "launch", async () => { throw new Error("Launch failed"); });
  await assert.rejects(browserDocument(path, { executablePath }), error => {
    assert(error instanceof Error);
    assert(error.message.includes(JSON.stringify(executablePath)));
    assert.match(error.message, /No fallback browser was used/);
    return true;
  });
  await assert.rejects(browserDocument(path), /No installed Chrome.*konpeki browser install.*pinned headless shell/);
  await writeFile(installed, "test executable", { mode: 0o755 });
  await assert.rejects(browserDocument(path), error => {
    assert(error instanceof Error);
    assert(error.message.includes(JSON.stringify(installed)));
    assert.match(error.message, /No fallback browser was used/);
    return true;
  });
  await assert.rejects(browserDocument(path, { executablePath: " " }), /must not be empty/);
  assert.equal(failed.mock.callCount(), 3, "one launch per selection; empty paths never launch");
}));

test("CLI browser selection rejects missing values and bad paths instead of silently using the default", async () => fixture(async (path, directory) => {
  const cli = join(import.meta.dirname, "../bin/konpeki.mjs"), output = join(directory, "result.png");
  for (const command of ["inspect", "check", "render"]) {
    for (const value of [[], [""], ["--details"], ["Custom Chrome/missing"]]) {
      const result = spawnSync(process.execPath, [cli, command, path, ...(command === "render" ? ["--output", output] : []), "--browser-executable", ...value], {
        cwd: directory, encoding: "utf8", timeout: 10_000,
      });
      assert.equal(result.error, undefined);
      assert.equal(result.status, 1, `${command}: ${value}`);
      const message = command === "render" ? result.stderr : JSON.parse(result.stdout).diagnostics[0].message;
      if (value[0] === "Custom Chrome/missing") {
        assert(message.includes(JSON.stringify(join(directory, "Custom Chrome/missing"))), "relative paths resolve from the working directory and preserve spaces");
        assert.match(message, /No fallback browser was used/);
      } else assert.match(message, /--browser-executable requires/);
      await assert.rejects(readFile(output), /ENOENT/);
    }
  }
  const unsupported = spawnSync(process.execPath, [cli, "validate", path, "--browser-executable", "chrome"], { encoding: "utf8" });
  assert.equal(unsupported.status, 1);
  assert.match(unsupported.stderr, /only supported by inspect, check, and render/);
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
}, '<!doctype html><style>[data-page]{width:300px;height:200px}h1{margin:20px 0;font:24px/30px "IBM Plex Sans"}</style><main id="page" data-page><h1 id="title">Heading</h1></main>'));

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
}, `<!doctype html><style>[data-page]{position:relative;width:500px;height:420px;font:16px/30px "IBM Plex Sans"}p{margin:0}.pos{position:absolute}.large{font-size:24px}.bold{font-size:18.6667px;font-weight:700}</style><main id="page" data-page>
<p id="under" class="pos" style="left:20px;top:20px;width:220px">A broad underlying line</p><p id="over" class="pos" style="left:30px;top:20px;width:30px">XX</p>
<p id="inline" class="pos" style="top:60px">One <strong>inline</strong> sentence</p>
<p id="parent" class="pos" style="top:100px">Headline<span id="nested" style="position:absolute;left:10px;top:0">subtitle</span></p>
<section style="position:absolute;top:160px">
<p id="normal-pass" style="color:#767676">normal pass</p><p id="normal-fail" style="color:#777777">normal fail</p>
<p id="large-pass" class="large" style="color:#777777">large pass</p><p id="large-fail" class="large" style="color:#959595">large fail</p><p id="bold-pass" class="bold" style="color:#777777">bold pass</p></section></main>`));

test("theme checks require a version marker, pair size with leading, and report resolved type", async () => {
  for (const marker of ["", "--kp-theme:1;", "--kp-theme:2;"]) await fixture(async path => {
    const { report } = await browserDocument(path);
    const warnings = report.diagnostics.filter(d => d.code === "theme-value").map(d => d.target);
    if (marker === "--kp-theme:1;") {
      assert.deepEqual(warnings.sort(), ["off-color", "off-leading", "off-size"], "valid size and valid leading from different roles must not pass as a pair");
      assert.equal(report.pages[0].theme?.type.body.size, 16);
      assert.equal(report.pages[0].theme?.type.body.lineHeight, 24);
    } else {
      assert.deepEqual(warnings, [], "generic brand variables and unsupported versions must not activate v1 checks");
      assert.equal(report.pages[0].theme, undefined);
    }
    assert.equal(report.diagnostics.some(d => d.code === "theme-version"), marker === "--kp-theme:2;");
  }, `<!doctype html><style>:root{${marker}--font-family:Brand;--bg:red;--kp-font-family:Arial;--kp-font-body:16px;--kp-leading-body:24px;--kp-font-title:32px;--kp-leading-title:40px;--kp-bg:#fff;--kp-fg:#111;--kp-muted:#666}[data-page]{width:400px;height:500px;background:var(--kp-bg);color:var(--kp-fg);font-family:var(--kp-font-family)}p{font-size:var(--kp-font-body);line-height:var(--kp-leading-body)}</style><main id="page" data-page><p id="token-values">tokens</p><p id="off-size" style="font-size:17px">odd size</p><p id="off-leading" style="line-height:40px">wrong pair</p><p id="off-color" style="color:#123456">odd color</p><section data-theme="custom"><p id="custom" style="font-size:13px;color:#abcdef">custom</p></section></main>`);
});

test("CLI render refuses missing resources and leaves no output", async () => fixture(async (path, directory) => {
  const output = join(directory, "result.png");
  const result = await new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [join(process.cwd(), "bin/konpeki.mjs"), "render", path, "--output", output], { cwd: process.cwd() });
    let stderr = ""; child.stderr.on("data", chunk => stderr += chunk); child.on("error", reject); child.on("close", code => resolve({ code, stderr }));
  });
  assert.notEqual(result.code, 0); assert.match(result.stderr, /missing|failed|refused/i);
  await assert.rejects(readFile(output), /ENOENT/);
}, `<!doctype html><style>@font-face{font-family:Missing;src:url(absent.woff2)}[data-page]{width:200px;height:100px;font-family:Missing;background:url(absent.png)}</style><main id="page" data-page>Missing assets</main>`));

test("document-local font files export successfully and missing files fail font auditing", async () => fixture(async (path, directory) => {
  const font = join(directory, "custom.woff2");
  await writeFile(font, Buffer.from(fontData("mono").split(",")[1], "base64"));
  for (const format of ["png", "pdf"]) {
    const result = await browserDocument(path, { format });
    assert.equal(result.report.ok, true, JSON.stringify(result.report.diagnostics));
    assert(!result.report.diagnostics.some(d => d.code === "font-fallback"));
    assert(result.bytes!.length > 1000, format);
  }
  await rm(font);
  const { report } = await browserDocument(path);
  assert.equal(report.ok, false);
  assert(report.diagnostics.some(d => d.code === "missing-resource" && d.message.includes("custom.woff2")));
  assert(report.diagnostics.some(d => d.code === "font-fallback" && d.target === "text"));
}, '<!doctype html><style>@font-face{font-family:"Document Face";src:url("custom.woff2")} [data-page]{width:480px;height:200px;font:24px/32px "Document Face"}</style><main id="page" data-page><p id="text">A document-owned typeface.</p></main>'));

test("unavailable Google stylesheets or font files remain inspection errors", async t => {
  const launch = chromium.launch.bind(chromium);
  for (const blocked of ["stylesheet", "font"]) {
    const mocked = t.mock.method(chromium, "launch", async () => {
      const browser = await launch();
      const newContext = browser.newContext.bind(browser);
      t.mock.method(browser, "newContext", async (options: Parameters<typeof newContext>[0]) => {
        const context = await newContext(options);
        const newPage = context.newPage.bind(context);
        t.mock.method(context, "newPage", async () => {
          const tab = await newPage();
          await tab.route("https://fonts.googleapis.com/**", route => blocked === "stylesheet"
            ? route.abort()
            : route.fulfill({ contentType: "text/css", body: testFontCSS.replace(/data:font\/woff2;base64,[^"]+/g, "https://fonts.gstatic.com/s/fixture/missing.woff2") }));
          await tab.route("https://fonts.gstatic.com/**", route => route.abort());
          return tab;
        });
        return context;
      });
      return browser;
    });
    await fixture(async path => {
      const { report } = await browserDocument(path);
      assert.equal(report.ok, false, blocked);
      const host = blocked === "stylesheet" ? "fonts.googleapis.com" : "fonts.gstatic.com";
      assert(report.diagnostics.some(d => d.code === "missing-resource" && d.message.includes(host)), blocked);
      assert(report.diagnostics.some(d => d.code === "font-fallback"), blocked);
    }, '<!doctype html><link rel="stylesheet" href="theme.css"><main id="page" data-page data-size="link"><h1 id="title">Required webfonts</h1></main>');
    mocked.mock.restore();
  }
});

test("alignment references are inclusive at two pixels and never snap the source rectangle", () => {
  const rect = { x: 39, y: 71, width: 42, height: 18 };
  assert.deepEqual(referenceGuides(rect, { x: [11, 62], y: [92] }), [{ axis: "x", value: 62 }]);
  assert.deepEqual(rect, { x: 39, y: 71, width: 42, height: 18 });
});
