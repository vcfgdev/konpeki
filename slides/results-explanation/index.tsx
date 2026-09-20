import type { ReactNode } from 'react';
import { fontsReady } from '../../lib/typeface.ts';

await fontsReady;
const ink = '#172B37', muted = '#4D606B', accent = '#006B68', line = '#CBD5DA';
const T = ({ x = 112, y, size = 36, weight = 400, color = ink, children }: { x?: number; y: number; size?: number; weight?: number; color?: string; children: ReactNode }) =>
  <text x={x} y={y} fontSize={size} fontWeight={weight} fill={color}>{children}</text>;
function Frame({ page, title, description, children }: { page: number; title: string; description: string; children: ReactNode }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" fontFamily="IBM Plex Sans" role="img" aria-label={`${title}. ${description}`} data-page={page}>
    <rect width="1920" height="1080" fill="#FFFFFF" />
    <T y={151} size={66} weight={600}>{title}</T>
    {children}
    <T x={1760} y={1014} size={28} color={muted}>{page} / 3</T>
  </svg>;
}
const Gate = () => <Frame page={1} title="Waymark’s reranker clears the trial gate" description="Synthetic illustrative results, not an executed benchmark. Baseline passes 59 of 80 queries, 73.75%, with p95 420 milliseconds. Reranker passes 67 of 80, 83.75%, with p95 760 milliseconds. Gate: at least 80% passing and p95 at most 800 milliseconds. Only the reranker meets both; a limited trial is justified, not a full rollout.">
  <T y={225} color={muted}>Synthetic, hand-authored results • one illustrative evaluation pass</T>
  <T y={340} size={32} weight={500}>Proposed limited-trial gate</T>
  <T y={405} size={45} weight={500}>≥80% passing queries overall  +  p95 ≤800 ms</T>
  <line x1={112} y1={468} x2={1808} y2={468} stroke={line} strokeWidth={2} />
  <T x={790} y={522} size={30} color={muted}>Passing queries</T>
  <T x={1250} y={522} size={30} color={muted}>p95 latency</T>
  <T x={1580} y={522} size={30} color={muted}>Both gates</T>
  <T y={610} size={40} weight={500}>Baseline</T>
  <T x={790} y={610} size={40}>59/80 · 73.75%</T>
  <T x={1250} y={610} size={40}>420 ms</T>
  <T x={1580} y={610} size={36}>No</T>
  <line x1={112} y1={655} x2={1808} y2={655} stroke={line} />
  <T y={740} size={40} weight={600} color={accent}>Retrieval + reranker</T>
  <T x={790} y={740} size={40} weight={600} color={accent}>67/80 · 83.75%</T>
  <T x={1250} y={740} size={40} weight={600} color={accent}>760 ms</T>
  <T x={1580} y={740} size={36} weight={600} color={accent}>Yes</T>
  <line x1={112} y1={790} x2={1808} y2={790} stroke={line} strokeWidth={2} />
  <T y={883} size={40} weight={500}>Proceed to a limited live trial, not a full rollout.</T>
  <T y={941} size={32} color={muted}>The reranker has 3.75 percentage points of quality headroom and only 40 ms at p95.</T>
</Frame>;

