import type { ReactNode } from 'react';
import { fontsReady } from '../../lib/typeface.ts';

await fontsReady;
const ink = '#172B36', muted = '#50616B', accent = '#006B74', line = '#CAD3D7';
function Label({ x, y, children, size = 32, color = ink, weight = 400 }: { x: number; y: number; children: ReactNode; size?: number; color?: string; weight?: number }) {
  return <text x={x} y={y} fontSize={size} fill={color} fontWeight={weight}>{children}</text>;
}
function Frame({ title, subtitle, page, description, children }: { title: string; subtitle: string; page: number; description: string; children: ReactNode }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" fontFamily="IBM Plex Sans" role="img" aria-label={`${title}. ${description}`} data-page={page}>
    <rect width="1920" height="1080" fill="#FFFFFF" />
    <Label x={100} y={140} size={64} weight={600}>{title}</Label>
    <Label x={100} y={207} size={32} color={muted}>{subtitle}</Label>
    {children}
    <Label x={1705} y={1020} size={26} color={muted}>{page} / 3</Label>
  </svg>;
}
const x = (day: number) => 440 + (day - 5) * 70;
function Gate({ day, y }: { day: number; y: number }) {
  return <path d={`M${x(day)} ${y - 12} l12 12 -12 12 -12 -12 Z`} fill="white" stroke={accent} strokeWidth={3} />;
}
function Arrow({ from, to, y }: { from: number; to: number; y: number }) {
  return <path d={`M${x(from)} ${y} V${y + 29} H${x(to)} V${y + 82} m-7 -10 7 10 7 -10`} stroke={accent} strokeWidth={3} fill="none" />;
}
const Schedule = () => <Frame page={1} title="Launch moves from 19 to 22 October" subtitle="Import is complete. The remaining dates are a forecast, assuming no new defects." description="Shared calendar axis, October 5–22. Baseline agreed October 2: import October 5–9, validation 12–14, training 15–16, launch 19 subject to sponsor approval. Actual import October 5–14. Forecast validation October 15, 16 and 19; training 20–21; launch 22. Arrows connect non-overlapping forecast stages; diamonds mark validation pass, readiness confirmation and sponsor release gates.">
  <rect x={100} y={263} width={38} height={16} fill="none" stroke={muted} strokeWidth={2} />
  <Label x={153} y={282} size={27}>Baseline · agreed 2 Oct</Label>
  <rect x={500} y={263} width={38} height={16} fill={accent} />
  <Label x={553} y={282} size={27}>Completed</Label>
  <rect x={755} y={263} width={38} height={16} fill="none" stroke={accent} strokeDasharray="6 4" strokeWidth={3} />
  <Label x={808} y={282} size={27}>Forecast</Label>
  <path d="M1050 259 l12 12 -12 12 -12 -12 Z" stroke={accent} strokeWidth={3} fill="white" />
  <Label x={1076} y={282} size={27}>Release gate</Label>
  <Label x={1440} y={282} size={27} color={muted}>Shaded = weekend</Label>
  {[10, 11, 17, 18].map(day => <rect key={day} x={x(day)} y={326} width={70} height={499} fill="#F0F3F4" />)}
  {Array.from({ length: 18 }, (_, i) => i + 5).map(day => <g key={day}>
    <Label x={x(day) + 18} y={352} size={26} color={muted}>{day}</Label>
    <line x1={x(day)} x2={x(day)} y1={367} y2={825} stroke="#E6EBED" />
  </g>)}
  <Label x={100} y={320} size={25} color={muted}>October 2026</Label>
  <Label x={100} y={355} size={25} color={muted}>As of end of 14 Oct</Label>
  {[['Import', 'Ana · data lead'], ['Validation', 'Ben · QA lead'], ['Training', 'Cora · operations'], ['Launch', 'Sponsor approval']].map(([stage, owner], i) => <g key={stage}>
    <Label x={100} y={409 + i * 108} size={34} weight={600}>{stage}</Label>
    <Label x={100} y={447 + i * 108} size={26} color={muted}>{owner}</Label>
    <line x1={100} x2={1770} y1={474 + i * 108} y2={474 + i * 108} stroke={line} />
  </g>)}
  {[[5, 10, 389], [12, 15, 497], [15, 17, 605]].map(([a, b, y]) => <rect key={y} x={x(a)} y={y} width={x(b) - x(a)} height={17} fill="white" stroke={muted} strokeWidth={2} />)}
  <path d={`M${x(19) + 35} 711 l10 10 -10 10 -10 -10 Z`} fill="white" stroke={muted} strokeWidth={2} />
  <rect x={x(5)} y={424} width={x(15) - x(5)} height={26} fill={accent} />
  <Label x={x(5) + 18} y={445} size={23} color="white" weight={500}>5–14 Oct · complete</Label>
  {[[15, 17, 532], [19, 20, 532], [20, 22, 640]].map(([a, b, y]) => <rect key={`${a}-${y}`} x={x(a)} y={y} width={x(b) - x(a)} height={26} fill="white" stroke={accent} strokeWidth={3} strokeDasharray="7 4" />)}
  <Arrow from={15} to={15} y={450} />
  <Arrow from={20} to={20} y={558} />
  <Arrow from={22} to={22.5} y={666} />
  <Gate day={20} y={545} /><Gate day={22} y={653} /><Gate day={22.5} y={761} />
  <Label x={100} y={885} size={32} weight={500}>Duplicate member identifiers delayed import completion.</Label>
  <Label x={100} y={931} size={29} color={muted}>Mon–Fri working days; no holidays. No stage overlap. Import complete does not mean validation passed.</Label>
  <Label x={100} y={972} size={25} color={muted}>Diamonds at bar ends mark completion gates; launch diamonds mark release dates.</Label>
