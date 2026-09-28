import {
  readCompositionFile,
  revisionFor,
  saveCompositionFile,
} from "./session-store.ts";
import { readReview } from "./review-store.ts";
import { emptyReview } from "../src/lib/review.ts";
import { renderDocument } from "./render.ts";
import { resolve } from "node:path";
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
}: {
  compositionPath: string;
  token: string;
}): Plugin {
  const commentKey = revisionFor(resolve(compositionPath));
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
            const legacy = await readReview(compositionPath).then(review => ({ review }), () => ({
              review: emptyReview(),
              reviewError: "Legacy comments could not be imported. The sidecar was not changed; repair it and retry.",
            }));
            sendJSON(response, 200, { ...await readCompositionFile(compositionPath), commentKey, ...legacy });
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
          if (url.pathname === `${route}/export` && request.method === "POST") {
            const body = await readJSON(request);
            const current = await readCompositionFile(compositionPath);
            if (body.revision !== current.revision) {
              sendJSON(response, 409, { error: "The composition changed; save or reload before exporting.", revision: current.revision });
              return;
            }
            if (!["png", "svg", "pdf"].includes(body.format) || !Number.isInteger(body.page) || body.page < 1 || body.page > current.document.slides.length ||
                !Number.isFinite(body.scale) || body.scale <= 0 || body.scale > 8) {
              sendJSON(response, 400, { error: "Invalid export format, page or scale." });
              return;
            }
            const result = await renderDocument(current.document, { format: body.format, page: body.format === "pdf" ? undefined : body.page, scale: body.scale });
            response.writeHead(200, { "content-type": result.contentType, "cache-control": "no-store" });
            response.end(result.bytes);
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
