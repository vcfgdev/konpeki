/** Presentation geometry only; never stored in the authored document. */
export function layoutPages(sizes: readonly { width: number; height: number }[], availableWidth: number) {
  const width = Math.min(availableWidth, 1440);
  const columns = sizes.length > 1 && width >= 900 ? 2 : 1;
  const gap = 80, heading = 32;
  const pageWidth = columns === 1 ? Math.min(width, 960) : (width - gap) / 2;
  const pages: { x: number; y: number; width: number; height: number }[] = [];
  let top = 0;
  for (let start = 0; start < sizes.length; start += columns) {
    const row = Math.floor(start / columns);
    const heights = sizes.slice(start, start + columns).map(size => pageWidth * size.height / size.width);
    heights.forEach((height, column) => {
      const x = columns === 1 ? (width - pageWidth) / 2 : (row % 2 ? 1 - column : column) * (pageWidth + gap);
      pages.push({ x, y: top + heading, width: pageWidth, height });
    });
    top += heading + Math.max(...heights) + gap;
  }
  const arrows = pages.slice(1).map((next, index) => {
    const previous = pages[index];
    if (next.x === previous.x) {
      const x = previous.x + pageWidth / 2;
      return `M ${x} ${previous.y + previous.height + 16} V ${next.y - heading - 16}`;
    }
    const right = next.x > previous.x;
    const start = previous.x + (right ? pageWidth + 16 : -16);
    const end = next.x + (right ? -16 : pageWidth + 16);
    const middle = (start + end) / 2;
    return `M ${start} ${previous.y + previous.height / 2} H ${middle} V ${next.y + next.height / 2} H ${end}`;
  });
  return { width, height: Math.max(0, top - gap), pages, arrows };
}
