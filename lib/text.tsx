import { typography as type } from './taste.ts';
import type { Region } from './layouts.ts';
import { useLayoutEffect, useRef, useState } from 'react';

export type TextRun = { text: string; bold?: boolean; italic?: boolean; color?: string };
export type TextContent = string | readonly TextRun[];

// Segment the complete copy, so a style boundary cannot introduce a word break.
function measureLines(copy: TextContent, width: number, size: number, weight: number, family = type.family) {
  const ctx = document.createElement('canvas').getContext('2d')!;
  const runs = typeof copy === 'string' ? [{ text: copy }] : copy;
  const plain = runs.map(run => run.text).join('');
  const slice = (start: number, end: number) => {
    let position = 0;
    return runs.flatMap(run => {
      const text = run.text.slice(Math.max(0, start - position), Math.max(0, end - position));
      position += run.text.length;
      return text ? [{ ...run, text }] : [];
    });
  };
  const measure = (line: readonly TextRun[]) => line.reduce((sum, run) => {
    ctx.font = `${run.italic ? 'italic' : 'normal'} ${run.bold ? 600 : weight} ${size}px ${family}`;
    return sum + ctx.measureText(run.text).width;
  }, 0);
  const lines: TextRun[][] = [];
  let paragraphStart = 0;
  for (const paragraph of plain.split('\n')) {
    let start = paragraphStart, end = start;
    const push = () => {
      const raw = plain.slice(start, end);
      lines.push(slice(start + raw.length - raw.trimStart().length, end - (raw.length - raw.trimEnd().length)));
    };
    const segments: string[] = [];
    for (const { segment } of new Intl.Segmenter(undefined, { granularity: 'word' }).segment(paragraph)) {
      if (segments.length && /^[.,!?;:%…\)\]}»”’]+$/u.test(segment)) segments[segments.length - 1] += segment;
      else segments.push(segment);
    }
    for (const segment of segments) {
      const next = end + segment.length;
      if (plain.slice(start, end).trim() && measure(slice(start, next)) > width) {
        push();
        start = end + segment.length - segment.trimStart().length;
      }
      end = next;
    }
    push();
    paragraphStart += paragraph.length + 1;
  }
  return { lines, tooWide: lines.some(line => measure(line) > width), plain };
}

export function Text({ children, x, y, width, size = type.body, weight = 400, color, maxLines = 3, leading = type.leading, align = 'start', family = type.family }: {
  children: TextContent; x: number; y: number; width: number; size?: number; weight?: number; color: string; maxLines?: number; leading?: number; align?: 'start' | 'end'; family?: string;
}) {
  const { lines, tooWide, plain } = measureLines(children, width, size, weight, family);
  const overflow = lines.length > maxLines || tooWide;
  return <text fill={color} fontFamily={family} fontSize={size} fontWeight={weight} textAnchor={align} data-copy={plain} data-overflow={overflow}>
    {lines.map((line, i) => <tspan key={i} x={x} y={y + i * size * leading} data-line="true">
      {typeof children === 'string' ? line.map(run => run.text).join('') : line.map((run, j) =>
        <tspan key={j} data-run="true" fontWeight={run.bold ? 600 : weight} fontStyle={run.italic ? 'italic' : 'normal'} fill={run.color ?? color}>{run.text}</tspan>)}
    </tspan>)}
  </text>;
}

export function Paragraphs({ region, items, size = type.body, gap = size * type.leading / 2, verticalAlign = 'center' }: {
  region: Region; items: { text: TextContent; color: string; weight?: number }[]; size?: number; gap?: number; verticalAlign?: 'top' | 'center';
}) {
  const ref = useRef<SVGGElement>(null);
  const [offset, setOffset] = useState(0);
  useLayoutEffect(() => {
    const box = ref.current!.getBBox();
    // Upstream also mounts hidden slides whose SVG bounds are not measurable.
    if (box.height === 0) return;
    // Align rendered bounds, including wrapped lines and paragraph gaps.
    // Overset copy stays top-aligned and flagged; centering must not hide it.
    const delta = box.height <= region.height
      ? verticalAlign === 'top' ? region.y - box.y : region.y + region.height / 2 - (box.y + box.height / 2)
      : -offset;
    if (Math.abs(delta) > 0.01) setOffset(offset + delta);
  }, [items, region.y, region.height, region.width, size, gap, offset, verticalAlign]);
  let baseline = region.y + size * 1.1 + offset;
  return <g ref={ref} data-prose="true" data-vertical-align={verticalAlign} data-region={JSON.stringify(region)}>{items.map(({ text, color, weight = 400 }, i) => {
    const y = baseline;
    const { lines } = measureLines(text, region.width, size, weight);
    baseline += lines.length * size * type.leading + gap;
    const maxLines = Math.max(0, 1 + Math.floor((region.y + region.height - y - size * 0.3) / (size * type.leading)));
    return <Text key={i} x={region.x} y={y} width={region.width} size={size} color={color} weight={weight} maxLines={maxLines}>{text}</Text>;
  })}</g>;
}
