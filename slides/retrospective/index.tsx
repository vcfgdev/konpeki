import type { ReactNode } from 'react';
import '../../lib/typeface.ts';

const ink = '#182D39';
const muted = '#4E606B';
const accent = '#006C70';
const line = '#B9C8CD';

function Copy({ x, y, lines, size = 34, weight = 400, color = ink }: {
  x: number; y: number; lines: string[]; size?: number; weight?: number; color?: string;
}) {
  return <text x={x} y={y} fontSize={size} fontWeight={weight} fill={color}>
    {lines.map((text, i) => <tspan key={i} x={x} dy={i ? size * 1.35 : 0}>{text}</tspan>)}
  </text>;
}

function Frame({ page, title, description, children }: {
  page: number; title: string; description: string; children: ReactNode;
}) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"
    fontFamily="IBM Plex Sans" role="img" aria-labelledby={`title-${page} desc-${page}`} data-dockline-page={page}>
    <title id={`title-${page}`}>{title}</title>
    <desc id={`desc-${page}`}>{description}</desc>
    <rect width="1920" height="1080" fill="#FFFFFF" />
    <Copy x={112} y={155} lines={[title]} size={64} weight={600} />
    {children}
    <Copy x={1710} y={1018} lines={[`${page} / 4`]} size={26} color={muted} />
  </svg>;
}

const Plan = () => <Frame page={1} title="Dockline planned a self-service lifecycle"
  description="A fictional temporary test-environment tool. Four weeks, two engineers, one product lead. Planned: request, view status, extend expiry, automatic deletion. Week 1 delivered a form and status page with manual operator provisioning. Deletion-failure ownership and retention rules were undefined.">
  <Copy x={112} y={242} lines={['Fictional test-environment project · Four weeks · Two engineers + one product lead']} size={32} color={muted} />
  {[
    ['Request', 'Ask for an', 'environment'],
    ['Track', 'See its', 'status'],
    ['Extend', 'Move its', 'expiry date'],
    ['Delete', 'Remove expired', 'environments automatically'],
  ].map(([title, ...body], i) => <g key={title}>
    <Copy x={112 + i * 430} y={402} lines={[title]} size={44} weight={600} color={accent} />
    <Copy x={112 + i * 430} y={466} lines={body} size={32} />
  </g>)}
  <line x1={112} x2={1808} y1={601} y2={601} stroke={line} strokeWidth={2} />
  <Copy x={112} y={682} lines={['Week 1']} size={38} weight={600} />
  <Copy x={112} y={742} lines={['Request fields agreed.', 'Form and status page built.', 'Provisioning stayed with an operator.']} />
  <Copy x={1030} y={682} lines={['Lifecycle questions left open']} size={38} weight={600} />
  <Copy x={1030} y={742} lines={['Who owns deletion failures?', 'Which environments must be retained?']} />
</Frame>;

const Scope = () => <Frame page={2} title="Operator review changed the pilot scope"
  description="In week 2 operators identified retention holds and a deletion audit trail as requirements. Rather than adding these late, the team removed automatic deletion. Delivered: request form, operator-updated status page, expiry reminders and manual cleanup queue. Provisioning and deletion remain manual.">
  <Copy x={112} y={270} lines={['Week 2 · Requirements surfaced']} size={36} weight={600} color={accent} />
  <Copy x={112} y={344} lines={['Some environments needed', 'a retention hold.', '', 'Deletion needed an audit trail.']} size={38} />
  <Copy x={1050} y={270} lines={['Scope decision']} size={36} weight={600} color={accent} />
  <Copy x={1050} y={344} lines={['Remove automatic deletion', 'from the pilot rather than', 'add these requirements late.']} size={38} />
  <line x1={112} x2={1808} y1={601} y2={601} stroke={line} strokeWidth={2} />
  <Copy x={112} y={681} lines={['Delivered']} size={42} weight={600} />
  <Copy x={112} y={754} lines={['Request form', 'Operator-updated status page']} size={36} />
  <Copy x={1050} y={754} lines={['Expiry reminders', 'Manual cleanup queue']} size={36} />
  <Copy x={112} y={912} lines={['Provisioning and deletion remain manual.']} size={34} weight={500} color={accent} />
