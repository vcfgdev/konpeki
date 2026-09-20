import type { ReactNode } from 'react';
import '../../lib/typeface.ts';

const ink = '#182B36', muted = '#52636E', accent = '#006D77';
const dates = ['1 Jun', '8 Jun', '15 Jun', '22 Jun', '29 Jun', '6 Jul', '13 Jul', '20 Jul'];
const search = [920, 860, 810, null, 740, 690, 660, 640];
const documentOpen = [620, 610, 640, 630, 650, 670, 660, 680];
const x = (i: number) => 180 + i * 185;
const y = (value: number) => 800 - (value - 600) * 1.3;
function Label({ x, y, children, size = 32, color = ink, weight = 400 }: {
  x: number; y: number; children: ReactNode; size?: number; color?: string; weight?: number;
}) { return <text x={x} y={y} fontSize={size} fill={color} fontWeight={weight}>{children}</text>; }
function Frame({ title, description, page, children }: { title: string; description: string; page: number; children: ReactNode }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"
    fontFamily="IBM Plex Sans" role="img" aria-label={`${title}. ${description}`} data-page={page}>
    <rect width="1920" height="1080" fill="#FFFFFF" />
    <Label x={110} y={143} size={64} weight={600}>{title}</Label>
    {children}
    <Label x={1765} y={1020} size={26} color={muted}>{page} / 2</Label>
  </svg>;
}
const Trend = () => <Frame page={1} title="Search reaches Tide’s weekly latency target"
  description="Synthetic weekly p95 milliseconds, lower is better. Weeks starting 1 June through 20 July 2026. Search: 920, 860, 810, unknown, 740, 690, 660, 640. Document-open: 620, 610, 640, 630, 650, 670, 660, 680. Target at most 700. Search telemetry missing 22 June. Index change enabled 29 June; search was already improving.">
  <Label x={110} y={210} size={30} color={muted}>Tide · fictional document service · synthetic weekly data · June–July 2026</Label>
  <Label x={180} y={299} size={28} color={muted}>Weekly p95 (ms) · lower is better</Label>
  {[600, 700, 800, 900, 1000].map(v => <g key={v}>
    <line x1={180} x2={1475} y1={y(v)} y2={y(v)} stroke={v === 700 ? muted : '#DCE2E5'} strokeWidth={v === 700 ? 3 : 2} strokeDasharray={v === 700 ? '12 9' : undefined} />
    <text x={152} y={y(v) + 9} textAnchor="end" fontSize={28} fill={muted}>{v}</text>
  </g>)}
  <Label x={1510} y={y(700) - 8} size={28} color={muted}>Target ≤700 ms</Label>
  <line x1={x(4)} x2={x(4)} y1={355} y2={810} stroke={muted} strokeWidth={2} strokeDasharray="4 7" />
  <Label x={x(4) + 20} y={357} size={28} color={muted}>29 Jun · index change enabled</Label>
  <Label x={x(4) + 20} y={396} size={28} color={muted}>Search was already improving</Label>
  <path data-series="search" d={`M${x(0)},${y(920)} L${x(1)},${y(860)} L${x(2)},${y(810)} M${x(4)},${y(740)} L${x(5)},${y(690)} L${x(6)},${y(660)} L${x(7)},${y(640)}`} fill="none" stroke={accent} strokeWidth={6} />
  <polyline data-series="document-open" points={documentOpen.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={ink} strokeWidth={4} strokeDasharray="13 8" />
  {documentOpen.map((v, i) => <rect key={i} data-value={v} data-week={i} x={x(i)-7} y={y(v)-7} width={14} height={14} fill="white" stroke={ink} strokeWidth={3} />)}
  {search.map((v, i) => v === null ? null : <circle key={i} data-value={v} data-week={i} cx={x(i)} cy={y(v)} r={8} fill={accent} />)}
  <Label x={1510} y={y(680) + 13} size={30} weight={500}>Document-open 680</Label>
  <Label x={1510} y={y(640) + 19} size={30} color={accent} weight={600}>Search 640</Label>
  <Label x={648} y={510} size={28} color={accent}>Telemetry missing</Label>
  <Label x={648} y={548} size={28} color={accent}>22 Jun · latency unknown</Label>
  {dates.map((date, i) => <text key={date} x={x(i)} y={858} textAnchor="middle" fontSize={28} fill={muted}>{date}</text>)}
  <Label x={180} y={908} size={26} color={muted}>Week starting · each p95 covers the whole week, not an average of daily percentiles</Label>
  <Label x={110} y={995} size={34} weight={500}>Search meets target in its last 3 observed weeks; document-open meets it in all 8.</Label>
</Frame>;

const Decision = () => <Frame page={2} title="Verify the improvement before closing the work"
  description="Search first-to-last observed weekly p95 fell 280 milliseconds, from 920 to 640. This does not prove continuous compliance, individual request latency or causality. Request counts, traffic mix, errors and uncertainty estimates are unavailable, with no control group. Restore telemetry and inspect traffic mix and errors before attribution.">
  <Label x={110} y={224} size={34} color={muted}>Observed progress is clear. The effect of the index change is still unknown.</Label>
  <Label x={110} y={352} size={38} weight={600}>What the observations support</Label>
  <Label x={110} y={438} size={72} color={accent} weight={600}>920 → 640 ms</Label>
  <Label x={110} y={494} size={32}>Search’s first-to-last observed weekly p95</Label>
  <Label x={110} y={541} size={32}>fell 280 ms across the eight-week window.</Label>
  <Label x={110} y={637} size={32}>Weekly p95 does not establish continuous</Label>
  <Label x={110} y={683} size={32}>target compliance or individual request latency.</Label>
  <Label x={110} y={779} size={32}>Search was improving before 29 June.</Label>
  <Label x={110} y={825} size={32}>There was no control group, so the index</Label>
  <Label x={110} y={871} size={32}>change’s effect cannot be isolated.</Label>
  <Label x={1010} y={352} size={38} weight={600}>What the engineering lead should do next</Label>
  <Label x={1010} y={437} size={34} weight={600} color={accent}>Restore reliable telemetry</Label>
  <Label x={1010} y={487} size={32}>The 22 June search week is unknown.</Label>
  <Label x={1010} y={533} size={32}>Check collection coverage before calling it stable.</Label>
  <Label x={1010} y={631} size={34} weight={600} color={accent}>Check traffic mix and errors</Label>
  <Label x={1010} y={681} size={32}>Request counts, mix, error rates and uncertainty</Label>
  <Label x={1010} y={727} size={32}>estimates are unavailable. Gather them to test</Label>
  <Label x={1010} y={773} size={32}>whether the observed weeks are comparable.</Label>
  <Label x={1010} y={871} size={32} weight={500}>Hold off on attribution and declaring the work finished.</Label>
</Frame>;

export const meta = { title: 'Tide — Eight weeks of service latency' };
export const notes = ['Synthetic hand-authored data; exact source and prompt accompany this entry.', 'Observational evidence only. No causal estimate is available.'];
export default [Trend, Decision];
