import type { ReactNode } from 'react';
import '../../lib/typeface.ts';

const ink = '#172D35';
const muted = '#52636B';
const accent = '#087E83';
const neutral = '#637982';
const grid = '#DAE2E5';
const configurations = [
  { label: 'Individual', seconds: 300, delay: 2.4 },
  { label: 'Batches of 20', seconds: 200, delay: 4.1 },
  { label: 'Batches of 100', seconds: 150, delay: 11.8 },
];
const throughput = configurations.map(({ seconds }) => 60_000 / seconds);

function Label({ x, y, children, size = 30, weight = 400, color = ink, anchor = 'start' }: {
  x: number; y: number; children: ReactNode; size?: number; weight?: number;
  color?: string; anchor?: 'start' | 'middle' | 'end';
}) {
  return <text x={x} y={y} fontSize={size} fontWeight={weight} fill={color} textAnchor={anchor}>{children}</text>;
}

function Frame({ title, description, page, children }: {
  title: string; description: string; page: number; children: ReactNode;
}) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"
    fontFamily="IBM Plex Sans" role="img" aria-label={`${title}. ${description}`} data-page={page}>
    <rect width="1920" height="1080" fill="#FFFFFF" />
    <Label x={100} y={138} size={64} weight={600}>{title}</Label>
    {children}
    <Label x={1816} y={1022} size={26} color={muted} anchor="end">{page} / 2</Label>
  </svg>;
}

function Bars({ id, x, width, top, height, values, max, ticks, unit, threshold }: {
  id: string; x: number; width: number; top: number; height: number; values: number[];
  max: number; ticks: number[]; unit: string; threshold?: { value: number; label: string };
}) {
  const left = x + 68;
  const right = x + width;
  const baseline = top + height;
  const step = (right - left) / 3;
  const barWidth = step * 0.46;
  const y = (value: number) => baseline - value / max * height;
  return <g data-chart={id}>
    <Label x={x} y={top - 44} size={28} color={muted}>{unit}</Label>
    {ticks.map(tick => <g key={tick}>
      <line x1={left} x2={right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? muted : grid} strokeWidth={tick === 0 ? 2 : 1} data-tick={tick} />
      <Label x={left - 18} y={y(tick) + 9} size={26} color={muted} anchor="end">{tick}</Label>
    </g>)}
    {threshold && <g>
      <line data-threshold={threshold.value} x1={left} x2={right} y1={y(threshold.value)} y2={y(threshold.value)} stroke={ink} strokeWidth={3} strokeDasharray="10 8" />
      <Label x={right} y={top - 44} size={28} weight={500} anchor="end">{threshold.label}</Label>
    </g>}
    {values.map((value, i) => {
      const center = left + step * (i + 0.5);
      return <g key={configurations[i].label}>
        <rect data-bar={configurations[i].label} x={center - barWidth / 2} y={y(value)} width={barWidth} height={baseline - y(value)} fill={i === 1 ? accent : neutral} />
        <Label x={center} y={y(value) + (threshold ? 40 : -17)} size={36} weight={600} color={threshold ? '#FFFFFF' : ink} anchor="middle">{value}</Label>
        <Label x={center} y={baseline + 46} size={28} weight={i === 1 ? 600 : 400} anchor="middle">{configurations[i].label}</Label>
      </g>;
    })}
  </g>;
}

const Throughput = () => <Frame page={1} title="Larger batches raise Fieldnote’s throughput"
  description="Synthetic results: Individual updates, 200 updates per second; batches of 20, 300; batches of 100, 400. Same 60,000 updates per configuration. One run each, not production evidence.">
  <Label x={100} y={208} size={32} color={muted}>A controlled comparison in a fictional document workspace</Label>
  <Bars id="throughput" x={100} width={1110} top={352} height={450} values={throughput} max={500} ticks={[0, 100, 200, 300, 400, 500]} unit="Throughput · updates / second" />
  <Label x={1330} y={343} size={36} weight={600}>Same work, less time</Label>
  <Label x={1330} y={405} size={30}>60,000 document updates each</Label>
  <Label x={1330} y={458} size={30} color={muted}>Individual: 300 seconds</Label>
  <Label x={1330} y={503} size={30} color={muted}>Batches of 20: 200 seconds</Label>
  <Label x={1330} y={548} size={30} color={muted}>Batches of 100: 150 seconds</Label>
  <Label x={1330} y={643} size={30} weight={500}>Throughput = 60,000 ÷ time</Label>
  <Label x={1330} y={716} size={28} color={muted}>Same machine, empty queue,</Label>
  <Label x={1330} y={756} size={28} color={muted}>identical starting index.</Label>
  <Label x={1330} y={808} size={28} color={muted}>All final versions were correct.</Label>
  <Label x={100} y={941} size={28} color={muted}>Synthetic, hand-authored results · one run per configuration</Label>
  <Label x={100} y={984} size={28} color={muted}>No production measurements or uncertainty estimates. Faster completion does not establish timely search visibility.</Label>
</Frame>;

const Tradeoff = () => <Frame page={2} title="Test batches of 20: only they meet both targets"
  description="Proposed minimum throughput is 250 updates per second; maximum p95 search visibility delay is 5 seconds. In Individual, Batches of 20, Batches of 100 order, throughput is 200, 300, 400 and p95 delay is 2.4, 4.1, 11.8 seconds. Recommend follow-up testing, not production adoption; repeat with sparse arrivals and bursts.">
  <Label x={100} y={208} size={32} color={muted}>Maximum throughput alone is insufficient: batches of 100 exceed the search visibility delay limit.</Label>
  <Label x={100} y={296} size={36} weight={600}>Throughput</Label>
  <Label x={1030} y={296} size={36} weight={600}>Search visibility delay · p95</Label>
  <Bars id="throughput" x={100} width={790} top={398} height={360} values={throughput} max={500} ticks={[0, 100, 200, 300, 400, 500]} unit="Updates / second" threshold={{ value: 250, label: 'Proposed min. 250' }} />
  <Bars id="delay" x={1030} width={790} top={398} height={360} values={configurations.map(c => c.delay)} max={15} ticks={[0, 3, 6, 9, 12, 15]} unit="Seconds" threshold={{ value: 5, label: 'Proposed max. 5 s' }} />
  <Label x={1030} y={859} size={26} color={muted}>Delay: submission → updated document appears in search.</Label>
  <Label x={100} y={919} size={34} weight={600} color={accent}>Follow-up testing, not production adoption.</Label>
  <Label x={100} y={965} size={28} color={muted}>Repeat with sparse arrivals and bursts. Synthetic, hand-authored data; one run per configuration.</Label>
  <Label x={100} y={1008} size={28} color={muted}>No production measurements or uncertainty estimates. All final document versions were correct.</Label>
</Frame>;

export const meta = { title: 'Fieldnote · Batch size and search visibility' };
export default [Throughput, Tradeoff];
