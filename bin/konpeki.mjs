#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { fileSessionPlugin } from "./session-plugin.ts";
import { renderDocument, renderFonts } from "./render.ts";
import { refineGrid } from "../composition/grid.ts";
import {
  readCompositionFile,
} from "./session-store.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  console.error(`Usage:
  konpeki preview <composition.json> [--host <host>] [--port <port>] [--json]
  konpeki validate <composition.json>
  konpeki check <composition.json>
  konpeki inspect <composition.json> [--page N] [--details]
  konpeki render <composition.json> [--page N] [--format png|svg|pdf] [--scale 2] [--output file]
  konpeki refine-grid <composition.json> [--output file.json]

Pages are one-based. Inspect and PDF include all pages unless --page is supplied.
Scale affects PNG only. Outputs must not already exist.`);
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

async function refine(input) {
  const { document } = await readCompositionFile(resolve(input));
  const refined = { ...document, slides: document.slides.map(refineGrid) };
  const output = resolve(option("--output", input.replace(/\.json$/i, "") + ".refined.json"));
  await writeFile(output, JSON.stringify(refined, null, 2) + "\n", { flag: "wx" });
  console.log(output);
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
  const diagnostics = document.slides.flatMap(page => checkPageNode(lowerPage(document, page, fonts), fonts));
  const ok = !diagnostics.some(item => item.severity === "error");
  console.log(JSON.stringify({ ok, diagnostics }, null, 2));
  if (!ok) process.exitCode = 1;
}

async function inspect(input) {
  const { document, revision } = await readCompositionFile(resolve(input));
  const selected = process.argv.includes("--page") ? Number(option("--page")) : undefined;
  const details = process.argv.includes("--details");
  if (selected !== undefined && (!Number.isInteger(selected) || selected < 1 || selected > document.slides.length))
    throw new Error(`Page must be an integer from 1 to ${document.slides.length}.`);
  const [{ lowerPage }, { inspectPage, summarizePage }, { checkPageNode }, fonts] = await Promise.all([
    import("../composition/lower.ts"), import("../composition/inspect.ts"), import("../composition/check-node.ts"), renderFonts(),
  ]);
  const diagnostics = [];
  const pages = document.slides.flatMap((page, index) => {
    if (selected !== undefined && selected !== index + 1) return [];
    const scene = lowerPage(document, page, fonts);
    diagnostics.push(...checkPageNode(scene, fonts));
    return [{ pageNumber: index + 1, ...(details ? inspectPage(page, scene, fonts) : summarizePage(page, scene)) }];
  });
  const ok = !diagnostics.some(item => item.severity === "error");
  console.log(JSON.stringify({ schema: "konpeki-inspection/v1", detail: details ? "full" : "summary", revision, units: "page-pixels", ok, pages, diagnostics }, null, 2));
  if (!ok) process.exitCode = 1;
}

const command = process.argv[2];
const input = process.argv[3];
if (!command || !input) {
  usage();
  process.exitCode = 1;
} else {
  try {
    if (command === "preview") await preview(input);
    else if (command === "validate") await validate(input);
    else if (command === "render") await render(input);
    else if (command === "check") await check(input);
    else if (command === "inspect") await inspect(input);
    else if (command === "refine-grid") await refine(input);
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
