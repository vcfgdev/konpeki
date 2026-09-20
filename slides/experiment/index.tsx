import type { ReactNode } from 'react';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';

const ink = '#172B3A';
const muted = '#52616C';
const accent = '#096F78';
const rule = '#B9C4CA';
const results = [
  { name: 'Individual', time: 300, median: 1.2, p95: 2.4 },
  { name: 'Batch of 20', time: 200, median: 1.8, p95: 4.1 },
  { name: 'Batch of 100', time: 150, median: 4.9, p95: 11.8 },
];

function Copy({ x = 112, y, size = 36, weight = 400, color = ink, children, anchor = 'start' }: {
  x?: number; y: number; size?: number; weight?: number; color?: string;
  children: ReactNode; anchor?: 'start' | 'middle' | 'end';
}) {
  return <text x={x} y={y} fontSize={size} fontWeight={weight} fill={color} textAnchor={anchor}>{children}</text>;
}

function Frame({ page, title, description, children }: {
  page: number; title: string; description: string; children: ReactNode;
}) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"
    fontFamily="IBM Plex Sans, sans-serif" role="img" aria-label={`${title}. ${description}`} data-fieldnote-page={page}>
    <rect width="1920" height="1080" fill="#FFFFFF" />
    <Copy y={158} size={68} weight={600}>{title}</Copy>
    {children}
    <Copy x={1808} y={1020} size={28} color={muted} anchor="end">{page} / 3</Copy>
  </svg>;
}

const Evidence = () => <Frame page={1} title="Batching buys speed at a freshness cost"
  description="Fieldnote is a fictional document workspace. Synthetic, hand-authored results, one run per configuration. The same 60,000 updates ran on the same machine, starting with an empty queue and identical index. Individual: 300 seconds, 200 updates per second, median delay 1.2 seconds, p95 2.4 seconds. Batch of 20: 200 seconds, 300 updates per second, median 1.8 seconds, p95 4.1 seconds. Batch of 100: 150 seconds, 400 updates per second, median 4.9 seconds, p95 11.8 seconds. Visibility delay is submission to search. All final versions were correct, with no missing updates; no repeated runs, uncertainty estimates or production measurements.">
  <Copy y={237} size={36} color={muted}>Fieldnote is a fictional workspace; its indexer handles updates individually.</Copy>
  <Copy y={291} size={36} color={muted}>Same 60,000 updates · same machine · empty queue · identical starting index</Copy>

  <Copy y={403} size={30} weight={500}>Configuration</Copy>
  <Copy x={770} y={383} size={30} weight={500} anchor="end">Processing</Copy>
  <Copy x={770} y={425} size={30} color={muted} anchor="end">seconds</Copy>
  <Copy x={1090} y={383} size={30} weight={500} anchor="end">Throughput</Copy>
  <Copy x={1090} y={425} size={30} color={muted} anchor="end">updates / sec</Copy>
  <Copy x={1450} y={383} size={30} weight={500} anchor="end">Median delay</Copy>
  <Copy x={1450} y={425} size={30} color={muted} anchor="end">seconds</Copy>
  <Copy x={1808} y={383} size={30} weight={500} anchor="end">95th-percentile delay</Copy>
  <Copy x={1808} y={425} size={30} color={muted} anchor="end">seconds</Copy>
  {[460, 565, 670, 775].map(y => <line key={y} x1={112} x2={1808} y1={y} y2={y} stroke={rule} strokeWidth={2} />)}
  {results.map((r, i) => <g key={r.name}>
    <Copy y={528 + i * 105} size={40} weight={500}>{r.name}</Copy>
    <Copy x={770} y={528 + i * 105} size={42} anchor="end">{r.time}</Copy>
    <Copy x={1090} y={528 + i * 105} size={42} anchor="end">{60000 / r.time}</Copy>
    <Copy x={1450} y={528 + i * 105} size={42} anchor="end">{r.median.toFixed(1)}</Copy>
    <Copy x={1808} y={528 + i * 105} size={42} anchor="end">{r.p95.toFixed(1)}</Copy>
  </g>)}
  <Copy y={832} size={30} color={muted}>Visibility delay: submission → searchable document. Throughput: 60,000 ÷ processing seconds.</Copy>
  <Copy y={884} size={30}>All final document versions matched expectations; no missing updates in the final check.</Copy>
  <Copy y={949} size={30} color={muted}>Synthetic, hand-authored results · one run each · no uncertainty estimates or production measurements</Copy>
</Frame>;

