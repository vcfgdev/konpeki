import {
  readCompositionFile,
  saveCompositionFile,
} from "./session-store.ts";
import { addRevisionNote, removeRevisionNote, readReview, writeBuildRequest, finishBuildRequest } from "./review-store.ts";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const maximumBodyBytes = 16 * 1024 * 1024;
const route = "/__konpeki/session";

function sendJSON(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(value));
}

async function readJSON(request: IncomingMessage) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBodyBytes)
      throw Object.assign(new Error("Request body is too large."), { code: "BODY_TOO_LARGE" });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function errorResponse(error: unknown) {
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  return {
    status: code === "REVISION_CONFLICT" ? 409
      : code === "INVALID_COMPOSITION" || code === "INVALID_REVIEW" ? 422
      : code === "BODY_TOO_LARGE" ? 413
      : error instanceof SyntaxError ? 400 : 500,
    body: {
      error: error instanceof Error ? error.message : "File-session request failed.",
      ...(error && typeof error === "object" && "revision" in error
        ? { revision: error.revision }
        : {}),
    },
  };
}

export function fileSessionPlugin({
  compositionPath,
  token,
  onBuildRequest,
}: {
  compositionPath: string;
  token: string;
  onBuildRequest?: (result: Awaited<ReturnType<typeof writeBuildRequest>>) => void;
}): Plugin {
  return {
    name: "konpeki-file-session",
    enforce: "pre",
    config(config) {
      return { server: { fs: { deny: [
        // Preserve Vite's default sensitive-file exclusions as well as caller rules.
        ".env", ".env.*", "*.{crt,pem,key,p12,pfx,cer,der}", ".npmrc", ".yarnrc.yml", "**/.git/**",
        ...config.server?.fs?.deny ?? [],
        "**/*.review.json", "**/*.review.json.*",
      ] } } };
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url || "/", "http://localhost");
        if (!url.pathname.startsWith(route)) return next();
        if (request.headers["x-konpeki-session"] !== token) {
          sendJSON(response, 403, { error: "Invalid session token." });
          return;
        }
        try {
          if (url.pathname === route && request.method === "GET") {
            // Read acknowledgement first so a completed response includes at least
            // the document version that was present when the agent finished.
            const review = await readReview(compositionPath);
            sendJSON(response, 200, { ...await readCompositionFile(compositionPath), review });
            return;
          }
          if (url.pathname === route && request.method === "PUT") {
            const body = await readJSON(request);
            sendJSON(response, 200, await saveCompositionFile(
              compositionPath,
              body.revision,
              body.document,
            ));
            return;
          }
          if (url.pathname === `${route}/build` && request.method === "POST") {
            const body = await readJSON(request);
            if (typeof body.instruction !== "string" || !body.instruction.trim()) {
              sendJSON(response, 400, { error: "Describe what the agent should build." });
              return;
            }
            const result = await writeBuildRequest(compositionPath, body);
            onBuildRequest?.(result);
            sendJSON(response, 201, result);
            return;
          }
          if (url.pathname === `${route}/notes` && request.method === "POST") {
            const body = await readJSON(request);
            sendJSON(response, 201, await addRevisionNote(compositionPath, body, body.text));
            return;
          }
          if (url.pathname === `${route}/notes` && request.method === "DELETE") {
            const body = await readJSON(request);
            sendJSON(response, 200, await removeRevisionNote(compositionPath, body.id));
            return;
          }
          if (url.pathname === `${route}/cancel` && request.method === "POST") {
            const body = await readJSON(request);
            sendJSON(response, 200, await finishBuildRequest(compositionPath, body.id, "failed", "Cancelled by user. Stop the agent before starting another request."));
            return;
          }
          sendJSON(response, 404, { error: "Unknown file-session endpoint." });
        } catch (error) {
          const responseError = errorResponse(error);
          sendJSON(response, responseError.status, responseError.body);
        }
      });
    },
  };
}
