import type { ReactNode } from 'react';
import { Bar } from '@nivo/bar';
import '../../lib/typeface.ts';
import { chartDefaults } from '../../lib/charts.ts';
import { palettes } from '../../lib/taste.ts';

const ink = '#182B36';
const muted = '#445663';
const before = '#536879';
const after = '#146B60';
export const workflows = [
  { workflow: 'Account setup', Before: 18, After: 12 },
  { workflow: 'Address correction', Before: 11, After: 10 },
  { workflow: 'Refund review', Before: 25, After: 19 },
  { workflow: 'Access removal', Before: 7, After: 8 },
  { workflow: 'Supplier onboarding', Before: 32, After: 24 },
];

function Copy({ x = 112, y, size = 32, weight = 400, fill = ink, children }: {
  x?: number; y: number; size?: number; weight?: number; fill?: string; children: ReactNode;
}) {
  return <text x={x} y={y} fontSize={size} fontWeight={weight} fill={fill}>{children}</text>;
}

function Canvas({ title, description, page, children }: {
  title: string; description: string; page: number; children: ReactNode;
}) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"
    role="img" aria-label={`${title}. ${description}`} fontFamily="IBM Plex Sans, sans-serif" data-birch-page={page}>
    <rect width="1920" height="1080" fill="#FFFFFF" />
    <Copy y={136} size={62} weight={600}>{title}</Copy>
    {children}
    <Copy x={1770} y={1020} size={24} fill={muted}>{page} / 2</Copy>
  </svg>;
}

const Evidence = () => <Canvas page={1} title="Four medians fell; access removal rose"
  description="Synthetic Birch data, median active processing minutes per completed case; lower is better. Account setup: before 18, after 12. Address correction: before 11, after 10. Refund review: before 25, after 19. Access removal: before 7, after 8. Supplier onboarding: before 32, after 24. Each workflow has 80 independent cases per period. Waiting time excluded. These observations do not establish causation.">
  <Copy y={202} size={30} fill={muted}>Birch · Synthetic median active processing time per completed case · Lower is better</Copy>
  <g transform="translate(112 262)">
    <Bar {...chartDefaults(palettes.paper)} width={1696} height={640}
      data={[...workflows].reverse()} keys={['Before', 'After']} indexBy="workflow"
      layout="horizontal" groupMode="grouped" valueScale={{ type: 'linear', min: 0, max: 35 }}
      margin={{ top: 0, right: 90, bottom: 60, left: 345 }} padding={0.26} innerPadding={7}
      colors={({ id }) => id === 'Before' ? before : after}
      label={d => `${d.id}  ${d.value}`} labelTextColor="#FFFFFF" labelSkipWidth={0} labelSkipHeight={0}
      axisLeft={{ tickSize: 0, tickPadding: 24 }}
      axisBottom={{ tickSize: 0, tickPadding: 16, tickValues: [0, 5, 10, 15, 20, 25, 30, 35] }}
      enableGridX enableGridY={false} gridXValues={[0, 5, 10, 15, 20, 25, 30, 35]}
      theme={{ text: { fontFamily: 'IBM Plex Sans', fontSize: 28, fill: ink },
        axis: { ticks: { text: { fontSize: 28, fill: ink } }, domain: { line: { stroke: '#8A969F' } } },
        grid: { line: { stroke: '#DCE2E5', strokeWidth: 1 } },
        labels: { text: { fontSize: 26, fontWeight: 500 } } }}
    />
  </g>
  <Copy x={1340} y={935} size={27} fill={muted}>Minutes · common zero baseline</Copy>
  <Copy y={934} size={30} weight={600} fill={after}>Access removal: +1 minute</Copy>
  <Copy y={984} size={27} fill={muted}>80 different cases per workflow per period · Two weeks each · Waiting time excluded</Copy>
</Canvas>;

const Decision = () => <Canvas page={2} title="Investigate before extending the revised queue"
  description="Recommendation: investigate the access-removal increase and check case mix and quality before extending the revised queue. Supplier onboarding has the largest absolute median reduction, 8 minutes, but still the highest after median, 24 minutes. Independent groups were not randomized or matched; complexity and staffing could differ. No raw times, variability or quality measurements were supplied. Median differences cannot establish total savings or imply every case became faster.">
  <Copy y={207} size={32} fill={muted}>Observed changes are a reason to investigate, not evidence that the queue caused them.</Copy>
  <Copy y={322} size={38} weight={600}>Check before rollout</Copy>
  <Copy x={1050} y={322} size={38} weight={600}>What the comparison cannot tell us</Copy>

  <Copy y={400} size={32} weight={600} fill={after}>Investigate access removal</Copy>
  <Copy y={451}>Its median rose from 7 to 8 minutes.</Copy>
  <Copy y={497}>Review the workflow and the cases behind it.</Copy>

  <Copy y={594} size={32} weight={600} fill={after}>Check case mix, staffing and quality</Copy>
  <Copy y={645}>Before extending the queue, compare complexity</Copy>
  <Copy y={691}>and staffing, and collect quality measurements.</Copy>

  <Copy y={788} size={32} weight={600} fill={after}>Keep supplier onboarding in view</Copy>
  <Copy y={839}>32 → 24 minutes: the largest drop, 8 minutes.</Copy>
  <Copy y={885}>It still has the highest after-period median.</Copy>

  <Copy x={1050} y={400} size={32} weight={600}>No causal attribution</Copy>
  <Copy x={1050} y={451}>The queue changed between two two-week periods.</Copy>
  <Copy x={1050} y={497}>Groups were independent, not randomized or matched;</Copy>
  <Copy x={1050} y={543}>case complexity and staffing could differ.</Copy>

  <Copy x={1050} y={640} size={32} weight={600}>No estimate of uncertainty or total savings</Copy>
  <Copy x={1050} y={691}>No raw times, variability or quality data were supplied.</Copy>
  <Copy x={1050} y={737}>Do not multiply median changes by case counts</Copy>
  <Copy x={1050} y={783}>to claim total time or money saved.</Copy>
  <Copy x={1050} y={861}>A lower median does not mean every case was faster.</Copy>
  <Copy y={1000} size={27} fill={muted}>Birch is fictional. All measurements are synthetic, hand-authored data.</Copy>
</Canvas>;

export const meta = { title: 'Birch — Processing time' };
export const notes = [
  'Source: exact supplied PROMPT.md. The chart compares independent medians, not paired cases. All bars share a 0–35 minute scale.',
  'Recommendation follows the supplied brief. No causal, total-savings, statistical-significance or universal-improvement claim is justified.',
];
export default [Evidence, Decision];
