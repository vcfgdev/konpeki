// Preserve the editor's diagram illustration vocabulary as plain scene primitives.
import { build } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { diagramTypes } from "../composition/visualizations.ts";
import { parseEditableSvg } from "../composition/vector.ts";

const directory = await mkdtemp(join(tmpdir(), "konpeki-draft-icons-"));
try {
  const result = await build({ configFile: false, logLevel: "error", build: { ssr: "src/components/DiagramTypeIcon.tsx", write: false } });
  // Resolve React from this checkout, not the temporary directory.
  const source = result.output.find(item => item.type === "chunk").code.replace(/from "(react(?:\/jsx-runtime)?)"/g, (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`);
  const path = join(directory, "icons.mjs"); await writeFile(path, source);
  const { DiagramTypeIcon } = await import(pathToFileURL(path).href);
  const data = Object.fromEntries(diagramTypes.map(type => [type, parseEditableSvg(renderToStaticMarkup(createElement(DiagramTypeIcon, { type }))).elements]));
  await writeFile(new URL("../composition/draft-icons.json", import.meta.url), JSON.stringify(data, null, 2) + "\n");
} finally { await rm(directory, { recursive: true, force: true }); }
