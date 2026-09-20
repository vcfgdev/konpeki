import type { ReactNode } from 'react';
import '../../lib/typeface.ts';

const ink = '#172B3A';
const muted = '#495D6C';
const accent = '#006B75';
const line = '#A8B6BE';

function Text({ x, y, children, size = 34, weight = 400, color = ink, anchor = 'start' }: {
  x: number; y: number; children: ReactNode; size?: number; weight?: number; color?: string;
  anchor?: 'start' | 'middle' | 'end';
}) {
  return <text x={x} y={y} fontSize={size} fontWeight={weight} fill={color} textAnchor={anchor}>{children}</text>;
}

function Frame({ page, title, description, children }: { page: number; title: string; description: string; children: ReactNode }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"
    fontFamily="IBM Plex Sans" role="img" aria-labelledby={`title-${page} desc-${page}`}>
    <title id={`title-${page}`}>{title}</title><desc id={`desc-${page}`}>{description}</desc>
    <rect width="1920" height="1080" fill="#FFFFFF" />
    <Text x={100} y={140} size={66} weight={600}>{title}</Text>
    {children}
    <Text x={1820} y={1024} size={28} color={muted} anchor="end">{page} / 4</Text>
  </svg>;
}

function Arrow({ from, to, y, label, detail }: { from: number; to: number; y: number; label: string; detail?: string }) {
  const sign = to > from ? 1 : -1;
  return <g>
    <Text x={(from + to) / 2} y={y - (detail ? 55 : 20)} anchor="middle" size={32} weight={500}>{label}</Text>
    {detail && <Text x={(from + to) / 2} y={y - 17} anchor="middle" size={30} color={muted}>{detail}</Text>}
    <path d={`M${from} ${y} H${to} M${to - sign * 16} ${y - 10} L${to} ${y} L${to - sign * 16} ${y + 10}`}
      fill="none" stroke={accent} strokeWidth={3} strokeLinejoin="round" />
  </g>;
}

function Lanes({ middle = 'Server + database', bottom = 795 }: { middle?: string; bottom?: number }) {
  return <g>{[[200, 'Leena'], [960, middle], [1720, 'Omar']].map(([x, label]) => <g key={label}>
    <Text x={Number(x)} y={280} size={36} weight={600} anchor="middle">{label}</Text>
    <line x1={Number(x)} x2={Number(x)} y1={303} y2={bottom} stroke={line} strokeWidth={2} strokeDasharray="6 8" />
  </g>)}</g>;
}

function State({ y, children }: { y: number; children: ReactNode }) {
  return <g><rect x={650} y={y - 33} width={620} height={50} fill="#FFFFFF" stroke={accent} strokeWidth={2} />
    <Text x={960} y={y} size={30} weight={500} anchor="middle" color={accent}>{children}</Text></g>;
}

const LostUpdate = () => <Frame page={1} title="A stale save can erase someone else’s edit"
  description="Folio is fictional. Document 42 initially stores Launch notes, revision 7. Leena and Omar both read it. Leena drafts Launch checklist; Omar drafts Release notes. With unconditional updates, Leena saves first and Omar saves second, silently replacing Leena's title. Revisions alone cannot protect a write that does not check them.">
  <Text x={100} y={219} color={muted}>Folio · fictional document editor · document 42</Text>
  <Text x={100} y={333} size={36} weight={600}>Both read before either saves</Text>
  <Text x={100} y={405} size={48}>“Launch notes”</Text>
  <Text x={100} y={462} color={accent} weight={500}>Stored revision 7</Text>
  <Text x={870} y={333} size={36} weight={600}>Leena’s draft</Text>
  <Text x={870} y={395} size={40}>“Launch checklist”</Text>
  <Text x={1430} y={333} size={36} weight={600}>Omar’s draft</Text>
  <Text x={1430} y={395} size={40}>“Release notes”</Text>
  <Text x={100} y={591} size={36} weight={600}>Without a revision condition</Text>
  <line x1={100} x2={1820} y1={630} y2={630} stroke={line} strokeWidth={2} />
  <Text x={100} y={697} weight={500}>1. Leena saves</Text>
  <Text x={670} y={697}>Stored title becomes “Launch checklist”.</Text>
  <line x1={100} x2={1820} y1={737} y2={737} stroke={line} strokeWidth={2} />
  <Text x={100} y={807} weight={500}>2. Omar saves stale draft</Text>
  <Text x={670} y={807}>Stored title becomes “Release notes”.</Text>
  <line x1={100} x2={1820} y1={847} y2={847} stroke={line} strokeWidth={2} />
  <Text x={100} y={939} size={40} color={accent} weight={500}>Leena’s title is lost. Both saves can appear successful.</Text>
</Frame>;

