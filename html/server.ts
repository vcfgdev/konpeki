import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer as createHTTPServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { fileSource } from "./source.ts";
import { documentHTML, documentPolicy } from "./document.ts";

const types: Record<string, string> = { ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf" };
export const sessionRoute = "/__konpeki/html";

/** Same authenticated document/asset surface for preview and browser exports. */
export function htmlSession(path: string, token = randomBytes(24).toString("base64url")) {
  const store = fileSource(resolve(path));
  const prefix = `${sessionRoute}/${token}`;
  function send(res: ServerResponse, status: number, value: unknown) {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    res.end(JSON.stringify(value));
  }
  async function handler(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith(sessionRoute)) return next();
    try {
      if (url.pathname === sessionRoute) {
        if (req.headers["x-konpeki-session"] !== token) return send(res, 403, { error: "Invalid preview session." });
        if (req.method === "GET") return send(res, 200, await store.read());
        if (req.method !== "PATCH") return send(res, 405, { error: "Method not allowed." });
        let size = 0; const chunks: Buffer[] = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 16384) throw Object.assign(new Error("Correction is too large."), { status: 413 });
          chunks.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString());
        if (!body || typeof body.revision !== "string" || !body.edit || !["move", "delete", "undo"].includes(body.edit.kind))
          return send(res, 400, { error: "Invalid correction." });
        return send(res, 200, await store.edit(body.revision, body.edit));
      }
      if (!url.pathname.startsWith(`${prefix}/`)) return send(res, 403, { error: "Invalid preview session." });
      if (req.method !== "GET") return send(res, 405, { error: "Method not allowed." });
      if (url.pathname === `${prefix}/document/`) {
        const snapshot = await store.read();
        if (url.searchParams.has("revision") && url.searchParams.get("revision") !== snapshot.revision)
          return send(res, 409, { error: "The source changed. Retry with its latest revision." });
        const page = url.searchParams.get("page") ?? snapshot.pages[0];
        if (!snapshot.pages.includes(page)) return send(res, 404, { error: "Unknown page." });
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": documentPolicy, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });
        return res.end(documentHTML(snapshot.source, page));
      }
      const assets = `${prefix}/document/`;
      if (!url.pathname.startsWith(assets)) return send(res, 404, { error: "Unknown resource." });
      const name = decodeURIComponent(url.pathname.slice(assets.length));
      const type = types[extname(name).toLowerCase()];
      if (!type || name.split(/[\\/]/).some(part => part.startsWith("."))) return send(res, 403, { error: "Only local image, font and CSS assets are served." });
      let base = await realpath(dirname(resolve(path))), file: string;
      try { file = await realpath(resolve(base, name)); }
      catch (error) {
        // A linked default theme is available in previews and fixtures. Copies
        // made by prepare-document carry these assets beside the HTML instead.
        if ((error as NodeJS.ErrnoException).code !== "ENOENT" || !/^(theme(?:-base)?\.css|fonts\/ibm-plex-(sans-latin-(400|600|700)|mono-latin-400)-normal\.woff2)$/.test(name)) throw error;
        base = fileURLToPath(new URL("../", import.meta.url));
        file = await realpath(resolve(base, name));
      }
      const within = relative(base, file);
      if (isAbsolute(within) || within.startsWith("..")) return send(res, 403, { error: "Asset is outside the document directory." });
      const bytes = await readFile(file);
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store", "Content-Security-Policy": documentPolicy, "X-Content-Type-Options": "nosniff" });
      res.end(bytes);
    } catch (error) {
      const status = error instanceof SyntaxError || error instanceof URIError ? 400 : (error as { code?: string }).code === "ENOENT" ? 404 : Number((error as { status?: number }).status ?? 500);
      send(res, status, { error: error instanceof Error ? error.message : "Preview failed." });
    }
  }
  return { token, prefix, store, handler };
}

export async function documentServer(path: string) {
  const session = htmlSession(path);
  await session.store.read();
  const server = createHTTPServer((req, res) => void session.handler(req, res, () => { res.writeHead(404); res.end(); }));
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve()); });
  const address = server.address() as { port: number };
  return { ...session, origin: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())) };
}

export async function previewHTML(path: string, host: string, port: number, root: string, strictPort = false) {
  const session = htmlSession(path);
  await session.store.read();
  const server = await createServer({ root, configFile: false, logLevel: "silent", server: {
    host, port, strictPort,
    fs: { allow: [root, dirname(fileURLToPath(import.meta.resolve("@fontsource/ibm-plex-sans/package.json")))], deny: [".env", ".env.*", "*.{crt,pem,key,p12,pfx}", ".npmrc", "**/.git/**"] },
  }, plugins: [{ name: "konpeki-html", configureServer(server) { server.middlewares.use((req, res, next) => void session.handler(req, res, next)); } }] });
  try { await server.listen(); } catch (e) { await server.close(); throw e; }
  const address = server.httpServer!.address() as { port: number };
  const displayHost = host === "0.0.0.0" || host === "::" ? "localhost" : host;
  return { server, url: `http://${displayHost.includes(":") ? `[${displayHost}]` : displayHost}:${address.port}/html/?session=${session.token}` };
}
