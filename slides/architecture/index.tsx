import type { ReactNode } from 'react';
import '../../lib/typeface.ts';

const ink = '#172633', muted = '#4D5D6B', accent = '#006EAC', line = '#A7B2BC';
function Text({ x, y, children, size = 34, weight = 400, color = ink }: { x: number; y: number; children: ReactNode; size?: number; weight?: number; color?: string }) {
  return <text x={x} y={y} fontSize={size} fontWeight={weight} fill={color}>{children}</text>;
}
function Arrow({ x1, x2, y, dashed = false }: { x1: number; x2: number; y: number; dashed?: boolean }) {
  const d = x2 > x1 ? -16 : 16;
  return <g fill="none" stroke={accent} strokeWidth={3}><path d={`M${x1} ${y} H${x2}`} strokeDasharray={dashed ? '10 8' : undefined}/><path d={`M${x2 + d} ${y - 10} L${x2} ${y} L${x2 + d} ${y + 10}`}/></g>;
}
function Frame({ title, description, page, children }: { title: string; description: string; page: number; children: ReactNode }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" fontFamily="IBM Plex Sans, sans-serif" role="img" aria-label={`${title}. ${description}`}>
    <rect width={1920} height={1080} fill="#FFFFFF"/>
    <Text x={112} y={150} size={64} weight={600}>{title}</Text>
    {children}
    <Text x={1760} y={1018} size={26} color={muted}>{page} / 3</Text>
  </svg>;
}
function Acceptance() {
  return <Frame page={1} title="Parcel Relay accepts an event after commit" description="Fictional service. Producer submits an event ID to the API. The API saves event and job in one database transaction. Accepted follows commit; commit failure returns an error, so the event was not accepted. Workers claim leased jobs from the database and POST to customer endpoints with the event ID. No separate broker.">
    <Text x={112} y={224} color={muted}>A fictional webhook service • the database holds both events and the job queue</Text>
    <Text x={160} y={365} size={40} weight={600}>Producer</Text>
    <Text x={548} y={365} size={40} weight={600}>API</Text>
    <path d="M250 390 V635 M580 390 V635" fill="none" stroke={line} strokeWidth={2}/>
    <rect x={965} y={294} width={835} height={280} rx={8} fill="#FFFFFF" stroke={line} strokeWidth={2}/>
    <Text x={1005} y={355} size={40} weight={600}>Database</Text>
    <Text x={1005} y={423}>Event + delivery job</Text>
    <Text x={1005} y={479} color={accent} weight={500}>Saved in one transaction</Text>
    <Text x={1005} y={531} size={30} color={muted}>Commit is the acceptance boundary.</Text>
    <Arrow x1={250} x2={580} y={415}/>
    <Text x={280} y={397} size={30}>Submit event ID</Text>
    <Arrow x1={580} x2={965} y={415}/>
    <Text x={690} y={391} size={30}>Save both</Text>
    <Arrow x1={965} x2={580} y={515}/>
    <Text x={680} y={563} size={30}>Commit succeeds</Text>
    <Arrow x1={580} x2={250} y={610}/>
    <Text x={236} y={660} color={accent} weight={500}>Return Accepted</Text>
    <path d="M1120 704 V574 M1110 590 L1120 574 L1130 590" fill="none" stroke={accent} strokeWidth={3}/>
    <Text x={1160} y={644} size={30}>Claim leased job</Text>
    <Text x={112} y={797} size={40} weight={600}>If commit fails</Text>
    <Text x={112} y={855}>API returns an error.</Text>
    <Text x={112} y={907}>The event has not been accepted.</Text>
    <Text x={1020} y={738} size={40} weight={600}>Worker</Text>
    <path d="M1120 756 V844" fill="none" stroke={accent} strokeWidth={3}/>
    <Arrow x1={1120} x2={1550} y={844}/>
    <Text x={1160} y={891} size={30}>POST + event ID</Text>
    <Text x={1555} y={817} size={38} weight={600}>Customer</Text>
    <Text x={1555} y={869} size={30}>endpoint</Text>
  </Frame>;
}
function Outcomes() {
  return <Frame page={2} title="The response decides the job’s next state" description="2xx marks delivered. Timeout or 5xx schedules another attempt, up to three attempts total. The third unsuccessful attempt marks failed for human investigation. 4xx is terminal. If a worker crashes, another may claim the unfinished job after lease expiry even if the customer already received it.">
    <Text x={112} y={228} color={muted}>After each POST, the worker records the outcome in the database.</Text>
    <Text x={112} y={346} size={30} color={muted}>OBSERVED RESULT</Text>
    <Text x={660} y={346} size={30} color={muted}>WHAT RELAY DOES</Text>
    {[380, 490, 660, 780].map(y => <line key={y} x1={112} x2={1808} y1={y} y2={y} stroke={line} strokeWidth={2}/>)}
    <Text x={112} y={447} size={40} weight={600}>2xx</Text>
    <Text x={660} y={447} size={38}>Marks the job delivered.</Text>
    <Text x={112} y={555} size={40} weight={600}>Timeout or 5xx</Text>
    <Text x={660} y={552} size={38}>Schedules another attempt; three attempts total.</Text>
    <Text x={660} y={609} size={32} color={muted}>Third unsuccessful attempt: failed, for human investigation.</Text>
    <Text x={112} y={731} size={40} weight={600}>4xx</Text>
    <Text x={660} y={731} size={38}>Terminal in this example.</Text>
    <Text x={112} y={865} size={38} weight={600}>A worker crash can also repeat a request</Text>
    <Text x={112} y={925} size={34}>After lease expiry, another worker can claim the unfinished job,</Text>
    <Text x={112} y={975} size={34}>even if the customer already received the earlier request.</Text>
  </Frame>;
}
function Duplicate() {
  return <Frame page={3} title="A timeout can hide a completed update" description="evt-204 reaches the customer and applies its update, but the response is lost. Relay times out and retries the same event ID. The customer recognizes evt-204 and skips the repeated update. This deduplication depends on the customer implementation. Relay cannot enforce it, make customer side effects atomic, or guarantee exactly-once delivery.">
    <Text x={112} y={224} color={muted}>The same event ID connects both requests: evt-204.</Text>
    <Text x={260} y={334} size={40} weight={600}>Relay worker</Text>
    <Text x={1130} y={334} size={40} weight={600}>Customer endpoint</Text>
    <line x1={380} x2={380} y1={367} y2={785} stroke={line} strokeWidth={2}/>
    <line x1={1260} x2={1260} y1={367} y2={785} stroke={line} strokeWidth={2}/>
    <Arrow x1={380} x2={1260} y={432}/>
    <Text x={610} y={406} size={32}>POST evt-204</Text>
    <Text x={1310} y={445} size={34} weight={500}>Applies update</Text>
    <path d="M1260 525 H760" fill="none" stroke={accent} strokeWidth={3} strokeDasharray="10 8"/>
    <path d="M746 511 L774 539 M774 511 L746 539" stroke={accent} strokeWidth={3}/>
    <Text x={835} y={504} size={32}>Response lost</Text>
    <Text x={112} y={561} size={32}>Times out</Text>
    <Text x={112} y={603} size={30} color={muted}>Outcome unknown</Text>
    <Arrow x1={380} x2={1260} y={663}/>
    <Text x={610} y={637} size={32}>Retry POST evt-204</Text>
    <Text x={1310} y={672} size={34} weight={500}>Recognizes evt-204</Text>
    <Text x={1310} y={720} size={34} color={accent} weight={500}>Skips repeated update</Text>
    <Text x={112} y={861} size={40} weight={600}>Customers must handle repeated event IDs.</Text>
    <Text x={112} y={924} size={34}>The skip above depends on customer code; Relay does not enforce it.</Text>
    <Text x={112} y={974} size={34}>Relay cannot make customer side effects atomic or guarantee exactly-once delivery.</Text>
  </Frame>;
}

export const meta = { title: 'Parcel Relay', createdAt: '2026-09-12T14:14:00Z' };
export const notes = [
  'Audience question: When is an event accepted, and where does the job live? The connector from the database to the worker denotes job ownership, not a separate message broker.',
  'Audience question: What happens after a delivery attempt, or a worker crash? No backoff duration or lease duration is specified by the fictional brief.',
  'Audience question: Why did evt-204 repeat, and who prevents duplicate side effects? The customer deduplication outcome is an example, not a guarantee supplied by Relay.',
];
const pages = [Acceptance, Outcomes, Duplicate];
export default pages;
