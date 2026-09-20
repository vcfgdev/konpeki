import type { ReactNode } from 'react';
import { Text } from '../../lib/text.tsx';
import { fontsReady } from '../../lib/typeface.ts';

await fontsReady;

const ink = '#182B35';
const muted = '#4C606B';
const accent = '#006D77';

function Copy({ x = 112, y, width = 1696, size = 38, weight = 400, color = ink, children }: {
  x?: number; y: number; width?: number; size?: number; weight?: number; color?: string; children: string;
}) {
  return <Text x={x} y={y} width={width} size={size} weight={weight} color={color} maxLines={8} leading={1.22}>{children}</Text>;
}

function Canvas({ page, title, description, children }: { page: number; title: string; description: string; children: ReactNode }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" role="img"
    aria-labelledby={`title-${page} description-${page}`} data-page={page} fontFamily="IBM Plex Sans">
    <title id={`title-${page}`}>{title}</title>
    <desc id={`description-${page}`}>{description}</desc>
    <rect width="1920" height="1080" fill="#FFFFFF" />
    <Copy y={146} size={72} weight={600}>{title}</Copy>
    {children}
    <text x="1808" y="1020" textAnchor="end" fill={muted} fontSize="28">{page} / 2</text>
  </svg>;
}

const Argument = () => <Canvas page={1} title="Keep the reason with the decision"
  description="In Mira Sol’s fictional Alder account, meeting notes preserved speakers and tasks but lost why a daily export was chosen. The receiving system allowed only one upload per day. Alder’s decision record preserved that constraint and a revisit trigger: a supported live API. Sol claims decisions became easier to explain, not measured faster delivery.">
  <Copy y={224} size={32} color={muted}>Mira Sol’s “The decision record that survived the meeting” · A fictional Alder account</Copy>
  <Copy y={354} width={560} size={48} weight={600}>A month later, the “why” was missing.</Copy>
  <Copy y={508} width={550} color={muted}>Meeting notes captured who spoke and what to do next. They lost the constraint behind the export choice.</Copy>
  <Copy x={800} y={350} width={1008} size={30} weight={600} color={accent}>ALDER’S EXPORT DECISION</Copy>
  <line x1="800" x2="1808" y1="388" y2="388" stroke="#A5B4BC" strokeWidth="2" />
  <Copy x={800} y={450} width={260} size={34} weight={600}>Choice</Copy>
  <Copy x={1100} y={450} width={708} size={38}>Daily data export over a live integration</Copy>
  <line x1="800" x2="1808" y1="532" y2="532" stroke="#A5B4BC" strokeWidth="2" />
  <Copy x={800} y={594} width={260} size={34} weight={600}>Reason</Copy>
  <Copy x={1100} y={594} width={708} size={38}>Receiving system accepted only one upload per day</Copy>
  <line x1="800" x2="1808" y1="676" y2="676" stroke="#A5B4BC" strokeWidth="2" />
  <Copy x={800} y={738} width={260} size={34} weight={600}>Revisit when</Copy>
  <Copy x={1100} y={738} width={708} size={38}>Receiving system adds a supported live API</Copy>
  <line x1="800" x2="1808" y1="820" y2="820" stroke="#A5B4BC" strokeWidth="2" />
  <Copy y={922} size={40} weight={500} color={accent}>The claim: decisions became easier to explain later.</Copy>
  <Copy y={975} size={32} color={muted}>Sol reports no measurement of faster delivery; this is one team’s experience.</Copy>
</Canvas>;

const Application = () => <Canvas page={2} title="Try a record on one consequential choice"
  description="Suggested application for engineering managers, adapted from Sol’s fictional account: choose a decision that crosses teams, is costly to reverse, or rests on a changing constraint. Keep a short record beside the work with question, constraints, alternatives, choice, and revisit condition. If Alder gains a supported live API, reassess the export; append and link a new decision rather than overwrite the old rationale. Routine local choices can stay in code review. Keep task lists and meeting notes for their separate purposes.">
  <Copy y={224} size={32} color={muted}>A suggested first trial, adapted from Sol’s practice—not a requirement for every team.</Copy>
  <Copy y={350} width={620} size={44} weight={600}>Choose selectively</Copy>
  <Copy y={420} width={620} size={36}>Use a record when a choice:</Copy>
  <Copy y={490} width={620} size={38}>• Crosses team boundaries</Copy>
  <Copy y={552} width={620} size={38}>• Is costly to reverse</Copy>
  <Copy y={614} width={620} size={38}>• Relies on a constraint likely to change</Copy>
  <Copy y={780} width={610} size={34} color={muted}>Routine local choices can stay in code review. Keep task lists and meeting notes; they answer different questions.</Copy>
  <Copy x={860} y={350} width={948} size={44} weight={600}>Keep a short record beside the work</Copy>
  <Copy x={860} y={423} width={948} size={36}>Question · Known constraints · Alternatives</Copy>
  <Copy x={860} y={477} width={948} size={36}>Choice · Condition for revisiting</Copy>
  <Copy x={860} y={600} width={948} size={44} weight={600} color={accent}>When Alder gains a supported live API…</Copy>
  <Copy x={860} y={723} width={948} size={38}>Reassess whether the daily export still fits. Append a new decision and link the old one; preserve the original rationale.</Copy>
  <Copy x={860} y={911} width={948} size={34} color={muted}>A manager’s review question: can the next engineer explain the trade-off and when to reconsider it?</Copy>
</Canvas>;

export const meta = { title: 'Alder — The reason behind the decision' };
export const notes = [
  'Source: the complete fictional article in PROMPT.md by Mira Sol at Alder. This page summarizes the stated experience and preserves its explicit evidence limit.',
  'The single-choice trial and manager’s review question are editorial applications, not quotations or measured outcomes. All five record fields and selective-use criteria come from the supplied article.',
];
export default [Argument, Application];
