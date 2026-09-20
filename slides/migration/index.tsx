import type { ReactNode } from 'react';
import '../../lib/typeface.ts';

const ink = '#172D32', muted = '#4A6065', accent = '#00796B', line = '#CDD8D8';
function Copy({ x, y, lines, size = 36, color = ink, weight = 400 }: {
  x: number; y: number; lines: string[]; size?: number; color?: string; weight?: number;
}) {
  return <text x={x} y={y} fontSize={size} fill={color} fontWeight={weight} aria-label={lines.join(' ')}>
    {lines.map((text, i) => <tspan key={i} x={x} dy={i ? size * 1.3 : 0}>{text}</tspan>)}
  </text>;
}
function Frame({ number, title, description, children }: {
  number: number; title: string; description: string; children: ReactNode;
}) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"
    fontFamily="IBM Plex Sans" role="img" aria-labelledby={`title-${number} desc-${number}`} data-page={number}>
    <title id={`title-${number}`}>{title}</title><desc id={`desc-${number}`}>{description}</desc>
    <rect width="1920" height="1080" fill="#FFFFFF" />
    <Copy x={100} y={145} lines={[title]} size={64} weight={600} />
    {children}
    <Copy x={1710} y={1026} lines={[`${number} / 3`]} size={28} color={muted} />
  </svg>;
}
function Coexistence() {
  return <Frame number={1} title="Keep full_name authoritative during rollout"
    description="Juniper renames full_name to display_name without changing values or the public API. Add a nullable column, then deploy the bridge. Old applications read and write full_name only. The bridge reads full_name and writes both columns in one transaction. While old writers coexist, display_name is not authoritative. All reads and writes use one primary database.">
    <Copy x={100} y={230} lines={['Rename full_name → display_name. Stored values and the public API stay unchanged.']} size={34} color={muted} />
    <Copy x={100} y={280} lines={['Juniper · Fictional migration example']} size={28} color={muted} />
    <Copy x={100} y={340} lines={['Add nullable display_name, then deploy the bridge.']} size={40} weight={500} color={accent} />
    <Copy x={100} y={450} lines={['Running version']} size={30} color={muted} />
    <Copy x={690} y={450} lines={['Reads']} size={30} color={muted} />
    <Copy x={1170} y={450} lines={['Writes']} size={30} color={muted} />
    <line x1={100} x2={1820} y1={480} y2={480} stroke={line} strokeWidth={2} />
    <Copy x={100} y={552} lines={['Old application']} size={40} weight={500} />
    <Copy x={690} y={552} lines={['full_name']} size={40} />
    <Copy x={1170} y={552} lines={['full_name only']} size={40} />
    <line x1={100} x2={1820} y1={595} y2={595} stroke={line} />
    <Copy x={100} y={666} lines={['Bridge version']} size={40} weight={500} />
    <Copy x={690} y={666} lines={['full_name']} size={40} />
    <Copy x={1170} y={666} lines={['full_name + display_name']} size={36} />
    <Copy x={1170} y={720} lines={['In the same transaction']} size={30} color={accent} />
    <Copy x={100} y={825} lines={['Old writers can leave display_name stale.']} size={44} weight={500} color={accent} />
    <Copy x={100} y={887} lines={['Do not switch reads yet. All application traffic uses one primary database.']} size={34} color={muted} />
  </Frame>;
}
function Reconcile() {
  return <Frame number={2} title="Gate the read switch on zero differences"
    description="First drain all old writers and their in-flight transactions. Then backfill in immutable numeric primary-key batches with database UPDATEs copying current full_name to display_name wherever they differ, including null differences. Row locks protect affected rows; no application-memory read and write-back. Bridge writes continue. Only after completion and a full-table comparison finding zero differences may reads switch; keep dual writes.">
    <Copy x={100} y={230} lines={['Bridge writes continue while the database reconciles current values.']} size={36} color={muted} />
    <line x1={955} x2={955} y1={315} y2={905} stroke={line} strokeWidth={2} />
    <Copy x={100} y={355} lines={['1  Drain old writers']} size={44} weight={500} color={accent} />
    <Copy x={155} y={417} lines={['Wait for every old writer and its', 'in-flight transactions to finish.']} />
    <Copy x={100} y={555} lines={['2  Backfill in primary-key batches']} size={40} weight={500} color={accent} />
    <Copy x={155} y={617} lines={['Use the immutable numeric key.', 'Finish every batch before validation.']} />
    <Copy x={100} y={755} lines={['3  Compare the full table']} size={44} weight={500} color={accent} />
    <Copy x={155} y={817} lines={['Require zero differences.', 'Then switch reads; keep dual writes.']} />
    <Copy x={1040} y={355} lines={['Inside each database UPDATE']} size={40} weight={500} />
    <Copy x={1040} y={440} lines={['Current full_name → display_name', 'Only where values differ,', 'including null differences.']} size={36} />
    <Copy x={1040} y={635} lines={['Updates lock the affected rows.']} size={36} weight={500} />
    <Copy x={1040} y={705} lines={['No values are read into application', 'memory and written back later.']} size={34} color={muted} />
    <Copy x={1040} y={845} lines={['The bridge keeps both columns in sync.']} size={32} color={accent} />
  </Frame>;
}
function Rollback() {
  return <Frame number={3} title="Dropping full_name changes the rollback path"
    description="Read display_name and retain dual writes for a proposed seven-day observation period. Before cleanup, roll a read switch back to the bridge. Returning to the original old writer requires repeating writer drain and reconciliation before another read switch. After observation remove full_name access from the application, then drop only after no running version depends on it. After drop, older versions require restoring and repopulating full_name. Seven days is policy, not safety proof. No database engine or measured lock duration is supplied; test DDL and batch size on representative data before scheduling.">
    <Copy x={100} y={230} lines={['Preserve a simple read rollback through observation; remove dependencies before DDL.']} size={34} color={muted} />
    <Copy x={100} y={350} lines={['Observe for 7 days']} size={40} weight={500} color={accent} />
    <Copy x={720} y={350} lines={['Remove old access']} size={40} weight={500} color={accent} />
    <Copy x={1350} y={350} lines={['Drop full_name']} size={40} weight={500} color={accent} />
    <path d="M475 337 H660 L648 327 M660 337 L648 347 M1085 337 H1290 L1278 327 M1290 337 L1278 347" fill="none" stroke={accent} strokeWidth={3} />
    <Copy x={100} y={420} lines={['Read display_name.', 'Keep dual writes.']} size={34} />
    <Copy x={720} y={420} lines={['After observation, remove', 'full_name access from the app.']} size={34} />
    <Copy x={1350} y={420} lines={['Only when no running', 'version depends on it.']} size={34} />
    <line x1={1250} x2={1250} y1={530} y2={808} stroke={ink} strokeWidth={3} strokeDasharray="10 10" />
    <Copy x={100} y={590} lines={['Before cleanup: return to the bridge']} size={38} weight={500} />
    <Copy x={100} y={655} lines={['For read-switch rollback, use the bridge version.', 'Returning to the original old writer means repeating', 'writer drain + reconciliation before another read switch.']} size={34} />
    <Copy x={1350} y={590} lines={['After drop']} size={38} weight={500} />
    <Copy x={1350} y={655} lines={['Restore and repopulate', 'full_name before rolling', 'back to older versions.']} size={34} />
    <Copy x={100} y={870} lines={['Seven days is proposed policy, not proof of safety. No engine or lock duration is supplied.', 'Test DDL and batch size on representative data before scheduling the migration.']} size={32} color={muted} />
  </Frame>;
}
export const meta = { title: 'Juniper · Rename a field safely', createdAt: '2026-09-12T00:00:00Z' };
export const notes = [
  'This is a fictional, single-primary scenario. Adding the nullable column precedes bridge rollout. Old writers are allowed during rollout but prevent treating the new column as authoritative.',
  'The UPDATE is conceptual, not engine-specific SQL. Null-aware comparison must include null/value differences. Row locking and current database values avoid a stale application-memory copy. No lock-duration guarantee is implied.',
  'The read-switch rollback described here is before cleanup. Once application access is removed, compatibility must be checked for the actual running versions. After the column is dropped, older versions require schema restoration and repopulation first.',
];
export default [Coexistence, Reconcile, Rollback];