</Frame>;

const Gates = () => <Frame page={2} title="Every release gate still needs evidence" subtitle="Validation and training have not started. No validation result is available yet." description="Validation must reconcile member counts and required fields against approved input and resolve every duplicate identifier. An unresolved discrepancy blocks training and launch. Training follows validation pass and lasts two working days. Cora confirms staff readiness after training; sponsor then decides whether to release. Launch no earlier than next working day after training completes.">
  <Label x={100} y={331} size={28} color={muted}>FORECAST STAGE</Label>
  <Label x={670} y={331} size={28} color={muted}>EVIDENCE REQUIRED TO PROCEED</Label>
  <line x1={100} x2={1800} y1={357} y2={357} stroke={line} />
  <Label x={100} y={413} size={38} weight={600}>Validation · Ben</Label>
  <Label x={100} y={461} size={30} color={accent}>15, 16 & 19 Oct · 3 working days</Label>
  <Label x={670} y={413} size={34}>Reconcile member counts and required fields</Label>
  <Label x={670} y={459} size={34}>against approved input; resolve every duplicate ID.</Label>
  <Label x={670} y={511} size={29} color={accent} weight={500}>Any unresolved discrepancy blocks training and launch.</Label>
  <line x1={100} x2={1800} y1={553} y2={553} stroke={line} />
  <Label x={100} y={611} size={38} weight={600}>Staff training · Cora</Label>
  <Label x={100} y={659} size={30} color={accent}>20–21 Oct · 2 working days</Label>
  <Label x={670} y={611} size={34}>Start only after validation passes.</Label>
  <Label x={670} y={657} size={34}>Operations lead confirms staff readiness afterward.</Label>
  <Label x={670} y={709} size={29} color={muted}>Training materials are ready; staff readiness is not yet confirmed.</Label>
  <line x1={100} x2={1800} y1={751} y2={751} stroke={line} />
  <Label x={100} y={809} size={38} weight={600}>Release · Sponsor</Label>
  <Label x={100} y={857} size={30} color={accent}>22 Oct · conditional forecast</Label>
  <Label x={670} y={809} size={34}>Sponsor decides after staff readiness is confirmed.</Label>
  <Label x={670} y={855} size={34}>No earlier than the next working day after training.</Label>
  <line x1={100} x2={1800} y1={901} y2={901} stroke={line} />
</Frame>;

const Decision = () => <Frame page={3} title="Accept the forecast and reserve staff now" subtitle="Sponsor decision requested · Keep the release gates intact." description="Ask sponsor to accept the revised conditional launch forecast for October 22 and reserve staff for training October 20–21. Forecast assumes no new defects and is not a launch commitment. If October 19 is immovable, a separate scope decision and revised plan are needed. No safe shortcut has been established; do not skip validation.">
  <Label x={100} y={367} size={48} weight={600}>Accept 22 October</Label>
  <Label x={100} y={424} size={34}>as the revised launch forecast,</Label>
  <Label x={100} y={470} size={34}>assuming no new defects.</Label>
  <Label x={100} y={540} size={30} color={accent} weight={500}>A forecast, not a launch commitment.</Label>
  <Label x={1010} y={367} size={48} weight={600}>Reserve 20–21 October</Label>
  <Label x={1010} y={424} size={34}>for staff training with Cora.</Label>
  <Label x={1010} y={470} size={34}>Materials are ready.</Label>
  <Label x={1010} y={540} size={30} color={accent} weight={500}>Training starts only after validation passes.</Label>
  <line x1={100} x2={1800} y1={641} y2={641} stroke={line} />
  <Label x={100} y={723} size={42} weight={600}>If 19 October is immovable</Label>
  <Label x={100} y={785} size={36}>The team needs a separate scope decision and a revised plan.</Label>
  <Label x={100} y={846} size={36}>No safe shortcut has been established. Do not skip validation.</Label>
</Frame>;

export default [Schedule, Gates, Decision];
export const meta = { title: 'Harbor — Delivery plan', createdAt: '2026-09-12T00:00:00Z' };
export const notes = [
  'Fictional, hand-authored packet as of end of 14 October 2026. Baseline agreed 2 October. Calendar axis is continuous, weekends shaded; forecast validation has no work on 17–18 October. Diamonds occur at stage completion boundaries or the launch date. All future stages and gates are conditional.',
  'Import started 5 October and finished 14 October after duplicate member identifiers were resolved. Import completion is not evidence of validation passing. The validation gate still requires all stated checks.',
  'Request acceptance of the revised forecast and reserve staff, not unconditional release authorization. No safe shortcut has been established for retaining the original launch date.',
];
