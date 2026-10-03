#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  console.error(`Usage:
  konpeki browser install
  konpeki preview <document.html> [--host <host>] [--port <port>] [--json]
  konpeki validate <document.html>
  konpeki check <document.html> [--browser-executable path]
  konpeki inspect <document.html> [--page N] [--details] [--browser-executable path]
  konpeki render <document.html> [--page N] [--format png|pdf] [--scale 2] [--output file] [--browser-executable path]

Pages are one-based. Inspect and PDF include all pages unless --page is supplied.
Scale affects PNG only. Outputs must not already exist.
Installed Chrome or Chromium is used by default, then the pinned headless shell if none is found.
Browser install downloads that shell. Inspection and export never download browsers.
Use --browser-executable to select a specific Chrome or Chromium executable.`);
}

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function html(command, input) {
  if (!/\.html?$/i.test(input)) throw new Error("Konpeki accepts HTML documents only.");
  const browserExecutable = option("--browser-executable");
  if (process.argv.includes("--browser-executable")) {
    if (!["inspect", "check", "render"].includes(command)) throw new Error("--browser-executable is only supported by inspect, check, and render.");
    if (!browserExecutable?.trim() || browserExecutable.startsWith("--")) throw new Error("--browser-executable requires a Chrome or Chromium executable path.");
  }
  if (command === "preview") {
    const port = Number(option("--port", "4318"));
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Port must be an integer from 0 to 65535.");
    const { previewHTML } = await import("../html/server.ts");
    const documentPath = resolve(input);
    const { url } = await previewHTML(documentPath, option("--host", "127.0.0.1"), port, root, process.argv.includes("--port"));
    console.log(process.argv.includes("--json") ? JSON.stringify({ type: "ready", documentPath, url }) : `Konpeki is reviewing ${documentPath}\n${url}\nPress Ctrl+C to stop.`);
    return;
  }
  if (command === "validate") {
    const { fileSource } = await import("../html/source.ts");
    const snapshot = await fileSource(resolve(input)).read();
    console.log(`${snapshot.name}: valid (${snapshot.revision})`);
    return;
  }
  if (!["inspect", "check", "render"].includes(command)) throw new Error(`Unknown command: ${command}`);
  const { browserDocument } = await import("../html/browser.ts");
  const page = option("--page"), format = option("--format", "png");
  const { bytes, report } = await browserDocument(resolve(input), {
    page: page === undefined ? undefined : Number(page), details: process.argv.includes("--details"),
    executablePath: browserExecutable === undefined ? undefined : resolve(browserExecutable),
    ...(command === "render" ? { format, scale: Number(option("--scale", "2")) } : {}),
  });
  if (command === "render") {
    for (const diagnostic of report.diagnostics) console.error(`${diagnostic.severity} ${diagnostic.code}: ${diagnostic.page}/${diagnostic.target}: ${diagnostic.message}`);
    if (!report.ok) throw new Error("Render refused because the document has errors.");
    const output = resolve(option("--output", input.replace(/\.html?$/i, "") + (page ? `-page-${page}` : "") + `.${format}`));
    await writeFile(output, bytes, { flag: "wx" });
    console.log(output);
    // Judgment rules no diagnostic covers, shown while the rendered page is in hand.
    const { reviewChecklist } = await import("../html/floor.ts");
    console.error(`Review ${output} at its viewing size and enlarged, against skills/konpeki/floor.md:\n${reviewChecklist().map(rule => `- ${rule}`).join("\n")}`);
  } else {
    console.log(JSON.stringify(command === "check" ? { ok: report.ok, diagnostics: report.diagnostics } : report, null, 2));
    if (!report.ok) process.exitCode = 1;
  }
}

const command = process.argv[2], input = process.argv[3];
if (command === "browser" && input === "install") {
  const cli = resolve(dirname(fileURLToPath(import.meta.resolve("playwright/package.json"))), "cli.js");
  const result = spawnSync(process.execPath, [cli, "install", "--only-shell", "chromium"], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} else if (!command || !input) {
  usage(); process.exitCode = 1;
} else {
  try { await html(command, input); }
  catch (error) {
    if (command === "check") console.log(JSON.stringify({ ok: false, diagnostics: [{ code: "invalid-document", severity: "error", message: error instanceof Error ? error.message : String(error) }] }, null, 2));
    else if (command === "inspect") console.log(JSON.stringify({ schema: "konpeki-html-inspection/v1", ok: false, pages: [], diagnostics: [{ code: "inspection-failed", severity: "error", message: error instanceof Error ? error.message : String(error) }] }, null, 2));
    else console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
