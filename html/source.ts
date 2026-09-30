import { createHash, randomBytes } from "node:crypto";
import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import postcss from "postcss";

type Element = DefaultTreeAdapterMap["element"];
export type Edit = { page: string; id: string } & ({ kind: "move"; translate: string } | { kind: "delete" });
export const revision = (source: string) => createHash("sha256").update(source).digest("hex");
const attr = (node: Element, name: string) => node.attrs.find(a => a.name === name)?.value;
function fail(message: string, status = 422): never { throw Object.assign(new Error(message), { status }); }

export function inspectSource(source: string) {
  const tree = parse(source, { sourceCodeLocationInfo: true, onParseError(error) {
    if (error.code === "duplicate-attribute") fail("Duplicate HTML attributes are ambiguous; remove them before editing.");
  } });
  const elements: Element[] = [];
  function visit(node: DefaultTreeAdapterMap["node"]) {
    if ("tagName" in node) elements.push(node);
    if ("childNodes" in node) node.childNodes.forEach(visit);
  }
  visit(tree);
  const pages = elements.filter(node => attr(node, "data-page") !== undefined);
  if (!pages.length) fail("Add an id and data-page to each page element.");
  const ids = new Set<string>();
  for (const node of elements) {
    if (["script", "iframe", "object", "embed", "base", "template", "form", "input", "button", "textarea", "select", "animate", "animatetransform", "set"].includes(node.tagName.toLowerCase()) ||
        node.tagName === "meta" && attr(node, "http-equiv") !== undefined ||
        node.attrs.some(a => /^on/i.test(a.name) || ["href", "src", "action"].includes(a.name) && /^\s*javascript:/i.test(a.value)))
      fail("Documents must be static HTML/CSS and inline SVG, without scripts, event handlers, embedded applications or controls.");
    const id = attr(node, "id");
    if (id !== undefined && (!id || ids.has(id))) fail("Element IDs must be nonempty and unique within the HTML file.");
    if (id) ids.add(id);
  }
  for (const page of pages) {
    if (!attr(page, "id") || page.parentNode?.nodeName !== "body")
      fail("Pages need an id and must be direct children of body.");
  }
  return { pages, elements };
}

export function patchSource(source: string, edit: Edit) {
  const { pages, elements } = inspectSource(source);
  const page = pages.find(node => attr(node, "id") === edit.page);
  const node = elements.find(node => attr(node, "id") === edit.id);
  if (!page || !node) fail("The selected page or element no longer exists.");
  let ancestor: DefaultTreeAdapterMap["node"] | undefined = node;
  while (ancestor && ancestor !== page) ancestor = "parentNode" in ancestor ? ancestor.parentNode ?? undefined : undefined;
  if (!ancestor || node === page) fail("Select an element inside the page.");
  const location = node.sourceCodeLocation;
  if (!location?.startTag) fail("This element does not have an unambiguous source location.");
  if (edit.kind === "delete") return source.slice(0, location.startOffset) + source.slice(location.endOffset);
  if (edit.kind !== "move" || typeof edit.translate !== "string" || !/^-?\d+(?:\.\d+)?px -?\d+(?:\.\d+)?px$/.test(edit.translate) || edit.translate.length > 100)
    fail("Invalid correction.");
  // Parse the authored CSS, not CSSOM's normalized serialization. PostCSS keeps
  // unrelated declaration values, comments and whitespace, including hex colors.
  let css;
  try { css = postcss.parse(attr(node, "style") ?? ""); }
  catch { fail("The inline style could not be parsed. Correct it in source before moving."); }
  const declarations = css.nodes.filter(n => n.type === "decl" && n.prop.toLowerCase() === "translate");
  for (const declaration of declarations) if (declaration.type === "decl") declaration.value = edit.translate;
  if (!declarations.length) css.append({ prop: "translate", value: edit.translate });
  css.raws.semicolon = true;
  const escaped = css.toString().replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
  const style = location.attrs?.style;
  const start = style?.startOffset ?? location.startTag.endOffset - (source[location.startTag.endOffset - 2] === "/" ? 2 : 1);
  const end = style?.endOffset ?? start;
  return source.slice(0, start) + `${style ? "" : " "}style="${escaped}"` + source.slice(end);
}

export function fileSource(path: string) {
  path = resolve(path);
  let queue: Promise<unknown> = Promise.resolve();
  const history: { before: string; after: string }[] = [];
  async function read() {
    const source = await readFile(path, "utf8");
    const { pages } = inspectSource(source);
    return { source, revision: revision(source), name: basename(path), path, key: revision(path), pages: pages.map(p => attr(p, "id")!) };
  }
  function edit(expected: string, change: Edit | { kind: "undo" }) {
    const result = queue.then(async () => {
      const current = await read();
      if (current.revision !== expected) fail("Source changed outside this preview. Reloaded the latest file; retry your correction.", 409);
      const previous = history.at(-1);
      if (change.kind === "undo" && (!previous || previous.after !== current.revision))
        fail("Nothing safe to undo: the source may have changed externally.", 409);
      const next = change.kind === "undo" ? previous!.before : patchSource(current.source, change);
      inspectSource(next);
      const temporary = join(dirname(path), `.${basename(path)}.${randomBytes(8).toString("hex")}.tmp`);
      try {
        await writeFile(temporary, next, { flag: "wx" });
        if (revision(await readFile(path, "utf8")) !== current.revision) fail("Source changed while saving. Retry your correction.", 409);
        await rename(temporary, path);
      } finally { await rm(temporary, { force: true }); }
      if (change.kind === "undo") history.pop();
      else { history.push({ before: current.source, after: revision(next) }); if (history.length > 30) history.shift(); }
      return read();
    });
    queue = result.catch(() => {});
    return result;
  }
  return { read, edit };
}
