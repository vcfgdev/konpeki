#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { fileSessionPlugin } from "./session-plugin.ts";
import { renderDocument, renderFonts } from "./render.ts";
import {
  readCompositionFile,
} from "./session-store.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  console.error(`Usage:
  konpeki browser install
  konpeki preview <document.html> [--host <host>] [--port <port>] [--json]
  konpeki validate <document.html>
  konpeki check <document.html>
  konpeki inspect <document.html> [--page N] [--details]
  konpeki render <document.html> [--page N] [--format png|pdf] [--scale 2] [--output file]

Pages are one-based. Inspect and PDF include all pages unless --page is supplied.
Scale affects PNG only. Outputs must not already exist.
Legacy composition JSON remains readable by these commands, including its SVG export.`);
}

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function preview(input) {
  const compositionPath = resolve(input);
  await readCompositionFile(compositionPath);
  const token = randomBytes(24).toString("base64url");
  const host = option("--host", "127.0.0.1");
  const port = Number(option("--port", "4318"));
  const json = process.argv.includes("--json");
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("Port must be an integer from 0 to 65535 (0 chooses a free port).");
  const server = await createServer({
    root,
    configFile: resolve(root, "vite.config.ts"),
    logLevel: json ? "silent" : "info",
    server: {
      host, port, strictPort: process.argv.includes("--port"),
      fs: { allow: [
        root,
        // npm hoists dependencies outside this package. Allow their assets, not the
        // surrounding user's workspace; session-plugin retains fs.deny rules.
        dirname(fileURLToPath(import.meta.resolve("harfbuzzjs"))),
        ...["ibm-plex-sans", "ibm-plex-serif", "noto-sans", "hanken-grotesk"]
          .map(font => dirname(fileURLToPath(import.meta.resolve(`@fontsource/${font}/package.json`)))),
      ] },
    },
    plugins: [fileSessionPlugin({ compositionPath, token })],
  });
  try {
    await server.listen();
  } catch (error) {
    await server.close();
    throw error;
  }
  const address = server.httpServer?.address();
  const actualPort = address && typeof address === "object" ? address.port : port;
  const displayHost = host === "0.0.0.0" || host === "::" ? "localhost" : host;
  const url = `http://${displayHost.includes(":") ? `[${displayHost}]` : displayHost}:${actualPort}/?session=${encodeURIComponent(token)}`;
  if (json) console.log(JSON.stringify({ type: "ready", compositionPath, url }));
  else {
    console.log(`Konpeki is editing ${compositionPath}`);
    console.log(url);
    console.log(`Waiting for edits. Press Ctrl+C to stop.`);
  }
}

async function validate(input) {
  const result = await readCompositionFile(resolve(input));
  console.log(`${result.name}: valid (${result.revision})`);
}

async function render(input) {
  const { document } = await readCompositionFile(resolve(input));
  const format = option("--format", "png"), selected = option("--page");
  const result = await renderDocument(document, { format, page: selected === undefined ? undefined : Number(selected), scale: Number(option("--scale", "2")) });
  const output = resolve(option("--output", input.replace(/\.json$/i, "") + (selected ? `-page-${selected}` : "") + `.${format}`));
  await writeFile(output, result.bytes, { flag: "wx" });
  console.log(output);
}

async function check(input) {
  const { document } = await readCompositionFile(resolve(input));
  const [{ lowerPage }, { checkPageNode }, fonts] = await Promise.all([
    import("../composition/lower.ts"), import("../composition/check-node.ts"), renderFonts(),
  ]);
  const diagnostics = document.pages.flatMap(page => checkPageNode(lowerPage(document, page, fonts), fonts));
  const ok = !diagnostics.some(item => item.severity === "error");
  console.log(JSON.stringify({ ok, diagnostics }, null, 2));
  if (!ok) process.exitCode = 1;
}

