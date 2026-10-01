export const hintAlphabet = "asdfghjkl";

/** Equal-length codes are prefix-free, including at the 9/10 and 81/82 boundaries. */
export function hintLabels(count: number): string[] {
  let length = 1;
  while (hintAlphabet.length ** length < count) length++;
  return Array.from({ length: count }, (_, index) => {
    let label = "";
    for (let digit = 0; digit < length; digit++) {
      label = hintAlphabet[index % hintAlphabet.length] + label;
      index = Math.floor(index / hintAlphabet.length);
    }
    return label;
  });
}

/** Map an ID inside the sandboxed document to the zoomed host viewport. */
export function targetRect(surface: HTMLElement, id: string): DOMRect | undefined {
  if (surface.getAttribute("aria-busy") !== "false") return;
  const frame = surface.querySelector("iframe"), element = frame?.contentDocument?.getElementById(id);
  if (!frame || !element || element.closest("[data-page]")?.id !== surface.dataset.htmlPage ||
    !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return;
  const rect = element.getBoundingClientRect(), bounds = frame.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const scale = bounds.width / frame.clientWidth;
  return new DOMRect(bounds.left + rect.left * scale, bounds.top + rect.top * scale, rect.width * scale, rect.height * scale);
}

export function reviewHints(surface: HTMLElement) {
  const page = surface.querySelector("iframe")?.contentDocument?.getElementById(surface.dataset.htmlPage!);
  const bounds = surface.getBoundingClientRect();
  const targets = Array.from(page?.querySelectorAll("[id]") ?? []).flatMap(element => {
    const rect = targetRect(surface, element.id);
    if (!rect) return [];
    const left = Math.max(8, bounds.left, rect.left), top = Math.max(8, bounds.top, rect.top);
    const right = Math.min(innerWidth - 8, bounds.right, rect.right), bottom = Math.min(innerHeight - 64, bounds.bottom, rect.bottom);
    if (right <= left || bottom <= top) return [];
    return [{ id: element.id, rect: new DOMRect(left, top, right - left, bottom - top) }];
  });
  const labels = hintLabels(targets.length);
  const placed: DOMRect[] = [];
  return targets.map((target, index) => {
    const label = labels[index], width = label.length * 8 + 12;
    // Prefer the left gutter so a badge does not hide the first word of a note's target.
    const x = Math.max(8, target.rect.left - width - 6);
    const y = target.rect.left >= width + 14 ? target.rect.top : Math.max(8, target.rect.top - 26);
    let badge = new DOMRect(x, y, width, 22);
    const overlaps = (box: DOMRect) => placed.some(p => box.left < p.right + 4 && box.right + 4 > p.left && box.top < p.bottom + 4 && box.bottom + 4 > p.top);
    // Keep nested targets reachable: move overlapping badges, with a leader line
    // back to their element. Prefer the same column before scanning the viewport.
    for (let top = y; overlaps(badge) && top + 22 < innerHeight - 64; top += 26) badge = new DOMRect(x, top, width, 22);
    if (overlaps(badge)) {
      search: for (let top = 8; top + 22 < innerHeight - 64; top += 26) {
        for (let left = 8; left + width < innerWidth - 8; left += width + 4) {
          const next = new DOMRect(left, top, width, 22);
          if (!overlaps(next)) { badge = next; break search; }
        }
      }
    }
    placed.push(badge);
    return { ...target, label, badge };
  });
}
