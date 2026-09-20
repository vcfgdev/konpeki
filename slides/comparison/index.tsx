import type { ReactNode } from 'react';
import '../../lib/typeface.ts';

const ink = '#172B26';
const muted = '#4F605A';
const accent = '#236B50';
const rule = '#C4CEC9';

function Copy({ x = 112, y, lines, size = 36, weight = 400, color = ink }: {
  x?: number; y: number; lines: string[]; size?: number; weight?: number; color?: string;
}) {
  return <text x={x} y={y} fill={color} fontSize={size} fontWeight={weight}>
    {lines.map((line, i) => <tspan key={i} x={x} dy={i ? size * 1.35 : 0}>{line}</tspan>)}
  </text>;
}

function Canvas({ title, description, number, children }: {
  title: string; description: string; number: number; children: ReactNode;
}) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"
    fontFamily="IBM Plex Sans" role="img" aria-label={`${title}. ${description}`} data-moss-page={number}>
    <rect width="1920" height="1080" fill="#FFFFFF" />
    <Copy y={154} lines={[title]} size={72} weight={600} />
    {children}
    <Copy x={1752} y={1022} lines={[`${number} / 3`]} size={28} color={muted} />
  </svg>;
}

const Shortlist = () => <Canvas number={1} title="Moss should trial Postbox first"
  description="Fictional scenario. Six agents need email, shared assignment and complete CSV history export. Postbox includes all three for $108 per month before tax, leaving $42 of the $150 subscription budget. Threadline costs $144 and adds chat. OwnDesk requires server operations Moss cannot supply.">
  <Copy y={234} lines={['Six people. Email intake, shared assignment and complete CSV history export.']} color={muted} />
  <Copy y={332} lines={['All three list the required features. Cost and operating capacity decide the shortlist.']} size={38} weight={500} />
  <Copy x={112} y={423} lines={['Option']} size={30} color={muted} />
  <Copy x={510} y={423} lines={['Monthly cost · six agents']} size={30} color={muted} />
  <Copy x={1038} y={423} lines={['Fit for Moss now']} size={30} color={muted} />
  <line x1={112} x2={1808} y1={452} y2={452} stroke={rule} strokeWidth={2} />
  <Copy y={512} lines={['Postbox']} size={44} weight={600} color={accent} />
  <Copy x={510} y={512} lines={['$108 subscription', '$18 × 6 agents']} size={36} />
  <Copy x={1038} y={512} lines={['Hosted · trial first', 'Meets today’s needs; no chat channel.']} size={36} />
  <line x1={112} x2={1808} y1={594} y2={594} stroke={rule} strokeWidth={2} />
  <Copy y={653} lines={['Threadline']} size={44} weight={600} />
  <Copy x={510} y={653} lines={['$144 subscription', '$24 × 6 agents']} size={36} />
  <Copy x={1038} y={653} lines={['Hosted · conditional alternative', 'Adds chat, useful later rather than now.']} size={36} />
  <line x1={112} x2={1808} y1={735} y2={735} stroke={rule} strokeWidth={2} />
  <Copy y={794} lines={['OwnDesk']} size={44} weight={600} />
  <Copy x={510} y={794} lines={['$0 software subscription', 'Operating costs unknown']} size={36} />
  <Copy x={1038} y={794} lines={['Self-hosted · exclude for now', 'Moss cannot operate its own server.']} size={36} />
  <line x1={112} x2={1808} y1={876} y2={876} stroke={rule} strokeWidth={2} />
  <Copy y={936} lines={['Fictional, hand-authored specifications—not vendor research. Hosted prices exclude tax;', 'both hosted options have no setup fee. Listed features do not establish quality.']} size={30} color={muted} />
</Canvas>;

