import type { CanvasSize } from "../../composition/types.ts";

function dataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not embed export resources."));
    reader.readAsDataURL(blob);
  });
}

// Serialize the actual renderer, not a second approximation of the composition.
// Resolve computed values (including container units) and embed fonts so the SVG
// image has no external resources when rasterized by the browser.
export async function exportPagePNG(
  source: HTMLElement,
  size: CanvasSize,
): Promise<Blob> {
  await document.fonts.ready;
  await Promise.all(
    Array.from(source.querySelectorAll("img"), (image) => image.decode()),
  );
  const clone = source.cloneNode(true) as HTMLElement;
  const originals = [source, ...source.querySelectorAll("*")];
  const copies = [clone, ...clone.querySelectorAll("*")];
  originals.forEach((node, index) => {
    const target = copies[index];
    if (!(target instanceof HTMLElement || target instanceof SVGElement)) return;
    const computed = getComputedStyle(node);
    for (const key of computed)
      target.style.setProperty(key, computed.getPropertyValue(key));
    target.style.animation = "none";
    target.style.transition = "none";
    target.style.outline = "none";
    if (node === source || node.classList.contains("slide-component"))
      target.style.boxShadow = "none";
    // Table preview cells use generated bars. Materialize these decorations too.
    if (target instanceof HTMLElement)
      for (const pseudo of ["::before", "::after"]) {
        const decoration = getComputedStyle(node, pseudo);
        if (decoration.content !== '""') continue;
        const span = document.createElement("span");
        for (const key of decoration)
          span.style.setProperty(key, decoration.getPropertyValue(key));
        if (pseudo === "::before") target.prepend(span);
        else target.append(span);
      }
  });
  clone
    .querySelectorAll(
      ".resize-handle, .guide, .vector-handles, .inline-intent-editor, .revision-pin",
    )
    .forEach((node) => node.remove());
  const rect = source.getBoundingClientRect();
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  clone.style.margin = "0";
  clone.style.overflow = "hidden";
  const fontRules = Array.from(document.styleSheets).flatMap((sheet) =>
    Array.from(sheet.cssRules).filter(
      (rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule,
    ),
  );
  const fontCSS = await Promise.all(
    fontRules.map(async (rule) => {
      let css = rule.cssText;
      for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
        const response = await fetch(
          new URL(match[1], rule.parentStyleSheet?.href ?? document.baseURI),
        );
        if (!response.ok) throw new Error("Could not load export font.");
        css = css.replace(
          match[0],
          `url("${await dataURL(await response.blob())}")`,
        );
      }
      return css;
    }),
  );
  const style = document.createElement("style");
  style.textContent = fontCSS.join("\n");
  clone.prepend(style);
  const markup = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${rect.width} ${rect.height}"><foreignObject width="100%" height="100%">${markup}</foreignObject></svg>`;
  const image = new Image();
  image.src = await dataURL(new Blob([svg], { type: "image/svg+xml" }));
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PNG export is unavailable in this browser.");
  context.drawImage(image, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("PNG encoding failed.")),
      "image/png",
    ),
  );
}
