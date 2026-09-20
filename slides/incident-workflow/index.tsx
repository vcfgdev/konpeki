import type { ReactNode } from 'react';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-600.css';

const ink = '#152B39', muted = '#465D6B', accent = '#006B75';
function Copy({ x = 112, y, lines, size = 34, color = ink, weight = 400 }: {
  x?: number; y: number; lines: string[]; size?: number; color?: string; weight?: number;
}) {
  return <text x={x} y={y} fill={color} fontSize={size} fontWeight={weight}>
    {lines.map((s, i) => <tspan key={i} x={x} dy={i ? size * 1.32 : 0}>{s}</tspan>)}
  </text>;
}
function Frame({ title, description, page, children }: { title: string; description: string; page: number; children: ReactNode }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" fontFamily="IBM Plex Sans" role="img" aria-labelledby={`title-${page} desc-${page}`}>
    <title id={`title-${page}`}>{title}</title><desc id={`desc-${page}`}>{description}</desc>
    <rect width="1920" height="1080" fill="#FFFFFF" />
    <Copy y={135} lines={[title]} size={64} weight={600} />
    {children}
    <Copy x={1760} y={1025} lines={[`${page} / 3`]} size={26} color={muted} />
  </svg>;
}

const Diagnosis = () => <Frame page={1} title="The release outpaced the connection pool" description="Fictional Lantern incident, 18 August 2026, UTC. API accepts events into a durable queue; workers deliver to customer webhook endpoints. Concurrency rose from 20 to 80 per worker at 09:00 while the pool stayed at 20. At 09:05 oldest pending age was six minutes and queue depth 18,000. At 09:08 API acceptance was healthy, CPU below 50%, outbound timeouts increased. At 09:12 steady traffic, widespread endpoint timeouts and traces waiting for connections support a worker-side bottleneck rather than traffic surge or independent customer failures. Not yet reproduced under controlled load.">
  <Copy y={202} lines={['Lantern · fictional incident · 18 August 2026 · all times UTC']} size={28} color={muted} />
  <Copy y={290} lines={['API accepts events']} weight={600} />
  <Copy x={630} y={290} lines={['Durable queue']} weight={600} />
  <Copy x={1150} y={290} lines={['Workers deliver to webhooks']} weight={600} />
  <path d="M435 278 H578 M564 266 L578 278 L564 290 M910 278 H1098 M1084 266 L1098 278 L1084 290" stroke={accent} strokeWidth="3" fill="none" />
  <Copy y={350} lines={['Objective: 99% of accepted events get a successful endpoint response within five minutes.']} size={31} color={muted} />
  <Copy y={447} lines={['09:00  Release']} size={36} weight={600} color={accent} />
  <Copy y={502} lines={['Concurrency per worker: 20 → 80', 'Worker count and incoming volume unchanged.']} size={32} />
  <Copy y={630} lines={['09:05–09:08  Symptoms']} size={36} weight={600} color={accent} />
  <Copy y={685} lines={['18,000 queued events; oldest waiting 6 min.', 'API acceptance healthy; worker CPU <50%.', 'Outbound requests timed out more often.']} size={32} />
  <Copy x={970} y={447} lines={['09:12  Test the three explanations']} size={36} weight={600} color={accent} />
  <Copy x={970} y={510} lines={['Traffic surge?  Volume matched pre-release.', 'Endpoint failures?  Many unrelated endpoints.', 'Worker bottleneck?  Traces waited for a', 'connection; each pool still had only 20.']} size={32} />
  <Copy x={970} y={737} lines={['Supported diagnosis: concurrency / pool mismatch.', 'The evidence points to shared worker capacity.']} size={31} weight={600} />
  <Copy x={970} y={853} lines={['The failure has not yet been reproduced', 'in a controlled test.']} size={29} color={muted} />
  <Copy y={925} lines={['Queue age = time the oldest', 'pending event has waited.']} size={29} color={muted} />
</Frame>;

