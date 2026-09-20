import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { compositionSchema } from "../composition/types.ts";
import { validateComposition } from "../composition/validate.ts";
import { parseEditableSvg } from "../composition/vector.ts";

if (process.argv.includes("--help")) {
  console.log("Usage: pnpm example:migrate-page [trusted-react-file] [all|zero-based-page] [output.json]\nExecutes trusted local React source; imports its supported SVG primitives as editable composition vectors.");
  process.exit(0);
}

const root = process.cwd();
const input = resolve(root, process.argv[2] ?? "slides/architecture/index.tsx");
const pageSelection = process.argv[3] ?? "all";
const output = resolve(
  root,
  process.argv[4] ?? "src/lib/examples/react-page-migration.json",
);
const moduleId = `/${relative(root, input).replaceAll("\\", "/")}`;

if (
  pageSelection !== "all" &&
  (!Number.isInteger(Number(pageSelection)) || Number(pageSelection) < 0)
)
  throw new Error('Page selection must be "all" or a non-negative index.');

const server = await createServer({
  root,
  appType: "custom",
  server: { middlewareMode: true },
  plugins: [
    {
      name: "konpeki-react-page-migration",
      enforce: "pre",
      resolveId(source) {
        if (source.endsWith("/lib/typeface.ts")) return "\0konpeki-typeface";
      },
      load(id) {
        if (id === "\0konpeki-typeface")
          return "export const fontsReady = Promise.resolve([]);";
      },
    },
  ],
});

try {
  const loaded = await server.ssrLoadModule(moduleId) as {
    default?: ComponentType[];
    meta?: { title?: string };
  };
  const pages = loaded.default ?? [];
  const indexes = pageSelection === "all"
    ? pages.map((_, index) => index)
    : [Number(pageSelection)];
  if (!indexes.length || indexes.some((index) => !pages[index]))
    throw new Error(`No selected page exported by ${moduleId}.`);
  const title = loaded.meta?.title ?? "Migrated React page";
  const document = {
    schema: compositionSchema,
    title: `${title} — migrated React deck`,
    theme: { id: "plex", mode: "paper" },
    slides: indexes.map((pageIndex, outputIndex) => {
      const source = renderToStaticMarkup(createElement(pages[pageIndex]));
      const parsed = parseEditableSvg(source);
      const id = `migrated-page-${outputIndex + 1}`;
      const slotId = `${id}-content`;
      return {
        id: `slide-${outputIndex + 1}`,
        name: `Migrated page ${pageIndex + 1}`,
        canvas: { width: 1920, height: 1080 },
        innerPadding: { top: 72, right: 112, bottom: 0, left: 112 },
        pageNumber: { style: "none", color: "muted" },
        audience: "Reviewers of the migrated slide",
        question: "Does the former React page survive in the shared canvas?",
        intendedViewingSize: "presentation",
        contentSlots: [
          {
            id: slotId,
            label: "Migrated page",
            required: true,
            instruction: "Preserve the trusted React page as editable vector elements.",
            role: "entity",
          },
        ],
        components: [
          {
            id,
            kind: "diagram",
            preferredRect: { x: 0, y: 0, width: 1920, height: 1080 },
            slotIds: [slotId],
            intent: "A former React page converted to editable vector elements.",
            appearance: { type: "architecture", border: "none" },
            customVisual: {
              format: "vector",
              elements: parsed.elements,
              viewBox: parsed.viewBox,
              description: `Migrated page ${pageIndex + 1} from ${title}`,
              fit: "stretch",
            },
          },
        ],
        groups: [],
        readingOrder: [{ kind: "component", id }],
        paintOrder: [id],
        relationships: [],
      };
    }),
  };
  const validation = validateComposition(document);
  if (!validation.ok)
    throw new Error(`Generated composition is invalid: ${JSON.stringify(validation.issues)}`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(validation.document, null, 2)}\n`);
  console.log(`${relative(root, input)} (${indexes.length} pages) → ${relative(root, output)}`);
} finally {
  await server.close();
}