async function inspect(input) {
  const { document, revision } = await readCompositionFile(resolve(input));
  const selected = process.argv.includes("--page") ? Number(option("--page")) : undefined;
  const details = process.argv.includes("--details");
  if (selected !== undefined && (!Number.isInteger(selected) || selected < 1 || selected > document.pages.length))
    throw new Error(`Page must be an integer from 1 to ${document.pages.length}.`);
  const [{ lowerPage }, { inspectPage, summarizePage }, { checkPageNode }, fonts] = await Promise.all([
    import("../composition/lower.ts"), import("../composition/inspect.ts"), import("../composition/check-node.ts"), renderFonts(),
  ]);
  const diagnostics = [];
  const pages = document.pages.flatMap((page, index) => {
    if (selected !== undefined && selected !== index + 1) return [];
    const scene = lowerPage(document, page, fonts);
    diagnostics.push(...checkPageNode(scene, fonts));
    return [{ pageNumber: index + 1, ...(details ? inspectPage(page, scene, fonts) : summarizePage(page, scene)) }];
  });
  const ok = !diagnostics.some(item => item.severity === "error");
  console.log(JSON.stringify({ schema: "konpeki-inspection/v1", detail: details ? "full" : "summary", revision, units: "page-pixels", ok, pages, diagnostics }, null, 2));
  if (!ok) process.exitCode = 1;
}

async function html(command, input) {
  if (command === "preview") {
    const port = Number(option("--port", "4318"));
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Port must be an integer from 0 to 65535.");
    const { previewHTML } = await import("../html/server.ts");
    const { url } = await previewHTML(resolve(input), option("--host", "127.0.0.1"), port, root);
    console.log(process.argv.includes("--json") ? JSON.stringify({ type: "ready", documentPath: resolve(input), url }) : `Konpeki is reviewing ${resolve(input)}\n${url}\nPress Ctrl+C to stop.`);
  } else if (command === "validate") {
    const { fileSource } = await import("../html/source.ts");
    const snapshot = await fileSource(resolve(input)).read();
    console.log(`${snapshot.name}: valid (${snapshot.revision})`);
  } else if (["inspect", "check", "render"].includes(command)) {
    const { browserDocument } = await import("../html/browser.ts");
    const page = option("--page"), format = option("--format", "png");
    const { bytes, report } = await browserDocument(resolve(input), {
      page: page === undefined ? undefined : Number(page), details: process.argv.includes("--details"),
      ...(command === "render" ? { format, scale: Number(option("--scale", "2")) } : {}),
    });
    if (command === "render") {
      for (const diagnostic of report.diagnostics) console.error(`${diagnostic.severity}: ${diagnostic.page}/${diagnostic.target}: ${diagnostic.message}`);
      const output = resolve(option("--output", input.replace(/\.html?$/i, "") + (page ? `-page-${page}` : "") + `.${format}`));
      await writeFile(output, bytes, { flag: "wx" });
      console.log(output);
    } else {
      console.log(JSON.stringify(command === "check" ? { ok: report.ok, diagnostics: report.diagnostics } : report, null, 2));
      if (!report.ok) process.exitCode = 1;
    }
  } else { usage(); process.exitCode = 1; }
}

const command = process.argv[2];
const input = process.argv[3];
if (!command || !input) {
  usage();
  process.exitCode = 1;
} else {
  try {
    if (command === "browser" && input === "install") {
      const { spawnSync } = await import("node:child_process");
      const cli = resolve(dirname(fileURLToPath(import.meta.resolve("playwright/package.json"))), "cli.js");
      const result = spawnSync(process.execPath, [cli, "install", "chromium"], { stdio: "inherit" });
      if (result.error) throw result.error;
      process.exitCode = result.status ?? 1;
    } else if (/\.html?$/i.test(input)) await html(command, input);
    else if (command === "preview") await preview(input);
    else if (command === "validate") await validate(input);
    else if (command === "render") await render(input);
    else if (command === "check") await check(input);
    else if (command === "inspect") await inspect(input);
    else {
      usage();
      process.exitCode = 1;
    }
  } catch (error) {
    if (command === "check") console.log(JSON.stringify({ ok: false, diagnostics: [{ code: "invalid-document", severity: "error", message: error instanceof Error ? error.message : String(error) }] }, null, 2));
    else if (command === "inspect") console.log(JSON.stringify({ schema: "konpeki-inspection/v1", ok: false, pages: [], diagnostics: [{ code: "inspection-failed", severity: "error", message: error instanceof Error ? error.message : String(error) }] }, null, 2));
    else console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
