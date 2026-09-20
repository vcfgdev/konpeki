import type { ReactNode } from 'react';
import { fontsReady } from '../../lib/typeface.ts';

await fontsReady;

const ink = '#172B35', muted = '#50616B', accent = '#006D77', line = '#CBD5DA';
function Copy({ x, y, children, size = 34, color = ink, weight = 400 }: {
  x: number; y: number; children: ReactNode; size?: number; color?: string; weight?: number;
}) {
  return <text x={x} y={y} fill={color} fontSize={size} fontWeight={weight}>{children}</text>;
}
function Frame({ title, subtitle, page, description, children }: {
  title: string; subtitle: string; page: number; description: string; children: ReactNode;
}) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"
    fontFamily="IBM Plex Sans" role="img" aria-label={`${title}. ${description}`} data-page={page}>
    <rect width="1920" height="1080" fill="#FFFFFF" />
    <Copy x={100} y={145} size={70} weight={600}>{title}</Copy>
    <Copy x={100} y={216} size={36} color={muted}>{subtitle}</Copy>
    {children}
    <Copy x={1710} y={1030} size={28} color={muted}>{page} / 3</Copy>
  </svg>;
}
function Window({ x, y, width, height, title, children }: {
  x: number; y: number; width: number; height: number; title: string; children: ReactNode;
}) {
  return <g transform={`translate(${x} ${y})`}>
    <rect width={width} height={height} rx={16} fill="#FFFFFF" stroke={line} strokeWidth={2} />
    <Copy x={32} y={53} size={30} weight={500}>{title}</Copy>
    <line x1={0} x2={width} y1={80} y2={80} stroke={line} />
    {children}
  </g>;
}
const Select = () => <Frame page={1} title="Patchnote turns selected PRs into a draft"
  subtitle="Paste pull-request titles and descriptions, then choose what belongs in the release."
  description="Release 0.8 selects PRs 142, 147 and 153; PR 155, refactoring internal test helpers, is left out. No repository connection.">
  <Copy x={100} y={260} size={26} color={muted}>Fictional product · Illustrative interface</Copy>
  <Window x={100} y={292} width={1180} height={613} title="Release 0.8 / Pasted entries">
    {[
      ['#142', 'Add CSV export for filtered results.', true],
      ['#147', 'Remember the selected date range between visits.', true],
      ['#153', 'Fix duplicate notification emails', true],
      ['#155', 'Refactor internal test helpers.', false],
    ].map(([id, title, selected], i) => <g key={String(id)} transform={`translate(32 ${115 + i * 111})`}>
      <rect x={0} y={0} width={34} height={34} rx={5} fill={selected ? accent : '#FFFFFF'} stroke={selected ? accent : muted} strokeWidth={2} />
      {selected && <path d="M8 17 L14 24 L27 10" stroke="#FFFFFF" strokeWidth={3} fill="none" />}
      <Copy x={58} y={28} size={30} color={muted}>{id}</Copy>
      <Copy x={161} y={28} size={32}>{title}</Copy>
      {i === 2 && <Copy x={161} y={68} size={32}>when a job is retried.</Copy>}
      {i === 3 && <Copy x={161} y={69} size={28} color={muted}>Left out of this release</Copy>}
    </g>)}
  </Window>
  <Copy x={1370} y={361} size={48} weight={600}>3 selected</Copy>
  <Copy x={1370} y={421} size={34} color={muted}>1 left out</Copy>
  <rect x={1370} y={475} width={420} height={84} rx={10} fill={accent} />
  <Copy x={1407} y={529} size={34} color="#FFFFFF" weight={500}>Generate draft →</Copy>
  <Copy x={1370} y={700} size={34} weight={500}>You supply the inputs.</Copy>
  <Copy x={1370} y={756} size={32} color={muted}>No repository connection.</Copy>
</Frame>;

const Review = () => <Frame page={2} title="Review the draft before approving it"
  subtitle="Patchnote groups selected entries into Added, Changed and Fixed, then proposes plain English."
  description="The proposed draft maps Added to PR 142, Changed to PR 147 and Fixed to PR 153. A person checks the input, edits the wording and approves. Drafts can contain mistakes; Patchnote does not verify changes.">
  <Window x={100} y={292} width={1080} height={613} title="Release 0.8 / Proposed draft">
    {[
      ['Added', 'You can now export your filtered results', '#142'],
      ['Changed', 'Your selected date range is remembered', '#147'],
      ['Fixed', 'Fixed duplicate notification emails', '#153'],
    ].map(([category, text, pr], i) => <g key={category} transform={`translate(36 ${142 + i * 155})`}>
      <Copy x={0} y={0} size={30} color={accent} weight={600}>{category}</Copy>
      <Copy x={900} y={0} size={28} color={muted}>{pr}</Copy>
      <Copy x={0} y={52} size={36}>{text}</Copy>
      {i === 0 && <Copy x={0} y={98} size={36}>in CSV format.</Copy>}
      {i === 1 && <Copy x={0} y={98} size={36}>between visits.</Copy>}
      {i === 2 && <Copy x={0} y={98} size={36}>when a job is retried.</Copy>}
    </g>)}
  </Window>
  <Copy x={1280} y={343} size={40} weight={500}>A person decides</Copy>
  <Copy x={1280} y={422} size={34}>Check against the inputs.</Copy>
  <Copy x={1280} y={480} size={34}>Edit the wording.</Copy>
  <Copy x={1280} y={538} size={34}>Approve the draft.</Copy>
  <line x1={1280} y1={600} x2={1820} y2={600} stroke={line} />
  <Copy x={1280} y={673} size={36} weight={500}>Drafts can contain mistakes.</Copy>
  <Copy x={1280} y={736} size={32} color={muted}>Patchnote does not verify</Copy>
  <Copy x={1280} y={782} size={32} color={muted}>the changes described.</Copy>
</Frame>;

const Export = () => <Frame page={3} title="Export the approved draft as Markdown"
  subtitle="The reviewed release note leaves the workspace as text. Publishing remains outside Patchnote."
  description="Illustrative approved release 0.8 Markdown contains Added: export filtered results as CSV; Changed: remember the selected date range between visits; Fixed: duplicate notification emails on job retry. PR 155 is absent. Patchnote does not publish releases. No customer telemetry or measured time savings.">
  <Copy x={100} y={357} size={44} weight={600}>Ready after human review</Copy>
  <Copy x={100} y={430} size={34}>The selected changes are included.</Copy>
  <Copy x={100} y={485} size={34}>Internal test helpers stay out.</Copy>
  <rect x={100} y={552} width={490} height={86} rx={10} fill={accent} />
  <Copy x={140} y={607} size={34} color="#FFFFFF" weight={500}>Export Markdown →</Copy>
  <Copy x={100} y={766} size={32} color={muted}>No customer telemetry or</Copy>
  <Copy x={100} y={813} size={32} color={muted}>measured time savings.</Copy>
  <Window x={770} y={292} width={1050} height={613} title="Release 0.8 / Markdown output">
    {['# Release 0.8', '## Added', '- Export filtered results as CSV.', '## Changed', '- Remember the selected date range', '  between visits.', '## Fixed', '- Fix duplicate notification emails', '  when a job is retried.'].map((text, i) =>
      <Copy key={i} x={38} y={139 + i * 51} size={34} weight={text.startsWith('#') ? 500 : 400} color={text.startsWith('#') ? accent : ink}>{text}</Copy>)}
  </Window>
</Frame>;

export const meta = { title: 'Patchnote — from PRs to release notes', description: 'A fictional product introduction in three pages.' };
export default [Select, Review, Export];