const Mitigation = () => <Frame page={2} title="Rollback relieved waits before the backlog cleared" description="At 09:15 the team rolled concurrency back to 20, without purging the queue or replaying completed jobs. At 09:20 connection waits and timeout rates were back to pre-release levels, but 24,000 events remained queued, down from a peak of 30,000, and oldest pending age was 14 minutes. At 09:40 queue depth was in its usual 0–500 range and oldest age 40 seconds. Recovery after rollback strengthens the diagnosis but does not replace controlled reproduction.">
  <Copy y={208} lines={['Operational sequence · all times UTC · fictional incident']} size={28} color={muted} />
  <Copy y={340} lines={['09:15']} size={72} color={accent} weight={600} />
  <Copy y={410} lines={['Mitigate the mismatch']} size={37} weight={600} />
  <Copy y={478} lines={['Roll concurrency back to 20.', 'Keep the durable queue intact.', 'Do not replay completed jobs.']} size={33} />
  <Copy y={685} lines={['Why this intervention?']} size={32} weight={600} />
  <Copy y={738} lines={['Match concurrent deliveries', 'to the existing 20-connection', 'pool rather than add pressure.']} size={32} />
  <Copy x={760} y={340} lines={['09:20']} size={72} color={accent} weight={600} />
  <Copy x={760} y={410} lines={['Transport stabilizes']} size={37} weight={600} />
  <Copy x={760} y={478} lines={['Connection waits and timeout', 'rates return to pre-release levels.']} size={33} />
  <Copy x={760} y={635} lines={['24,000 events remain']} size={40} weight={600} />
  <Copy x={760} y={695} lines={['Down from a peak of 30,000.', 'Oldest pending age: 14 min.', 'The backlog is still draining.']} size={32} />
  <Copy x={1340} y={340} lines={['09:40']} size={72} color={accent} weight={600} />
  <Copy x={1340} y={410} lines={['Queue normalizes']} size={37} weight={600} />
  <Copy x={1340} y={478} lines={['Depth returns to its usual', 'range of 0–500 events.']} size={33} />
  <Copy x={1340} y={635} lines={['40 seconds']} size={40} weight={600} />
  <Copy x={1340} y={695} lines={['Oldest pending event age.', 'Confirm backlog recovery', 'separately from timeouts.']} size={32} />
  <Copy y={935} lines={['Recovery after rollback strengthens the diagnosis; controlled reproduction is still needed.']} size={31} color={muted} />
</Frame>;

const Recovery = () => <Frame page={3} title="Recovery is a measured window, not a clean slate" description="At 10:10 UTC, 99.3% of newly accepted events over the preceding 30 minutes received a successful endpoint response within five minutes, exceeding the 99% objective for that cohort. It does not erase the incident delivery-objective breach. No data loss observed, but event-by-event audit incomplete. Next: reproduce mismatch under load, validate concurrency and pool settings together before release, and add connection-wait time to the rollout dashboard.">
  <Copy y={208} lines={['10:10 UTC check · fictional incident']} size={28} color={muted} />
  <Copy y={385} lines={['99.3%']} size={132} color={accent} weight={600} />
  <Copy y={466} lines={['of newly accepted events']} size={42} weight={600} />
  <Copy y={533} lines={['received a successful endpoint response', 'within five minutes in the preceding', '30 minutes (09:40–10:10 UTC).']} size={34} />
  <Copy y={730} lines={['Objective: 99% within five minutes.']} size={33} weight={600} />
  <Copy y={794} lines={['This cohort met the objective. The incident’s', 'delivery-objective breach still happened.']} size={33} />
  <Copy x={1050} y={330} lines={['Close the evidence gaps']} size={43} weight={600} />
  <Copy x={1050} y={420} lines={['Reproduce the mismatch under load.']} size={34} weight={600} />
  <Copy x={1050} y={473} lines={['Test the supported cause in a controlled run.']} size={31} color={muted} />
  <Copy x={1050} y={575} lines={['Validate both settings before release.']} size={34} weight={600} />
  <Copy x={1050} y={628} lines={['Check concurrency and pool capacity together.']} size={31} color={muted} />
  <Copy x={1050} y={730} lines={['Expose connection-wait time.']} size={34} weight={600} />
  <Copy x={1050} y={783} lines={['Add the signal to the rollout dashboard.']} size={31} color={muted} />
  <Copy y={957} lines={['No data loss was observed; an event-by-event delivery audit is not yet complete.']} size={31} color={muted} />
</Frame>;

export default [Diagnosis, Mitigation, Recovery];
