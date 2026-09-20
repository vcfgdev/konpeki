import type { ReactNode } from 'react';
import { layout, palettes, typography as type, type Palette } from './taste.ts';
import type { Region, RelationshipSlot } from './layouts.ts';
import { Paragraphs, Text, type TextContent } from './text.tsx';

export function Panel({ region, title, body, palette: p }: { region: Region; title: string; body: TextContent; palette: Palette }) {
  const padding = 20;
  return <g data-panel="true" data-region={JSON.stringify(region)}>
    <rect {...region} rx={layout.radius} fill={p.bg} stroke={p.line} />
    <Paragraphs verticalAlign="top" region={{ x: region.x + padding, y: region.y + padding, width: region.width - 2 * padding, height: region.height - 2 * padding }}
      items={[{ text: title, color: p.fg, weight: 500 }, { text: body, color: p.muted }]} />
  </g>;
}

export function Relationship({ slot, kind = 'forward', reverse = false, color }: {
  slot: RelationshipSlot; kind?: 'forward' | 'both' | 'cycle'; reverse?: boolean; color: string;
}) {
  const angle = (slot.axis === 'vertical' ? 90 : 0) + (reverse ? 180 : 0);
  const d = kind === 'cycle'
    ? 'M-20 -5 A21 21 0 0 1 20 -5 M11 -10 L20 -5 L23 -15 M20 5 A21 21 0 0 1 -20 5 M-11 10 L-20 5 L-23 15'
    : `M-24 0 H24 M12 -8 L24 0 L12 8${kind === 'both' ? ' M-12 -8 L-24 0 L-12 8' : ''}`;
  return <g data-relationship={kind} role="img" aria-label={kind === 'cycle' ? 'Feedback cycle' : kind === 'both' ? 'Bidirectional relationship' : 'Directional relationship'}
    transform={`translate(${slot.x} ${slot.y}) rotate(${angle})`}>
    <path d={d} fill="none" stroke={color} strokeWidth={layout.stroke} strokeLinejoin="round" />
  </g>;
}

export function Sheet({ id, number, title, caption, state, children, total = '06', palette }: {
  id: string; number: string; title: string; caption: string; state: { theme: keyof typeof palettes };
  children: (p: Palette) => ReactNode; total?: string; palette?: Palette;
}) {
  const p = palette ?? palettes[state.theme];
  return <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"
    fontFamily={type.family} role="img" aria-label={title} data-visual={id}>
    <rect width="1920" height="1080" fill={p.bg} />
    <Text x={layout.inset} y={164} width={layout.contentWidth} size={type.display} weight={500} color={p.fg} maxLines={2} leading={1.12}>{title}</Text>
    <g transform="translate(0 -56)" data-slide-content="true">{children(p)}</g>
    <line x1={layout.inset} y1="982" x2="1808" y2="982" stroke={p.line} />
    <text x={layout.inset} y="1026" fontSize={type.meta} fill={p.muted}>{caption}</text>
    <text x="1808" y="1026" textAnchor="end" fontSize={type.meta} fill={p.muted} data-page-number="true">{number} / {total}</text>
  </svg>;
}