const Tradeoff = () => <Canvas number={2} title="Chat must earn its $36 monthly premium"
  description="Postbox is $108 per month with $42 subscription headroom; Threadline is $144 with $6 headroom against a $150 budget, before tax. Trial Threadline if a concrete near-term chat workflow is valuable enough to justify the premium. OwnDesk includes chat but requires hosting, backups, upgrades and incident response with unknown costs.">
  <Copy y={239} lines={['Both hosted options fit the $150 subscription budget before tax.']} size={38} color={muted} />
  <Copy y={358} lines={['Postbox']} size={42} weight={600} color={accent} />
  <Copy y={442} lines={['$108 / month']} size={64} weight={600} />
  <Copy y={505} lines={['$42 budget headroom']} size={34} color={muted} />
  <Copy x={982} y={358} lines={['Threadline']} size={42} weight={600} />
  <Copy x={982} y={442} lines={['$144 / month']} size={64} weight={600} />
  <Copy x={982} y={505} lines={['$6 budget headroom']} size={34} color={muted} />
  <Copy y={624} lines={['Start with the current workflow']} size={40} weight={600} />
  <Copy y={682} lines={['Postbox covers the three required capabilities.', 'Do not pay for chat on a feature list alone.']} size={36} />
  <Copy x={982} y={624} lines={['Trial Threadline when chat has a job']} size={40} weight={600} />
  <Copy x={982} y={682} lines={['Name a near-term chat workflow and test it.', 'Choose Threadline only if the added value', 'justifies $36/month and the final bill fits.']} size={36} />
  <line x1={112} x2={1808} y1={847} y2={847} stroke={rule} strokeWidth={2} />
  <Copy y={911} lines={['OwnDesk also lists chat, but Moss would own hosting, backups, upgrades and incident', 'response. With no operating capacity and unknown costs, it is not a zero-cost alternative.']} size={34} />
  <Copy y={1014} lines={['Fictional scenario · subscription calculations for six paid agents, before tax.']} size={28} color={muted} />
</Canvas>;

const Trial = () => <Canvas number={3} title="Use the trial to test the purchase decision"
  description="Start Postbox with a representative sample. Verify email intake and shared assignment with all six agents; reconcile a CSV export to ticket history; confirm six-agent pricing and tax. No usability, reliability or migration results are measured. Purchase only after required workflow and export checks pass; compare Threadline if chat becomes a justified need.">
  <Copy y={239} lines={['Begin with Postbox and representative tickets, then make a go/no-go decision.']} size={38} color={muted} />
  <Copy y={369} lines={['Verify in the trial']} size={32} color={muted} />
  <Copy x={788} y={369} lines={['Evidence to collect before purchase']} size={32} color={muted} />
  <line x1={112} x2={1808} y1={397} y2={397} stroke={rule} strokeWidth={2} />
  <Copy y={463} lines={['Email + assignment']} size={40} weight={600} />
  <Copy x={788} y={463} lines={['Send incoming email; assign and reassign tickets.', 'Have all six agents confirm ownership is clear.']} size={36} />
  <line x1={112} x2={1808} y1={549} y2={549} stroke={rule} strokeWidth={2} />
  <Copy y={613} lines={['Complete CSV history']} size={40} weight={600} />
  <Copy x={788} y={613} lines={['Export the sample and reconcile it to ticket history.', 'Check records, fields and chronological completeness.']} size={36} />
  <line x1={112} x2={1808} y1={699} y2={699} stroke={rule} strokeWidth={2} />
  <Copy y={763} lines={['Final cost + transition']} size={40} weight={600} />
  <Copy x={788} y={763} lines={['Confirm the six-agent quote and tax against budget.', 'Test a small migration before committing the inbox.']} size={36} />
  <line x1={112} x2={1808} y1={849} y2={849} stroke={rule} strokeWidth={2} />
  <Copy y={915} lines={['Buy only after required workflow and export checks pass.']} size={40} weight={600} color={accent} />
  <Copy y={974} lines={['No measured usability, reliability or migration results exist in this fictional scenario.', 'Review reliability evidence separately; a short trial cannot establish long-term reliability.']} size={30} color={muted} />
</Canvas>;

export const meta = { title: 'Moss — choosing a support inbox', createdAt: '2026-09-12T14:20:00Z' };
export const notes = [
  'Recommendation based only on supplied fictional specifications, not observed product performance.',
  'Derived arithmetic: 18 × 6 = 108; 24 × 6 = 144; 144 − 108 = 36; 150 − 108 = 42; 150 − 144 = 6.',
  'Trial checks are proposed decision criteria, not measured results or claims about product behavior.',
];
export default [Shortlist, Tradeoff, Trial];
