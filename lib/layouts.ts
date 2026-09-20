export type Region = { x: number; y: number; width: number; height: number };
export type RelationshipSlot = { x: number; y: number; axis: 'horizontal' | 'vertical' };
export const layoutKinds = ['two-columns', 'main-aside', 'three-columns', 'four-grid', 'one-left', 'one-right', 'one-top', 'one-bottom'] as const;
export type LayoutKind = typeof layoutKinds[number];
export const contentRegion: Region = { x: 112, y: 404, width: 1696, height: 520 };

function split(area: Region, axis: 'horizontal' | 'vertical', weights: number[], gap: number): Region[] {
  const length = axis === 'horizontal' ? area.width : area.height;
  const available = length - gap * (weights.length - 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let offset = 0;
  return weights.map(weight => {
    const size = available * weight / total;
    const region = axis === 'horizontal'
      ? { ...area, x: area.x + offset, width: size }
      : { ...area, y: area.y + offset, height: size };
    offset += size + gap;
    return region;
  });
}

function between(a: Region, b: Region, axis: RelationshipSlot['axis']): RelationshipSlot {
  return axis === 'horizontal'
    ? { x: (a.x + a.width + b.x) / 2, y: a.y + a.height / 2, axis }
    : { x: a.x + a.width / 2, y: (a.y + a.height + b.y) / 2, axis };
}

// Regions and relationship gutters, not an automatic layout/diagram solver.
// A slot is available space; the author decides whether an arrow belongs there.
export function arrange(kind: LayoutKind, area: Region = contentRegion, gap = 80): { panels: Region[]; slots: RelationshipSlot[] } {
  if (kind === 'two-columns' || kind === 'main-aside' || kind === 'three-columns') {
    const weights = kind === 'main-aside' ? [2, 1] : kind === 'three-columns' ? [1, 1, 1] : [1, 1];
    const panels = split(area, 'horizontal', weights, gap);
    return { panels, slots: panels.slice(1).map((panel, i) => between(panels[i], panel, 'horizontal')) };
  }
  if (kind === 'four-grid') {
    const rows = split(area, 'vertical', [1, 1], gap);
    const panels = rows.flatMap(row => split(row, 'horizontal', [1, 1], gap));
    return { panels, slots: [between(panels[0], panels[1], 'horizontal'), between(panels[2], panels[3], 'horizontal'), between(panels[0], panels[2], 'vertical'), between(panels[1], panels[3], 'vertical')] };
  }
  const axis = kind === 'one-top' || kind === 'one-bottom' ? 'vertical' : 'horizontal';
  const halves = split(area, axis, [1, 1], gap);
  const reversed = kind === 'one-right' || kind === 'one-bottom';
  const single = halves[reversed ? 1 : 0], group = halves[reversed ? 0 : 1];
  // Single panel is always index 0; the three siblings follow in reading order.
  return {
    panels: [single, ...split(group, axis === 'horizontal' ? 'vertical' : 'horizontal', [1, 1, 1], 32)],
    slots: [between(halves[0], halves[1], axis)],
  };
}
