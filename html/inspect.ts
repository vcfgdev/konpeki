export type Bounds = { x: number; y: number; width: number; height: number };
export type Diagnostic = { code: string; severity: "error" | "warning"; page: string; target: string; message: string };

/** Self-contained so the same measurement runs in the review iframe and CLI's
 * Chromium page. Range bounds describe font metrics, not glyph ink or leading. */
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
  const text: { target: string; content: string; bounds: Bounds[] }[] = [];
  const lines: { parent: Element; rect: DOMRect }[] = [];
  const textElements = new Set<Element>();
  const minimumSizes: Record<string, number> = { presentation: 24, portrait: 24, square: 24, link: 24, article: 24, a4: 11, explainer: 24, gallery: 24 };
  const preset = page.getAttribute("data-size") ?? "presentation", minimumSize = minimumSizes[preset];
  const walker = doc.createTreeWalker(page, 4); // NodeFilter.SHOW_TEXT across iframe realms
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!node.textContent?.trim() || !parent || !visible(parent) || parent.closest("style,defs,title,desc")) continue;
    const range = doc.createRange(); range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter(r => r.width > 0 && r.height > 0);
    if (rects.length) text.push({ target: parent.closest("[id]")?.id ?? page.id, content: node.textContent, bounds: rects.map(bounds) });
    if (rects.length) textElements.add(parent);
    const style = win.getComputedStyle(parent);
    if (rects.length && parseFloat(style.fontSize) < minimumSize)
      report("small-text", parent, `Text is ${style.fontSize}; use at least ${minimumSize}px for ${preset}. Reduce content or recompose for the viewing size, rather than shrinking it.`, "warning");
    let leading = parseFloat(style.lineHeight);
    // Center an estimated HTML line box on the font-metric rectangle. SVG uses
    // coordinate placement. Keep raw bounds for normal leading or non-horizontal
    // text, and for transforms where an axis-aligned estimate is misleading.
    for (let ancestor: Element | null = parent; ancestor; ancestor = ancestor.parentElement) {
      const s = win.getComputedStyle(ancestor);
      if (s.transform !== "none" || s.scale !== "none" || s.rotate !== "none" || Number(s.zoom) !== 1) leading = NaN;
    }
    for (const rect of rects) {
      const line = parent.namespaceURI === "http://www.w3.org/1999/xhtml" && style.writingMode === "horizontal-tb" && leading > 0
        ? new DOMRect(rect.x, rect.y + (rect.height - leading) / 2, rect.width, leading) : rect;
      for (const previous of lines) {
        if (previous.parent === parent) continue;
        const other = previous.rect;
        if (Math.min(line.right, other.right) - Math.max(line.left, other.left) > 1 &&
            Math.min(line.bottom, other.bottom) - Math.max(line.top, other.top) > 1)
          report("text-overlap", parent, `Text overlaps text in #${previous.parent.closest("[id]")?.id ?? page.id}. Separate their line boxes.`);
      }
      lines.push({ parent, rect: line });
      if (outside(rect, origin)) report("text-overflow", parent, "Text extends beyond the page. Do not hide it or shrink required copy to fit.");
      for (let ancestor: Element | null = parent; ancestor; ancestor = ancestor.parentElement) {
        const style = win.getComputedStyle(ancestor), box = ancestor.getBoundingClientRect();
        if (outside(rect, box, style.overflowX !== "visible", style.overflowY !== "visible"))
          report("clipped-text", parent, "Text crosses a clipping or scrolling boundary. Increase space or revise the layout.");
        if (ancestor === page) break;
      }
    }
  }
  // Composition rules with IDs from skills/konpeki/floor.md. Headlines are the
  // title, display and section-heading roles, explicit or semantic.
  const xhtml = "http://www.w3.org/1999/xhtml";
  const roleOf = (el: Element) => el.getAttribute("data-type") ?? (el.tagName === "H1" ? "title" : "heading");
  const leading = (style: CSSStyleDeclaration) => parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
  // A figure set in a headline role ("2,000") is a metric, not a headline.
  const headlines = Array.from(page.querySelectorAll('h1:not([data-type]), h2:not([data-type]), [data-type="title"], [data-type="display"], [data-type="heading"]'))
    .filter(el => el.namespaceURI === xhtml && visible(el) && (el.textContent?.match(/\p{L}/gu)?.length ?? 0) > (el.textContent?.match(/\d/g)?.length ?? 0));
  function block(element: Element) {
    let current = element;
    while (current !== page && current.parentElement && win.getComputedStyle(current).display.startsWith("inline")) current = current.parentElement;
    return current;
  }
  const textBlocks = [...new Set(Array.from(textElements, block))].filter(el => el.namespaceURI === xhtml);
  // Horizontal extent of the text itself: a block box spans its whole column.
  function extent(element: Element) {
    const range = doc.createRange(); range.selectNodeContents(element);
    const rects = Array.from(range.getClientRects()).filter(r => r.width > 0 && r.height > 0);
    return rects.length ? { left: Math.min(...rects.map(r => r.left)), right: Math.max(...rects.map(r => r.right)) } : element.getBoundingClientRect();
  }
  // Running heads repeat on other print pages, apart from their numbers.
  const normalize = (text: string) => text.replace(/\s+/g, " ").replace(/\d+/g, "#").trim();
  const printPages = page.getAttribute("data-size") === "a4"
    ? Array.from(doc.querySelectorAll("body > [data-page]")).filter(p => p !== page && p.getAttribute("data-size") === "a4").map(p => normalize(p.textContent ?? ""))
    : [];
  function labels(heading: Element) {
    const box = heading.getBoundingClientRect(), style = win.getComputedStyle(heading), headingInk = extent(heading);
    // compareDocumentPosition bit 2: the block precedes the heading. The nearest
    // preceding block and its row peers (a kicker left, a date right) are candidates.
    const before = textBlocks.filter(b => !b.contains(heading) && !heading.contains(b) && heading.compareDocumentPosition(b) & 2);
    const nearest = before.at(-1)?.getBoundingClientRect();
    if (!nearest) return [];
    return before.filter(label => {
      const rect = label.getBoundingClientRect(), labelStyle = win.getComputedStyle(label), labelInk = extent(label);
      const text = (label.textContent ?? "").replace(/\s+/g, " ").trim(), gap = box.top - rect.bottom;
      if (rect.top >= nearest.bottom || rect.bottom <= nearest.top) return false;
      if (gap < -1 || labelInk.right <= headingInk.left || labelInk.left >= headingInk.right || text.length > 48 || /[.!?]$/.test(text) || rect.height > leading(labelStyle) * 1.5) return false;
      if (parseFloat(labelStyle.fontSize) >= parseFloat(style.fontSize) * .8 || label.closest('[data-kp-allow~="label-above-headline"]')) return false;
      // A section heading's label hugs it; a page headline's label may sit anywhere above.
      if (roleOf(heading) === "heading" && gap > leading(style)) return false;
      return !printPages.some(other => other.includes(normalize(text)));
    });
  }
  for (const heading of headlines)
    for (const label of labels(heading))
      report("label-above-headline", label, `"${(label.textContent ?? "").replace(/\s+/g, " ").trim()}" labels the headline below it. Delete it, or move the product, date or source into the headline, supporting line, caption or footer.`, "warning");
  for (const heading of headlines) {
    const words: { node: Node; top: number; text: string }[] = [];
    const walker = doc.createTreeWalker(heading, 4);
    for (let node: Node | null; (node = walker.nextNode());) {
      for (const match of (node.textContent ?? "").matchAll(/\S+/g)) {
        const range = doc.createRange();
        range.setStart(node, match.index); range.setEnd(node, match.index + match[0].length);
        const rect = range.getClientRects()[0];
        if (rect) words.push({ node, top: rect.top, text: match[0] });
      }
    }
    // Each <br> starts a deliberate segment; a segment that wraps must not end
    // on one word after a fuller line. compareDocumentPosition bit 4: follows.
    const size = parseFloat(win.getComputedStyle(heading).fontSize), breaks = Array.from(heading.querySelectorAll("br"));
    const segments = new Map<number, (typeof words)[]>();
    for (const word of words) {
      const segment = breaks.filter(br => br.compareDocumentPosition(word.node) & 4).length;
      const lines = segments.get(segment) ?? [], line = lines.at(-1);
      if (line && word.top <= line[0].top + size / 2) line.push(word); else lines.push([word]);
      segments.set(segment, lines);
    }
    // One word per line is a deliberate stack, not a stranded word.
    const stranded = [...segments.values()].find(lines => lines.length > 1 && lines.at(-1)!.length === 1 && lines.at(-2)!.length > 1);
    if (stranded) report("stranded-word", heading, `A headline line ends on one stranded word, "${stranded.at(-1)![0].text}". Reword it or change its measure rather than shrinking it.`, "warning");
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
  const roles = ["fine", "caption", "body", "lead", "heading", "title", "display"];
  const faces = Array.from(doc.fonts);
  const familyName = (family: string) => family.trim().replace(/^(["'])(.*)\1$/, "$2").toLowerCase();
  const primaryFamily = (family: string) => familyName(family.match(/^\s*("[^"]*"|'[^']*'|[^,]+)/)?.[0] ?? "");
  function hasFace(family: string, weight: number, style = "normal") {
    return faces.some(face => {
      if (familyName(face.family) !== primaryFamily(family)) return false;
      const weights = face.weight.replace("normal", "400").replace("bold", "700").split(/\s+/).map(Number);
      const angles = (value: string) => value.match(/-?[\d.]+(?=deg)/g)?.map(Number) ?? [14];
      const requested = angles(style)[0], available = angles(face.style);
      const sameStyle = face.style === style || style.startsWith("oblique") && face.style.startsWith("oblique") && requested >= available[0] && requested <= (available[1] ?? available[0]);
      return sameStyle && weight >= weights[0] && weight <= (weights[1] ?? weights[0]);
    });
  }
  for (const element of textElements) {
    const s = win.getComputedStyle(element);
    // An undeclared family may use installed fonts; only the CLI can audit the
    // actual glyph source. Declared faces must cover the requested treatment.
    if (faces.some(face => familyName(face.family) === primaryFamily(s.fontFamily)) && !hasFace(s.fontFamily, Number(s.fontWeight), s.fontStyle))
      report("font-face", element, `No declared face for ${s.fontFamily}, weight ${s.fontWeight}, style ${s.fontStyle}. Bundle the matching face; substitution or synthesis changes the intended text.`);
  }
  const colorTokens = ["bg", "fg", "muted", "line", "line-subtle", "line-strong", "inverse", "accent", "wash", "surface", "contrast", "on-contrast", "on-contrast-muted", "emphasis", "emphasis-wash", "complete", "attention", "blocked", ...Array.from({ length: 6 }, (_, i) => `category-${i + 1}`), ...Array.from({ length: 5 }, (_, i) => `sequence-${i + 1}`)];
  function themeColors(style: CSSStyleDeclaration) {
    probe.style.colorScheme = style.colorScheme;
    return Object.fromEntries(colorTokens.map(token => {
      const value = style.getPropertyValue(`--kp-${token}`);
      probe.style.color = ""; probe.style.color = value;
      return [token, value && probe.style.color ? win.getComputedStyle(probe).color : undefined];
    }));
  }
  const pageStyle = win.getComputedStyle(page), version = pageStyle.getPropertyValue("--kp-theme").trim();
  const type = Object.fromEntries(roles.map(role => [role, {
    size: parseFloat(pageStyle.getPropertyValue(`--kp-font-${role}`)),
    lineHeight: parseFloat(pageStyle.getPropertyValue(`--kp-leading-${role}`)),
    weight: Number(pageStyle.getPropertyValue(`--kp-weight-${role}`)),
    tracking: pageStyle.getPropertyValue(`--kp-tracking-${role}`).trim(),
    family: pageStyle.getPropertyValue(role === "display" ? "--kp-font-family-display" : role === "heading" || role === "title" ? "--kp-font-family-heading" : "--kp-font-family").trim(),
  }]));
  const theme = version === "1" ? { version: 1, mode: pageStyle.colorScheme, unit: parseFloat(pageStyle.getPropertyValue("--kp-unit")), type } : undefined;
  if (version && version !== "1") report("theme-version", page, `Unsupported --kp-theme version ${version}; theme checks were skipped.`, "warning");
  if (theme && !page.closest('[data-theme="custom"]')) {
    // Validate the active definition even when a token is not used by this page.
    const required = [...colorTokens, "font-family", "font-family-heading", "font-family-display", "font-family-mono", "weight-strong", "weight-mono", "unit", "rule-width", "stroke", "stroke-heavy", "radius", "radius-small", "page-width", "page-height", "page-margin", ...[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map(n => `space-${n}`), ...roles.flatMap(role => ["font", "leading", "weight", "tracking"].map(property => `${property}-${role}`))];
    const invalid = required.filter(token => !pageStyle.getPropertyValue(`--kp-${token}`).trim()).map(token => `missing --kp-${token}`);
    const rootStyle = win.getComputedStyle(doc.documentElement);
    const shadowed = [...roles.flatMap(role => [`font-${role}`, `leading-${role}`]), "page-width", "page-height", "page-margin"]
      .filter(token => rootStyle.getPropertyValue(`--kp-${token}`).trim() && rootStyle.getPropertyValue(`--kp-${token}`).trim() !== pageStyle.getPropertyValue(`--kp-${token}`).trim());
    if (shadowed.length) report("theme-root", page, `Root values differ from this page: ${shadowed.map(token => `--kp-${token}`).join(", ")}. Apply type and page overrides to [data-page] or [data-size], not :root.`, "warning");
    let previous = 0;
    for (const role of roles) {
      const t = type[role];
      const pixels = ["font", "leading"].every(property => /^\d+(?:\.\d+)?px$/.test(pageStyle.getPropertyValue(`--kp-${property}-${role}`).trim()));
      if (!pixels || !(t.size > previous && t.lineHeight >= t.size && t.weight >= 1 && t.weight <= 1000) || !win.CSS.supports("letter-spacing", t.tracking)) invalid.push(`invalid ${role} type treatment`);
      if (/^\d+(?:\.\d+)?px$/.test(pageStyle.getPropertyValue(`--kp-font-${role}`).trim()) && t.size > 0) previous = t.size;
    }
    const treatments = [...roles.map(role => ({ role, ...type[role] })),
      { role: "strong", family: pageStyle.getPropertyValue("--kp-font-family"), weight: Number(pageStyle.getPropertyValue("--kp-weight-strong")) },
      { role: "mono", family: pageStyle.getPropertyValue("--kp-font-family-mono"), weight: Number(pageStyle.getPropertyValue("--kp-weight-mono")) }];
    const missingFaces = treatments.filter(t => t.family && t.weight > 0 && !hasFace(t.family, t.weight));
    if (missingFaces.length) report("theme-font", page, `Missing declared normal faces: ${missingFaces.map(t => `${t.role} (${t.family}, ${t.weight})`).join("; ")}. Bundle matching families and weights.`);
    const colors = themeColors(pageStyle);
    for (const token of colorTokens) if (!colors[token]) invalid.push(`invalid --kp-${token} color`);
    if (invalid.length) report("theme-definition", page, invalid.join("; "));
    const textContrast: string[] = [], chartContrast: string[] = [];
    const contrast = (foreground: string, background: string, minimum: number, failures: string[]) => {
      const a = rgb(colors[foreground] ?? ""), b = rgb(colors[background] ?? "");
      if (!opaque(a) || !opaque(b)) return;
      const x = luminance(a!), y = luminance(b!), ratio = (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
      if (ratio < minimum) failures.push(`${foreground} on ${background}: ${ratio.toFixed(2)}:1; needs ${minimum}:1`);
    };
    for (const surface of ["bg", "surface", "wash"]) for (const ink of ["fg", "muted"]) contrast(ink, surface, 4.5, textContrast);
    for (const ink of ["on-contrast", "on-contrast-muted"]) contrast(ink, "contrast", 4.5, textContrast);
    contrast("accent", "bg", 4.5, textContrast); contrast("inverse", "accent", 4.5, textContrast);
    const categories = Array.from({ length: 6 }, (_, i) => `category-${i + 1}`);
    for (const token of categories) contrast(token, "bg", 3, chartContrast);
    if (textContrast.length) report("theme-contrast", page, textContrast.join("; "));
    if (chartContrast.length) report("theme-chart-contrast", page, chartContrast.join("; "), "warning");
    if (new Set(categories.map(token => colors[token])).size !== categories.length)
      report("theme-categories", page, "Category colors contain exact duplicates. Use distinct identities or supply non-color encodings.", "warning");
  }
  for (const element of [page, ...elements]) {
    if (!visible(element) || element.closest('[data-theme="custom"]')) continue;
    const style = win.getComputedStyle(element);
    if (style.getPropertyValue("--kp-theme").trim() !== "1") continue;
    if (element.hasAttribute("data-type") && !roles.includes(element.getAttribute("data-type")!))
      report("theme-role", element, `Unknown data-type="${element.getAttribute("data-type")}". Use ${roles.join(", ")}.`, "warning");
    const deviations: string[] = [];
    // SVG text uses explicit coordinates, not CSS line-height, for line spacing.
    if (textElements.has(element) && !roles.some(role =>
      Math.abs(parseFloat(style.getPropertyValue(`--kp-font-${role}`)) - parseFloat(style.fontSize)) < .1 &&
      (element.namespaceURI !== "http://www.w3.org/1999/xhtml" || Math.abs(parseFloat(style.getPropertyValue(`--kp-leading-${role}`)) - parseFloat(style.lineHeight)) < .1)))
      deviations.push(`type pair ${style.fontSize}/${style.lineHeight}`);
    const colors = Object.values(themeColors(style));
    const values = [style.backgroundColor];
    if (textElements.has(element)) values.push(element.namespaceURI === "http://www.w3.org/2000/svg" ? style.fill : style.color);
    probe.style.fontSize = style.fontSize;
    function themedLength(property: "borderTopWidth" | "borderTopLeftRadius" | "strokeWidth", value: string, tokens: string[]) {
      return tokens.some(token => {
        probe.style[property] = ""; probe.style[property] = style.getPropertyValue(`--kp-${token}`);
        return probe.style[property] && win.getComputedStyle(probe)[property] === value;
      });
    }
    probe.style.borderTopStyle = "solid";
    const widths = ["rule-width", "stroke", "stroke-heavy"];
    for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
      const width = style[`border${side}Width`];
      if (parseFloat(width) > 0) {
        values.push(style[`border${side}Color`]);
        if (!themedLength("borderTopWidth", width, widths)) deviations.push(`border width ${width}`);
      }
    }
    for (const corner of ["TopLeft", "TopRight", "BottomLeft", "BottomRight"] as const) {
      const radius = style[`border${corner}Radius`];
      if (radius !== "0px" && !themedLength("borderTopLeftRadius", radius, ["radius", "radius-small"])) deviations.push(`corner radius ${radius}`);
    }
    if (element.matches("path,rect,circle,ellipse,polygon,polyline,line")) {
      if (!element.matches("line")) values.push(style.fill);
      values.push(style.stroke);
      if (style.stroke !== "none" && parseFloat(style.strokeWidth) > 0 && !themedLength("strokeWidth", style.strokeWidth, widths)) deviations.push(`stroke width ${style.strokeWidth}`);
    }
    for (const value of new Set(values))
      if (value !== "none" && value !== "rgba(0, 0, 0, 0)" && !colors.includes(value)) deviations.push(`color ${value}`);
    if (deviations.length) report("theme-value", element, `Outside the active theme: ${[...new Set(deviations)].join(", ")}. Use complete type roles and theme color/shape tokens, or data-theme="custom" for deliberately unthemed content.`, "warning");
  }
  probe.remove();
  for (const link of doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
    if (!link.sheet && !link.disabled) report("missing-stylesheet", page, "A stylesheet did not load. Keep stylesheets beside the HTML or inline them.");
  for (const font of doc.fonts) if (font.status === "error") report("missing-font", page, `Font failed to load: ${font.family}.`);
  return { id: page.id, width: origin.width, height: origin.height, blocks, text, theme, diagnostics };
}
