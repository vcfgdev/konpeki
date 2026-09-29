export type Bounds = { x: number; y: number; width: number; height: number };
export type Diagnostic = { code: string; severity: "error" | "warning"; page: string; target: string; message: string };

/** Self-contained so the same measurement runs in the review iframe and CLI's
 * Chromium page. Range bounds are line boxes, not glyph ink or collision proof. */
export function inspectHTMLPage(page: HTMLElement) {
  const doc = page.ownerDocument, win = doc.defaultView!;
  const origin = page.getBoundingClientRect();
  const diagnostics: Diagnostic[] = [], seen = new Set<string>();
  const bounds = (r: DOMRect): Bounds => ({ x: r.x - origin.x, y: r.y - origin.y, width: r.width, height: r.height });
  const outside = (r: DOMRect, box: DOMRect, x = true, y = true) =>
    x && (r.left < box.left - .75 || r.right > box.right + .75) || y && (r.top < box.top - .75 || r.bottom > box.bottom + .75);
  function report(code: string, element: Element, message: string, severity: "error" | "warning" = "error") {
    const target = element.closest("[id]")?.id ?? page.id, key = `${code}/${target}`;
    if (!seen.has(key)) { seen.add(key); diagnostics.push({ code, severity, page: page.id, target, message }); }
  }
  function visible(element: Element) {
    if (element.closest("defs,clipPath,mask,symbol,marker,pattern,linearGradient,radialGradient")) return false;
    const style = win.getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" && element.getClientRects().length > 0;
  }
  if (origin.width <= 0 || origin.height <= 0 || origin.width > 8192 || origin.height > 8192)
    report("page-size", page, "Use explicit positive page dimensions no larger than 8192 CSS px per side.");
  const elements = Array.from(page.querySelectorAll("*"));
  const blocks = elements.filter(el => el.id && visible(el)).map(el => ({ id: el.id, tag: el.tagName.toLowerCase(), bounds: bounds(el.getBoundingClientRect()) }));
  for (const element of elements) {
    if (!visible(element)) continue;
    if (outside(element.getBoundingClientRect(), origin)) report("page-overflow", element, "This element extends beyond the page. Recompose it; content does not continue onto another page automatically.");
    if (element.tagName === "IMG" && !(element as HTMLImageElement).naturalWidth)
      report("missing-image", element, "An image did not load. Use a local asset beside the HTML or an embedded data URL.");
  }
  const text: { target: string; bounds: Bounds[] }[] = [];
  const walker = doc.createTreeWalker(page, 4); // NodeFilter.SHOW_TEXT across iframe realms
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!node.textContent?.trim() || !parent || !visible(parent) || parent.closest("style,defs,title,desc")) continue;
    const range = doc.createRange(); range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter(r => r.width > 0 && r.height > 0);
    text.push({ target: parent.closest("[id]")?.id ?? page.id, bounds: rects.map(bounds) });
    for (const rect of rects) {
      if (outside(rect, origin)) report("text-overflow", parent, "Text extends beyond the page. Do not hide it or shrink required copy to fit.");
      for (let ancestor: Element | null = parent; ancestor; ancestor = ancestor.parentElement) {
        const style = win.getComputedStyle(ancestor), box = ancestor.getBoundingClientRect();
        if (outside(rect, box, style.overflowX !== "visible", style.overflowY !== "visible"))
          report("clipped-text", parent, "Text crosses a clipping or scrolling boundary. Increase space or revise the layout.");
        if (ancestor === page) break;
      }
    }
  }
  for (const link of doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
    if (!link.sheet && !link.disabled) report("missing-stylesheet", page, "A stylesheet did not load. Keep stylesheets beside the HTML or inline them.");
  for (const font of doc.fonts) if (font.status === "error") report("missing-font", page, `Font failed to load: ${font.family}.`);
  return { id: page.id, width: origin.width, height: origin.height, blocks, text, diagnostics };
}