const Atomic = () => <Frame page={2} title="Make the revision check and write atomic"
  description="Time flows down. Both clients read revision 7. Leena sends Launch checklist with expected revision 7. The database atomically matches document 42 and revision 7, writes the title and increments to 8. One row changes, so the server reports success. Omar sends Release notes expecting 7. Zero rows change, so the server returns HTTP 409 Conflict and preserves Launch checklist at revision 8. Every title writer must follow the contract, revisions are never reused even after restoration, and no deletion is assumed.">
  <Text x={100} y={212} size={32} color={muted}>One database action: match ID + expected revision → write title + increment revision</Text>
  <Lanes />
  <Arrow from={200} to={960} y={378} label="Save “Launch checklist”" detail="document 42 · expected revision 7" />
  <State y={423}>1 row changed · “Launch checklist” · rev 8</State>
  <Arrow from={960} to={200} y={500} label="Success: one row changed" />
  <Arrow from={1720} to={960} y={608} label="Save “Release notes”" detail="document 42 · expected revision 7" />
  <State y={653}>0 rows changed · “Launch checklist” · rev 8</State>
  <Arrow from={960} to={1720} y={774} label="HTTP 409 Conflict" detail="Expected 7 no longer matches stored 8" />
  <Text x={100} y={863} size={36} weight={600}>Success means exactly one row changed.</Text>
  <Text x={100} y={920} size={30}>All writers use this contract; revisions are never reused, even after restoration. Assume no deletion.</Text>
  <Text x={100} y={969} size={30} color={muted}>Prevents silent lost updates; does not merge edits, choose a better title or make multi-document changes atomic.</Text>
</Frame>;

const Race = () => <Frame page={3} title="Separate checks leave a race between writes"
  description="Counterexample; time flows down. Stored revision begins at 7. Leena's separate check reads revision 7 and passes. Omar's separate check also reads 7 and passes before any write. Leena then writes Launch checklist unconditionally and increments to revision 8. Omar writes Release notes unconditionally and increments to revision 9, replacing Leena's edit. The illustrated writes increment the current stored revision but do not condition the write on it. Both checks passed; only an atomic database condition closes the race.">
  <Text x={100} y={212} size={32} color={muted}>Counterexample · stored revision starts at 7 · time flows downward</Text>
  <Lanes bottom={821} />
  <Arrow from={200} to={960} y={374} label="Check expected 7" detail="Read stored 7 → passes" />
  <Arrow from={1720} to={960} y={481} label="Check expected 7" detail="Read stored 7 → passes" />
  <Arrow from={200} to={960} y={601} label="Write “Launch checklist”" detail="Unconditional write + increment" />
  <State y={646}>“Launch checklist” · rev 8</State>
  <Arrow from={1720} to={960} y={761} label="Write “Release notes”" detail="Unconditional write + increment" />
  <State y={806}>“Release notes” · rev 9 · Leena’s edit lost</State>
  <Text x={100} y={904} size={38} weight={500} color={accent}>Both checks passed. Neither constrained the later write.</Text>
  <Text x={100} y={963} size={30} color={muted}>This example increments the stored revision on each write; the missing atomic condition causes the loss.</Text>
</Frame>;

const Recovery = () => <Frame page={4} title="After a conflict, let Omar choose what to save"
  description="On HTTP 409, fetch the current document and show both versions: current Launch checklist at revision 8, and Omar's Release notes. Keep means leave Launch checklist unchanged with no write. Revise means edit a new title using both versions. Replace means deliberately save Release notes. Any new save must use the newly fetched revision, here 8, and can conflict again. Never silently retry Omar's stale title with revision 8. Under the contract this prevents silent lost updates, but does not merge edits, choose the better title, or make multi-document changes atomic. If a successful response is lost, retrying the old revision can conflict despite the first save succeeding; revision checks alone provide neither request deduplication nor exactly-once acknowledgement.">
  <Text x={100} y={224} size={34}>Fetch the current document and show both titles before any new save.</Text>
  <Text x={100} y={334} size={32} weight={600}>Current · revision 8</Text>
  <Text x={100} y={391} size={41} color={accent}>“Launch checklist”</Text>
  <Text x={1030} y={334} size={32} weight={600}>Omar’s draft</Text>
  <Text x={1030} y={391} size={41}>“Release notes”</Text>
  <line x1={100} x2={1820} y1={437} y2={437} stroke={line} strokeWidth={2} />
  <Text x={100} y={502} weight={600}>Keep</Text>
  <Text x={550} y={502} size={36}>Leave “Launch checklist” unchanged. No new save.</Text>
  <line x1={100} x2={1820} y1={540} y2={540} stroke={line} strokeWidth={2} />
  <Text x={100} y={604} weight={600}>Revise</Text>
  <Text x={550} y={604} size={36}>Edit a new title using both versions, then save it.</Text>
  <line x1={100} x2={1820} y1={642} y2={642} stroke={line} strokeWidth={2} />
  <Text x={100} y={706} weight={600}>Replace</Text>
  <Text x={550} y={706} size={36}>Deliberately save “Release notes” over the current title.</Text>
  <line x1={100} x2={1820} y1={744} y2={744} stroke={line} strokeWidth={2} />
  <Text x={100} y={810} size={36} weight={500} color={accent}>A deliberate new save uses the fetched revision, here 8. It can conflict again.</Text>
  <Text x={100} y={865} size={32}>Never silently retry Omar’s stale title with revision 8.</Text>
  <Text x={100} y={937} size={30} color={muted}>If a successful reply is lost, retrying the old revision may conflict even though the save succeeded.</Text>
  <Text x={100} y={979} size={30} color={muted}>Revision checks alone provide neither request deduplication nor exactly-once acknowledgement.</Text>
</Frame>;

export const meta = { title: 'Folio — optimistic concurrency' };
const pages = [LostUpdate, Atomic, Race, Recovery];
export default pages;
