export type Bounds = { x: number; y: number; width: number; height: number };
export type Diagnostic = { code: string; severity: "error" | "warning"; page: string; target: string; message: string };

/** Self-contained so the same measurement runs in the review iframe and CLI's
 * Chromium page. Range bounds are line boxes, not glyph ink. */
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
    for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement)
      if (Number(win.getComputedStyle(ancestor).opacity) === 0) return false;
    return style.visibility === "visible" && style.display !== "none" && element.getClientRects().length > 0;
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
  const lines: { parent: Element; rect: DOMRect }[] = [];
  const textElements = new Set<Element>();
  const walker = doc.createTreeWalker(page, 4); // NodeFilter.SHOW_TEXT across iframe realms
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!node.textContent?.trim() || !parent || !visible(parent) || parent.closest("style,defs,title,desc")) continue;
    const range = doc.createRange(); range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter(r => r.width > 0 && r.height > 0);
    text.push({ target: parent.closest("[id]")?.id ?? page.id, bounds: rects.map(bounds) });
    if (rects.length) textElements.add(parent);
    for (const rect of rects) {
      for (const previous of lines) {
        if (previous.parent === parent) continue;
        const other = previous.rect;
        if (Math.min(rect.right, other.right) - Math.max(rect.left, other.left) > 1 &&
            Math.min(rect.bottom, other.bottom) - Math.max(rect.top, other.top) > 1)
          report("text-overlap", parent, `Text overlaps text in #${previous.parent.closest("[id]")?.id ?? page.id}. Separate their line boxes.`);
      }
      lines.push({ parent, rect });
      if (outside(rect, origin)) report("text-overflow", parent, "Text extends beyond the page. Do not hide it or shrink required copy to fit.");
      for (let ancestor: Element | null = parent; ancestor; ancestor = ancestor.parentElement) {
        const style = win.getComputedStyle(ancestor), box = ancestor.getBoundingClientRect();
        if (outside(rect, box, style.overflowX !== "visible", style.overflowY !== "visible"))
          report("clipped-text", parent, "Text crosses a clipping or scrolling boundary. Increase space or revise the layout.");
        if (ancestor === page) break;
      }
    }
  }
  // Contrast is deliberately limited to opaque sRGB text on solid ancestor
  // backgrounds. Images, gradients, compositing and SVG paint need visual review.
  const rgb = (value: string) => /^rgba?\(/.test(value) ? value.match(/[\d.]+/g)!.map(Number) : undefined;
  const opaque = (color: number[] | undefined) => color && (color.length === 3 || color[3] === 1);
  const luminance = (color: number[]) => color.slice(0, 3).reduce((sum, channel, i) => {
    const c = channel / 255;
    return sum + (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][i];
  }, 0);
  for (const element of textElements) {
    if (element.namespaceURI !== "http://www.w3.org/1999/xhtml") continue;
    const style = win.getComputedStyle(element), foreground = rgb(style.color);
    if (!opaque(foreground)) continue;
    let background: number[] | undefined, uncertain = false;
    for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
      const s = win.getComputedStyle(ancestor), color = rgb(s.backgroundColor);
      if (Number(s.opacity) !== 1 || s.filter !== "none" || s.backdropFilter !== "none" || s.mixBlendMode !== "normal") uncertain = true;
      if (!background) {
        if (!color || s.backgroundImage !== "none" || color.length === 4 && color[3] > 0 && color[3] < 1) uncertain = true;
        if (opaque(color)) background = color;
      }
    }
    // With no authored background, a light-scheme browser canvas is white.
    if (!background && !win.getComputedStyle(doc.documentElement).colorScheme.includes("dark")) background = [255, 255, 255];
    if (uncertain || !background) continue;
    const a = luminance(foreground!), b = luminance(background);
    const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    const size = parseFloat(style.fontSize), large = size >= 24 || size >= 18.6667 && Number(style.fontWeight) >= 700;
    const minimum = large ? 3 : 4.5;
    if (ratio < minimum) report("low-contrast", element, `Text contrast is ${ratio.toFixed(2)}:1; use at least ${minimum}:1 on this solid background.`);
  }
  // Compare used values, including inherited styles, to the page's tokens. CSSOM
  // cannot distinguish a literal equal to a token from a var() reference.
  const probe = doc.createElement("span");
  probe.style.display = "none"; doc.body.append(probe);
  const colorTokens = ["bg", "fg", "muted", "line", "inverse", "accent", "wash", "surface", "emphasis", "emphasis-wash", "complete", "attention", "blocked", ...Array.from({ length: 6 }, (_, i) => `category-${i + 1}`), ...Array.from({ length: 5 }, (_, i) => `sequence-${i + 1}`)];
  for (const element of [page, ...elements]) {
    if (!visible(element) || element.closest('[data-theme="custom"]')) continue;
    const style = win.getComputedStyle(element);
    if (!style.getPropertyValue("--font-family")) continue;
    const deviations: string[] = [];
    if (textElements.has(element) && !["fine", "caption", "body", "lead", "heading", "title", "display"].some(step => Math.abs(parseFloat(style.getPropertyValue(`--font-${step}`)) - parseFloat(style.fontSize)) < .1))
      deviations.push(`font-size ${style.fontSize}`);
    probe.style.colorScheme = style.colorScheme;
    const colors = colorTokens.map(token => {
      probe.style.color = ""; probe.style.color = style.getPropertyValue(`--${token}`);
      return win.getComputedStyle(probe).color;
    });
    const values = [style.backgroundColor];
    if (textElements.has(element)) values.push(element.namespaceURI === "http://www.w3.org/2000/svg" ? style.fill : style.color);
    for (const side of ["Top", "Right", "Bottom", "Left"] as const)
      if (parseFloat(style[`border${side}Width`]) > 0) values.push(style[`border${side}Color`]);
    if (element.matches("path,rect,circle,ellipse,polygon,polyline,line")) values.push(style.fill, style.stroke);
    for (const value of new Set(values))
      if (value !== "none" && value !== "rgba(0, 0, 0, 0)" && !colors.includes(value)) deviations.push(`color ${value}`);
    if (deviations.length) report("theme-value", element, `Outside the theme scale/palette: ${deviations.join(", ")}. Use theme variables, or data-theme="custom" for a brief-specific look.`, "warning");
  }
  probe.remove();
  for (const link of doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
    if (!link.sheet && !link.disabled) report("missing-stylesheet", page, "A stylesheet did not load. Keep stylesheets beside the HTML or inline them.");
  for (const font of doc.fonts) if (font.status === "error") report("missing-font", page, `Font failed to load: ${font.family}.`);
  return { id: page.id, width: origin.width, height: origin.height, blocks, text, diagnostics };
}
