#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { fileSessionPlugin } from "./session-plugin.ts";
import {
  readCompositionFile,
} from "./session-store.ts";
import { claimBuildRequest, finishBuildRequest, readReview } from "./review-store.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  console.error(`Usage:
  konpeki preview <composition.json> [--host <host>] [--port <port>] [--json]
  konpeki validate <composition.json>
  konpeki wait <composition.json>
  konpeki request <composition.json>
  konpeki finish <composition.json> <request-id> [--status done|needs-clarification|failed] [--message <text>]`);
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
    server: { host, port, strictPort: process.argv.includes("--port") },
    plugins: [fileSessionPlugin({
      compositionPath,
      token,
      onBuildRequest: ({ request }) => {
        if (!request) return;
        console.error(`\nBuild requested for ${request.compositionPath}`);
        console.error(`Revision: ${request.revision}`);
        console.error(`Instruction: ${request.instruction}`);
        console.error(`Run: konpeki wait ${JSON.stringify(request.compositionPath)}\n`);
      },
    })],
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
    console.log(`Waiting for edits and Build it requests. Press Ctrl+C to stop.`);
  }
}

async function validate(input) {
  const result = await readCompositionFile(resolve(input));
  console.log(`${result.name}: valid (${result.revision})`);
}

async function waitForRequest(input) {
  console.error(`Waiting for a Build it request for ${resolve(input)}…`);
  for (;;) {
    const request = await claimBuildRequest(resolve(input));
    if (request) {
      console.log(JSON.stringify(request, null, 2));
      return;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
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
    else if (command === "wait") await waitForRequest(input);
    else if (command === "request") console.log(JSON.stringify((await readReview(input)).request ?? null, null, 2));
    else if (command === "finish") {
      if (!process.argv[4]) throw new Error("Provide the request ID returned by konpeki wait.");
      const result = await finishBuildRequest(input, process.argv[4], option("--status", "done"), option("--message"));
      console.log(JSON.stringify(result.request, null, 2));
    }
    else {
      usage();
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