const Tradeoff = () => <Frame page={2} title="Multi-part retrieval gains most; latency rises" description="Direct lookups: baseline 44 of 50, 88%; reranker 46 of 50, 92%, plus 4 percentage points. Multi-part questions: baseline 15 of 30, 50%; reranker 21 of 30, 70%, plus 20 points. Median latency rises from 180 to 310 milliseconds; p95 from 420 to 760. Same document snapshot and same 80 queries. A pass means at least one reviewer-labeled relevant document in the top five, not a correct or complete generated answer.">
  <T y={225} color={muted}>Same document snapshot and 80 queries: 50 direct lookups, 30 multi-part questions.</T>
  <T y={325} size={32} weight={500}>Queries passing (%)</T>
  <T x={740} y={325} size={28} color={muted}>Baseline</T>
  <T x={960} y={325} size={28} color={accent}>Reranker</T>
  {[0, 50, 100].map(v => <g key={v}><line x1={380 + v * 7} y1={358} x2={380 + v * 7} y2={706} stroke={line} /><T x={365 + v * 7} y={752} size={26} color={muted}>{v}</T></g>)}
  <T y={425} size={32} weight={500}>Direct lookups</T>
  <rect x={380} y={382} width={616} height={40} fill={muted} />
  <rect x={380} y={445} width={644} height={40} fill={accent} />
  <T x={1045} y={413} size={28}>44/50 · 88%</T>
  <T x={1045} y={477} size={28} color={accent}>46/50 · 92%</T>
  <T y={626} size={32} weight={500}>Multi-part</T>
  <rect x={380} y={581} width={350} height={40} fill={muted} />
  <rect x={380} y={644} width={490} height={40} fill={accent} />
  <T x={755} y={613} size={28}>15/30 · 50%</T>
  <T x={895} y={677} size={28} color={accent}>21/30 · 70%</T>
  <T x={1360} y={325} size={32} weight={500}>End-to-end latency</T>
  <T x={1360} y={411} size={30} color={muted}>Baseline / reranker</T>
  <T x={1360} y={479} size={39} weight={500}>180 / 310 ms</T>
  <T x={1360} y={531} size={30} color={muted}>Median · +130 ms</T>
  <T x={1360} y={654} size={39} weight={500}>420 / 760 ms</T>
  <T x={1360} y={706} size={30} color={muted}>p95 · +340 ms</T>
  <T y={830} size={37} weight={500}>+4 points on lookups; +20 on multi-part questions.</T>
  <T y={881} size={30} color={muted}>Multi-part questions require several pieces of information.</T>
  <T y={925} size={30} color={muted}>Pass = at least one reviewer-labeled relevant document in the top five results.</T>
  <T y={969} size={30} color={muted}>Measures retrieval, not generated-answer correctness or completeness. Synthetic results.</T>
</Frame>;

const Trial = () => <Frame page={3} title="Use the live trial to test what offline cannot" description="Recommended next step: limit reranker exposure and retain baseline comparison. Evaluate the live query mix, repeated tail latency, and individual query regressions before expanding. Aggregate counts do not identify improved or regressed queries. Per-query outcomes, repeated timings, costs, and reviewer agreement are unavailable; the small hand-authored offline set cannot establish production performance or rollout readiness.">
  <T y={231} size={38} color={accent} weight={500}>Limit reranker exposure and retain a baseline comparison.</T>
  <T y={331} size={30} color={muted}>Unknown in this offline set</T>
  <T x={860} y={331} size={30} color={muted}>Evidence to collect before expanding</T>
  <line x1={112} y1={370} x2={1808} y2={370} stroke={line} strokeWidth={2} />
  <T y={435} size={37} weight={500}>Production query mix</T>
  <T x={860} y={435} size={34}>Measure passing rates by live query category.</T>
  <T y={486} size={30} color={muted}>80 hand-authored queries may not represent traffic.</T>
  <T x={860} y={486} size={30} color={muted}>Check whether the overall ≥80% result holds.</T>
  <line x1={112} y1={529} x2={1808} y2={529} stroke={line} />
  <T y={594} size={37} weight={500}>Tail-latency stability</T>
  <T x={860} y={594} size={34}>Repeat end-to-end timings under live load.</T>
  <T y={645} size={30} color={muted}>One pass gives no variability estimate.</T>
  <T x={860} y={645} size={30} color={muted}>Check p95 ≤800 ms; current headroom is 40 ms.</T>
  <line x1={112} y1={688} x2={1808} y2={688} stroke={line} />
  <T y={753} size={37} weight={500}>Individual regressions</T>
  <T x={860} y={753} size={34}>Review paired outcomes for each query.</T>
  <T y={804} size={30} color={muted}>Aggregate gains can hide newly failing queries.</T>
  <T x={860} y={804} size={30} color={muted}>Identify which queries improve or regress.</T>
  <line x1={112} y1={849} x2={1808} y2={849} stroke={line} strokeWidth={2} />
  <T y={920} size={30} color={muted}>Also unavailable: costs and reviewer agreement. Collect both before a rollout decision.</T>
  <T y={964} size={30} color={muted}>These synthetic results establish neither production performance nor rollout readiness.</T>
</Frame>;

export const meta = { title: 'Waymark: evaluating a reranker', createdAt: '2026-09-12T14:20:00Z' };
export const notes = [
  'Decision: 59/80 baseline and 67/80 reranker. Only reranker satisfies both proposed gates. All supplied results are synthetic.',
  'Bars share a 0–100% scale. Net category count changes do not identify individual query transitions.',
  'Live-trial evidence collection is a recommendation, not a supplied operational trial design. No sample size, exposure fraction or duration was specified.',
];
export default [Gate, Tradeoff, Trial];
