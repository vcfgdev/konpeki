import type { ReactNode } from 'react';
import '../../lib/typeface.ts';

const ink = '#182B27';
const muted = '#4F625C';
const green = '#17634A';
const pale = '#DAE9E1';

function Copy({ x = 112, y, lines, size = 36, weight = 400, color = ink }: {
  x?: number; y: number; lines: string[]; size?: number; weight?: number; color?: string;
}) {
  return <text x={x} y={y} fontSize={size} fontWeight={weight} fill={color}>
    {lines.map((line, i) => <tspan key={i} x={x} dy={i ? size * 1.32 : 0}>{line}</tspan>)}
  </text>;
}

function Frame({ title, page, description, children }: {
  title: string; page: number; description: string; children: ReactNode;
}) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"
    fontFamily="IBM Plex Sans" role="img" aria-label={`${title}. ${description}`}>
    <rect width="1920" height="1080" fill="#FFFFFF" />
    <Copy y={150} lines={[title]} size={64} weight={600} />
    {children}
    <Copy x={1770} y={1020} lines={[`${page} / 3`]} size={28} color={muted} />
  </svg>;
}

const tasks = [
  { label: 'Book a desk', before: 6, after: 2 },
  { label: 'Change the date', before: 4, after: 4 },
  { label: 'Find cancellation', before: 3, after: 5 },
];

function Completion() {
  return <Frame title="Booking management needed more hints" page={1}
    description="Fictional Fern research. Of the same eight participants, booking: six before a hint, two after; date change: four before, four after; cancellation: three before, five after. Everyone eventually completed all tasks.">
    <Copy y={235} lines={['Fern · shared workspace booking · fictional, hand-authored study']} color={muted} />
    <Copy y={320} lines={['8 first-time users from one company; individual moderated desktop sessions.']} />
    <rect x={540} y={385} width={28} height={28} fill={green} />
    <Copy x={585} y={410} lines={['Before a hint']} size={32} />
    <rect x={930} y={385} width={28} height={28} fill={pale} />
    <Copy x={975} y={410} lines={['After a hint']} size={32} />
    <Copy x={1610} y={410} lines={['Total: 8']} size={32} color={muted} />
    {tasks.map((task, i) => {
      const y = 466 + i * 122;
      return <g key={task.label} data-task={task.label}>
        <Copy y={y + 53} lines={[task.label]} size={38} weight={500} />
        <rect x={540} y={y} width={task.before * 150} height={80} fill={green} />
        <rect x={540 + task.before * 150} y={y} width={task.after * 150} height={80} fill={pale} />
        <text x={540 + task.before * 75} y={y + 53} textAnchor="middle" fontSize={38} fontWeight={600} fill="#FFFFFF">{task.before}</text>
        <text x={540 + task.before * 150 + task.after * 75} y={y + 53} textAnchor="middle" fontSize={38} fontWeight={600} fill={ink}>{task.after}</text>
      </g>;
    })}
    <Copy y={870} lines={['Same people, fixed order: book → change date → find cancellation.',
      'Hints were offered after up to 3 minutes. All 8 eventually completed every task.',
      'No task-time distribution or comparison design was recorded.']} size={34} color={muted} />
  </Frame>;
}

function Observations() {
  return <Frame title="The notes point to a navigation mismatch" page={2}
    description="Five participants looked in the calendar to change a booking. Four said My visits sounded like past activity. These observations may overlap; no participant mapping is available. Researchers suspect both the label and placement, but cannot separate their effects.">
    <Copy y={270} lines={['Observed in the sessions']} size={40} weight={600} color={green} />
    <Copy x={1050} y={270} lines={['Researchers’ interpretation']} size={40} weight={600} color={green} />
    <Copy y={380} lines={['5 of 8 looked in the calendar']} size={42} weight={500} />
    <Copy y={444} lines={['to change a booking. The prototype', 'put that action under “My visits”.']} />
    <Copy y={610} lines={['4 of 8 questioned “My visits”']} size={42} weight={500} />
    <Copy y={674} lines={['They said it sounded like past activity.']} />
    <Copy x={1050} y={380} lines={['The label and action placement', 'are likely sources of confusion.']} size={40} weight={500} />
    <Copy x={1050} y={535} lines={['The sessions cannot separate', 'their effects. Fixed task order may', 'also have influenced later tasks.']} />
    <Copy y={850} lines={['The two observations can overlap; the notes do not map them to individuals.']} size={34} color={muted} />
    <Copy y={913} lines={['Fictional study evidence, not proof that either factor caused the difficulty.']} size={34} color={muted} />
  </Frame>;
}

function NextStudy() {
  return <Frame title="Test labels and placement before choosing a fix" page={3}
    description="Proposed study, not tested: compare clearer labels and calendar-based actions, vary task order, and recruit from multiple companies. The small volunteer study supports investigating booking management, not claiming a redesign will solve it or estimating population completion, adoption, or mobile usability.">
    <Copy y={255} lines={['Proposed next study · no alternative has been tested yet']} color={green} weight={500} />
    <Copy y={366} lines={['Question to investigate']} size={34} weight={600} color={muted} />
    <Copy x={850} y={366} lines={['What the comparison needs']} size={34} weight={600} color={muted} />
    <line x1={112} x2={1808} y1={400} y2={400} stroke="#BAC9C2" strokeWidth={2} />
    <Copy y={466} lines={['Does clearer wording help?']} size={38} weight={500} />
    <Copy x={850} y={466} lines={['Compare clearer labels with “My visits”;', 'hold action placement constant.*']} />
    <line x1={112} x2={1808} y1={558} y2={558} stroke="#BAC9C2" strokeWidth={2} />
    <Copy y={622} lines={['Does calendar access help?']} size={38} weight={500} />
    <Copy x={850} y={622} lines={['Compare calendar-based actions with the', 'current placement; hold wording constant.*']} />
    <line x1={112} x2={1808} y1={715} y2={715} stroke="#BAC9C2" strokeWidth={2} />
    <Copy y={774} lines={['Vary task order and recruit from more than one company.']} size={38} weight={500} />
    <Copy y={834} lines={['*Suggested comparison structure; the report proposes testing labels and calendar actions.']} size={30} color={muted} />
    <Copy y={909} lines={['Scope: investigate booking management. This small volunteer sample cannot establish',
      'population completion rates, production adoption, mobile usability or a proven fix.']} size={34} color={muted} />
  </Frame>;
}

export const meta = { title: 'Fern — Research briefing', createdAt: '2026-09-12T14:20:00Z' };
export const notes = [
  'Source: the complete fictional report in PROMPT.md. Counts are mutually exclusive before/after-hint outcomes for each task, for the same eight people.',
  'Observations and interpretations are deliberately separated. No unique combined participant count can be derived.',
  'Holding one variable constant is an author-proposed operationalization, explicitly marked on the page; no redesign efficacy is claimed.',
];
const pages = [Completion, Observations, NextStudy];
export default pages;
