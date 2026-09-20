import { palettes, type Palette } from './base.ts';

// Color-only resources. These are our adaptations, not extracted brand tokens.
// Keep category identity/order stable across modes; status is a separate channel.
export const paletteNames = ['Plex', 'Precision', 'Editorial', 'Blue–cyan', 'Orange–coral', 'Yellow', 'Green', 'Graphite'] as const;
export type PaletteName = typeof paletteNames[number];
export type PaletteMode = 'paper' | 'night';
type SixColors = [string, string, string, string, string, string];
type FiveColors = [string, string, string, string, string];
type PaletteDefinition = {
  accent: [string, string];
  wash: [string, string];
  surface: [string, string];
  categorical: [SixColors, SixColors];
  sequential: [FiveColors, FiveColors];
};

const definitions: Record<PaletteName, PaletteDefinition> = {
  Plex: {
    accent: ['#2458B8', '#91B9FF'], wash: ['#EAF0FA', '#18273F'], surface: ['#F1F3F5', '#171B21'],
    categorical: [['#3569B7', '#167D8D', '#8061A8', '#A27616', '#BA536A', '#59734A'], ['#82AEF2', '#63C3CD', '#BAA0DF', '#D7B55B', '#E899AA', '#A6C58E']],
    sequential: [['#E8EFFB', '#B9CDEA', '#7CA2D4', '#4677B8', '#24518D'], ['#192B45', '#305381', '#4C7CB4', '#82AEF2', '#C2DAFF']],
  },
  Precision: {
    accent: ['#3D3A8F', '#B6B2FF'], wash: ['#EEEFFD', '#22213D'], surface: ['#F2F2F5', '#19191F'],
    categorical: [['#4B469D', '#2F6A8F', '#76538F', '#8A5A25', '#9A475F', '#4F7040'], ['#AAA5F4', '#82BCE2', '#C69DDF', '#DEB071', '#E89AAF', '#A6C88D']],
    sequential: [['#EEEFFD', '#C9C7EC', '#9792D0', '#6761AE', '#3D3A8F'], ['#23223F', '#454278', '#716CB2', '#AAA5F4', '#D9D7FF']],
  },
  Editorial: {
    accent: ['#93451F', '#F2B38C'], wash: ['#F6ECE5', '#30231D'], surface: ['#F4F3F2', '#1B1918'],
    categorical: [['#AF5934', '#387684', '#8A619A', '#8C791D', '#AD5071', '#4D7757'], ['#EFA77F', '#86C3CD', '#C6A3D5', '#D4C17A', '#E9A2BF', '#A0C9A5']],
    sequential: [['#F7EEE7', '#EACAB4', '#CD9875', '#AB6A45', '#794021'], ['#35271F', '#664832', '#A07350', '#D5A17B', '#F6D5B8']],
  },
  'Blue–cyan': {
    accent: ['#007C88', '#63D6E3'], wash: ['#EAF9FA', '#112E33'], surface: ['#F0F9FA', '#121D20'],
    categorical: [['#007C88', '#007F8E', '#275F9A', '#95631F', '#A64D68', '#39724F'], ['#63D6E3', '#79E3EB', '#8FBCEF', '#DBB267', '#E799AF', '#89C9A1']],
    sequential: [['#EAF9FA', '#B7E7EA', '#72C3CA', '#2B9AA5', '#007C88'], ['#123136', '#225D65', '#388F99', '#63C6D0', '#A8EFF4']],
  },
  'Orange–coral': {
    accent: ['#A23E20', '#FFB28E'], wash: ['#FFF0E8', '#33231D'], surface: ['#F5F3F2', '#1D1917'],
    categorical: [['#BA5A31', '#B94970', '#4876AA', '#247D76', '#8861A3', '#92771D'], ['#F3A47C', '#ED99B7', '#91B8E8', '#76C7BE', '#BFA3DD', '#D7BF70']],
    sequential: [['#FCEDE5', '#EDC3AD', '#D89370', '#B66A44', '#88411E'], ['#36251F', '#6D4430', '#A9704D', '#DF9F73', '#FFD1AC']],
  },
  Yellow: {
    accent: ['#756000', '#F1D66D'], wash: ['#FBF5D9', '#302A17'], surface: ['#F5F5F0', '#1C1C18'],
    categorical: [['#95761C', '#416FA4', '#A95670', '#397D71', '#8862A2', '#AD612C'], ['#E0C264', '#91B6E5', '#E1A1B6', '#8AC8B8', '#BFA5D9', '#E4B181']],
    sequential: [['#F8F3D9', '#E5D9A4', '#C4B369', '#9B8433', '#705C12'], ['#302B19', '#5A4C25', '#917A38', '#C9AF59', '#F5DE91']],
  },
  Green: {
    accent: ['#216B3D', '#98DCAF'], wash: ['#EAF3ED', '#1A2D22'], surface: ['#F1F5F2', '#171D19'],
    categorical: [['#43785B', '#5375B5', '#B45A38', '#8B5B96', '#8A781B', '#287F92'], ['#91C7A6', '#9AB8EA', '#E9AB8A', '#CBA4D5', '#D1C278', '#7BC8D8']],
    sequential: [['#E7F0E9', '#B9D1BF', '#83AD90', '#528566', '#2D5941'], ['#1B3023', '#325A40', '#578569', '#91C7A6', '#CBECD6']],
  },
  Graphite: {
    accent: ['#242424', '#F2F2F2'], wash: ['#EDEDED', '#242424'], surface: ['#F5F5F5', '#171717'],
    categorical: [['#3268B5', '#187F86', '#8A5DA6', '#A87922', '#B55372', '#5A7847'], ['#85B2F3', '#77C9CF', '#C3A2E0', '#DDBB78', '#E6A0B8', '#ADC991']],
    sequential: [['#EFEFEF', '#CBCBCB', '#999999', '#666666', '#303030'], ['#282828', '#505050', '#838383', '#B8B8B8', '#EFEFEF']],
  },
};

export function resolvePalette(name: PaletteName, mode: PaletteMode): Palette & {
  categorical: SixColors; sequential: FiveColors; status: { complete: string; attention: string; blocked: string };
} {
  const d = definitions[name], dark = mode === 'night', i = dark ? 1 : 0;
  return {
    ...palettes[mode],
    bg: dark ? '#000000' : '#FFFFFF', fg: dark ? '#F2F2F2' : '#20242A',
    muted: dark ? '#B7BCC4' : '#505B68', line: dark ? '#454B54' : '#C9CFD6',
    ...(name === 'Graphite' ? {
      fg: dark ? '#F2F2F2' : '#202020', muted: dark ? '#B8B8B8' : '#595959',
      line: dark ? '#454545' : '#CECECE', emphasis: d.accent[i], emphasisWash: d.wash[i],
    } : {}),
    accent: d.accent[i], wash: d.wash[i], surface: d.surface[i],
    categorical: [...d.categorical[i]], sequential: [...d.sequential[i]],
    status: dark ? { complete: '#94D3AB', attention: '#E3C477', blocked: '#F0A1AF' }
      : { complete: '#276749', attention: '#946200', blocked: '#AC3348' },
  };
}