function Bars({ kind, x, width }: { kind: 'rate' | 'delay'; x: number; width: number }) {
  const rate = kind === 'rate';
  const max = rate ? 400 : 12;
  const target = rate ? 250 : 5;
  const thresholdX = x + target / max * width;
  return <g>
    <Copy x={x} y={348} size={38} weight={500}>{rate ? 'Throughput · updates / sec' : '95th-percentile delay · seconds'}</Copy>
    <Copy x={x} y={397} size={30} color={muted}>{rate ? 'At least 250 required' : 'No more than 5 required'}</Copy>
    <line x1={thresholdX} x2={thresholdX} y1={440} y2={762} stroke={ink} strokeDasharray="9 9" strokeWidth={2} />
    {results.map((r, i) => {
      const value = rate ? 60000 / r.time : r.p95;
      const pass = rate ? value >= target : value <= target;
      const y = 468 + i * 110;
      return <g key={r.name}>
        <rect x={x} y={y} width={value / max * width} height={44} fill={i === 1 ? accent : muted} />
        <Copy x={x + width + 24} y={y + 34} size={30} weight={500}>{value}{pass ? ' ✓' : ' ×'}</Copy>
      </g>;
    })}
    <line x1={x} x2={x + width} y1={768} y2={768} stroke={rule} strokeWidth={2} />
    {(rate ? [0, 100, 200, 300, 400] : [0, 3, 6, 9, 12]).map(tick => <g key={tick}>
      <line x1={x + tick / max * width} x2={x + tick / max * width} y1={768} y2={780} stroke={rule} strokeWidth={2} />
      <Copy x={x + tick / max * width} y={820} size={28} anchor="middle" color={muted}>{tick}</Copy>
    </g>)}
  </g>;
}

const Decision = () => <Frame page={2} title="Batches of 20 deserve the follow-up test"
  description="Only batches of 20 meet both proposed acceptance criteria in these single synthetic runs: at least 250 updates per second and p95 delay no greater than 5 seconds. Individual: 200 updates per second fails throughput, 2.4 seconds passes delay. Batch of 20: 300 and 4.1 both pass. Batch of 100: 400 passes throughput, 11.8 fails delay. The fastest configuration exceeds the delay ceiling by 6.8 seconds. These results support a follow-up test, not a production rollout.">
  <Copy y={237} size={36} color={muted}>Only this configuration meets both proposed criteria in the single-run results.</Copy>
  {results.map((r, i) => <Copy key={r.name} y={502 + i * 110} size={34} weight={i === 1 ? 600 : 400} color={i === 1 ? accent : ink}>{r.name}</Copy>)}
  <Bars kind="rate" x={445} width={485} />
  <Bars kind="delay" x={1170} width={485} />
  <Copy x={112} y={893} size={34}>Batch of 100 is fastest, but its p95 delay exceeds the ceiling by 6.8 seconds.</Copy>
  <Copy x={112} y={949} size={30} color={muted}>Synthetic, one run each. ✓ meets criterion · × misses criterion. This supports testing, not rollout.</Copy>
</Frame>;

const Next = () => <Frame page={3} title="Repeat the runs, then vary the arrival pattern"
  description="Prioritize batches of 20 and retain individual and batch-of-100 controls. Repeat runs under the original fixed-workload conditions and report run-to-run variability rather than selecting the best run. Include sparse arrivals to measure waits for a partial batch, recording the flush policy; include bursts to measure queue growth and recovery. Measure throughput, median and p95 submission-to-search delay, and final-version correctness. A fixed workload does not establish live-traffic behavior. Reassess batches of 20 against at least 250 updates per second under offered load and p95 no greater than 5 seconds; revise batching or flushing and retest if either fails.">
  <Copy y={237} size={36} color={muted}>Prioritize batches of 20; retain individual updates and batches of 100 as controls.</Copy>

  <Copy y={363} size={42} weight={600}>Repeat the fixed workload</Copy>
  <Copy y={425} size={34}>Keep the machine, starting index and</Copy>
  <Copy y={471} size={34}>60,000 updates comparable. Report</Copy>
  <Copy y={517} size={34}>run-to-run variability, not the best run.</Copy>

  <Copy x={1000} y={363} size={42} weight={600}>Exercise sparse arrivals and bursts</Copy>
  <Copy x={1000} y={425} size={34}>Sparse: measure waiting for a partial batch;</Copy>
  <Copy x={1000} y={471} size={34}>record the policy for flushing that batch.</Copy>
  <Copy x={1000} y={539} size={34}>Bursts: track queue growth and recovery,</Copy>
  <Copy x={1000} y={585} size={34}>including submission-to-search delay.</Copy>

  <line x1={112} x2={1808} y1={650} y2={650} stroke={rule} strokeWidth={2} />
  <Copy y={717} size={40} weight={600} color={accent}>Use both gates before advancing</Copy>
  <Copy y={777} size={34}>Recheck ≥250 updates/sec under offered load and p95 delay ≤5 sec;</Copy>
  <Copy y={823} size={34}>track median delay and final-version correctness. If either gate fails, revise</Copy>
  <Copy y={869} size={34}>batching or flushing and retest. Sparse traffic tests freshness, not peak capacity.</Copy>
  <Copy y={949} size={30} color={muted}>The fixed workload does not establish live-traffic behavior. No production measurements exist yet.</Copy>
</Frame>;

export const meta = { title: 'Fieldnote: batching search-index updates' };
export const notes = [
  'Source: the unchanged PROMPT.md. Fieldnote and all results are fictional. Values are not production evidence.',
  'Recommendation is limited to a follow-up test. Rates are derived from 60,000 updates divided by processing time.',
  'Repeated controls, recording the flush policy and queue recovery are proposed implementation details, not measured findings. No flush policy or repetition count was supplied.',
];
export default [Evidence, Decision, Next];