</Frame>;

const Evidence = () => <Frame page={3} title="Form completeness improved in a small retest"
  description="Week 3: eight invited users made 12 requests; nine complete and three needing clarification because the environment-owner field was unexplained. Two users confused submitted with ready; these user and request counts may overlap. Week 4 added an owner explanation and distinct submitted, provisioning and ready states. All six new requests had required fields. Status understanding was not retested. This suggests help, not lasting improvement or causation.">
  <Copy x={112} y={213} lines={['Synthetic pilot records']} size={28} color={muted} />
  <Copy x={112} y={270} lines={['Week 3 · Eight invited users']} size={36} weight={600} />
  <Copy x={1050} y={270} lines={['Week 4 · Six new requests']} size={36} weight={600} />
  <Copy x={112} y={383} lines={['9 of 12']} size={76} weight={600} color={accent} />
  <Copy x={1050} y={383} lines={['6 of 6']} size={76} weight={600} color={accent} />
  <Copy x={112} y={440} lines={['requests had all required information.']} size={32} />
  <Copy x={1050} y={440} lines={['new requests had all required fields.']} size={32} />
  <Copy x={112} y={524} lines={['Three needed clarification:', 'the environment-owner field', 'was not explained.']} size={34} />
  <Copy x={1050} y={524} lines={['Added an owner-field explanation.', 'Status now distinguishes submitted,', 'provisioning and ready.']} size={34} />
  <line x1={112} x2={1808} y1={665} y2={665} stroke={line} strokeWidth={2} />
  <Copy x={112} y={726} lines={['Two users read “submitted” as “ready”.', 'They may overlap with requests needing', 'clarification; these are separate counts.']} size={32} />
  <Copy x={1050} y={726} lines={['Status understanding was not retested.', 'The form result suggests help, but does', 'not establish lasting improvement', 'or which change caused the result.']} size={32} />
</Frame>;

const Next = () => <Frame page={4} title="Define lifecycle ownership before automation"
  description="The proposed lesson is to involve operators and define lifecycle ownership before committing to automation. Next: specify retention and audit behavior, assign a deletion-failure owner and retest status understanding. Not implemented: self-service expiry extensions, retention holds, deletion audit trail or automatic deletion. No time-saving or reliability measurements are available.">
  <Copy x={112} y={246} lines={['Proposed lesson: involve operators before committing to automation.']} size={34} color={muted} />
  <Copy x={112} y={352} lines={['Next steps']} size={40} weight={600} color={accent} />
  {[
    ['Specify behavior', 'Define retention holds and deletion audit behavior.'],
    ['Assign ownership', 'Name the owner for deletion failures.'],
    ['Retest understanding', 'Check whether users distinguish submitted from ready.'],
  ].map(([heading, body], i) => <g key={heading}>
    <line x1={112} x2={1808} y1={394 + i * 116} y2={394 + i * 116} stroke={line} strokeWidth={2} />
    <Copy x={112} y={460 + i * 116} lines={[heading]} size={34} weight={600} />
    <Copy x={650} y={460 + i * 116} lines={[body]} size={34} />
  </g>)}
  <line x1={112} x2={1808} y1={742} y2={742} stroke={line} strokeWidth={2} />
  <Copy x={112} y={819} lines={['Not implemented']} size={32} weight={600} />
  <Copy x={650} y={819} lines={['Self-service expiry extensions, retention holds,', 'deletion audit trail and automatic deletion.']} size={32} />
  <Copy x={112} y={942} lines={['No time-saving or reliability measurements are available.']} size={32} color={muted} />
</Frame>;

export const meta = { title: 'Dockline — four-week retrospective' };
export const notes = [
  'Synthetic project records supplied in PROMPT.md; not observations of a real pilot. The initial plan was broader than the delivered pilot.',
  'Retention and audit requirements were discovered, not implemented. Removing automatic deletion was the explicit scope decision.',
  'Do not add the two users to the three requests. Different denominators and possible overlap. Six new requests are a small exercise, not a causal test.',
  'These are proposed next steps, not completed work or a delivery commitment. No measured time-saving or reliability claims are supported.',
];
export default [Plan, Scope, Evidence, Next];
