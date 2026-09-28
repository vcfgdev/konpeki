/** Presentation geometry only; never stored in the authored document. */
export function layoutPages(sizes: readonly { width: number; height: number }[], availableWidth: number, availableHeight: number) {
  const gap = 80, heading = 32;
  const pages = sizes.map((size, index) => {
    const scale = Math.min(availableWidth / size.width, Math.max(0, availableHeight - heading) / size.height);
    const width = size.width * scale, height = size.height * scale;
    return { x: index * (availableWidth + gap) + (availableWidth - width) / 2, y: heading, width, height };
  });
  const arrows = pages.slice(1).map((next, index) => {
    const previous = pages[index];
    const start = previous.x + previous.width + 16;
    const end = next.x - 16;
    const middle = (start + end) / 2;
    return `M ${start} ${previous.y + previous.height / 2} H ${middle} V ${next.y + next.height / 2} H ${end}`;
  });
  return {
    width: sizes.length ? sizes.length * (availableWidth + gap) - gap : availableWidth,
    height: pages.length ? heading + Math.max(...pages.map(page => page.height)) : 0,
    pages, arrows,
  };
}
