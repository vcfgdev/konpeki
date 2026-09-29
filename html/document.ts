import { parse, parseFragment, serialize, type DefaultTreeAdapterMap } from "parse5";

export const documentPolicy = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline' 'self' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data:; base-uri 'none'; form-action 'none'";

/** The only external resources permitted by CLI inspection/export. */
export function isGoogleFontResource(url: string, resourceType: string) {
  const resource = new URL(url);
  if (resource.protocol !== "https:" || resource.port || resource.username || resource.password) return false;
  return resourceType === "stylesheet" && resource.hostname === "fonts.googleapis.com" && ["/css", "/css2"].includes(resource.pathname)
    || resourceType === "font" && resource.hostname === "fonts.gstatic.com" && resource.pathname.startsWith("/s/");
}

/** A view of the source, never a serialization written back to it. Keep every
 * page in the DOM so nth-child selectors and shared SVG definitions stay stable. */
export function documentHTML(source: string, pageId: string) {
  const tree = parse(source);
  const html = tree.childNodes.find(n => n.nodeName === "html") as DefaultTreeAdapterMap["element"];
  const head = html.childNodes.find(n => n.nodeName === "head") as DefaultTreeAdapterMap["element"];
  const body = html.childNodes.find(n => n.nodeName === "body") as DefaultTreeAdapterMap["element"];
  for (const child of body.childNodes) {
    if (!("attrs" in child)) continue;
    child.attrs = child.attrs.filter(a => a.name !== "data-konpeki-current");
    if (child.attrs.some(a => a.name === "data-page") && child.attrs.some(a => a.name === "id" && a.value === pageId))
      child.attrs.push({ name: "data-konpeki-current", value: "" });
  }
  // Serve at a directory URL: relative assets and SVG #fragments then retain
  // their native meaning without a <base> that redirects fragment references.
  head.childNodes.unshift(...parseFragment(`<meta http-equiv="Content-Security-Policy" content="${documentPolicy}">`).childNodes);
  head.childNodes.push(...parseFragment(`<style>
    html, body { margin: 0 !important; padding: 0 !important; }
    body { display: flex !important; flex-direction: column !important; align-items: flex-start !important; }
    body > [data-page] { margin: 0 !important; flex: none !important; }
    body > [data-page]:not([data-konpeki-current]) { display: none !important; }
    *, *::before, *::after { animation: none !important; transition: none !important; }
    @media print { body > [data-page] { break-before: auto !important; break-after: auto !important; } }
  </style>`).childNodes);
  return serialize(tree);
}
