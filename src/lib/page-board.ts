/** Presentation geometry only; never stored in the authored document. */
export function layoutPages(sizes: readonly { width: number; height: number }[], availableWidth: number, availableHeight: number) {
  const gap = 80, heading = 32;
  let nextX = 0;
  const pages = sizes.map(size => {
    const scale = Math.min(availableWidth / size.width, Math.max(0, availableHeight - heading) / size.height);
    const width = size.width * scale, height = size.height * scale;
    const x = nextX;
    nextX += width + gap;
    return { x, y: heading, width, height };
  });
  const arrows = pages.slice(1).map((next, index) => {
    const previous = pages[index];
    const start = previous.x + previous.width + 16;
    const end = next.x - 16;
    const middle = (start + end) / 2;
    return `M ${start} ${previous.y + previous.height / 2} H ${middle} V ${next.y + next.height / 2} H ${end}`;
  });
  return {
    // The board centers this tightly bounded row when it fits the viewport.
    width: pages.length ? nextX - gap : availableWidth,
    height: pages.length ? heading + Math.max(...pages.map(page => page.height)) : 0,
    pages, arrows,
  };
}
