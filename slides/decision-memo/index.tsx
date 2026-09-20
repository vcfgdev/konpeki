import type { ReactNode } from 'react';
import '@fontsource/newsreader/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-600.css';

const green = '#164D3A';
const ink = '#202B26';
const muted = '#526159';
function Copy({ x = 112, y, lines, size = 36, color = ink, bold = false }: {
  x?: number; y: number; lines: string[]; size?: number; color?: string; bold?: boolean;
}) {
  return <text x={x} y={y} fill={color} fontSize={size} fontWeight={bold ? 600 : 400}>
    {lines.map((line, i) => <tspan key={i} x={x} dy={i ? size * 1.35 : 0}>{line}</tspan>)}
  </text>;
}
function Frame({ number, title, summary, children }: {
  number: number; title: string[]; summary: string; children: ReactNode;
}) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"
    role="img" aria-label={`${title.join(' ')}. ${summary}`} fontFamily="IBM Plex Sans" data-cedar-page={number}>
    <rect width="1920" height="1080" fill="#FFFFFF" />
    <text x="112" y="160" fontFamily="Newsreader" fontSize="82" fill={green}>
      {title.map((line, i) => <tspan key={i} x="112" dy={i ? 90 : 0}>{line}</tspan>)}
    </text>
    {children}
    <text x="1808" y="1024" textAnchor="end" fontSize="28" fill={muted}>{number} / 3</text>
  </svg>;
}

const Tradeoff = () => <Frame number={1} title={['Suggested replies were faster;', 'quality signals were weaker.']}
  summary="Cedar Support fictional trial, synthetic data. One week, 120 tickets per group. Standard versus suggested replies: median handling time 12 versus 9 minutes; quality passed 108 of 120 (90%) versus 102 of 120 (85%); reopened within seven days of closure 9 of 120 (7.5%) versus 15 of 120 (12.5%). Quality and reopening are separate measures; a passing ticket can reopen. Each rate uses all 120 tickets in its group.">
  <Copy y={335} lines={['Cedar Support · One week · 120 tickets per group']} color={muted} />
  <Copy x={900} y={443} lines={['Standard workflow']} size={32} bold />
  <Copy x={1335} y={443} lines={['Suggested replies']} size={32} color={green} bold />
  <line x1="112" x2="1808" y1="478" y2="478" stroke="#A4B2AA" />
  <Copy y={553} lines={['Median handling time']} />
  <Copy x={900} y={553} lines={['12 min']} size={46} />
  <Copy x={1335} y={553} lines={['9 min']} size={46} color={green} />
  <line x1="112" x2="1808" y1="601" y2="601" stroke="#D7DED9" />
  <Copy y={676} lines={['Passed quality review']} />
  <Copy x={900} y={676} lines={['108 / 120 · 90%']} size={40} />
  <Copy x={1335} y={676} lines={['102 / 120 · 85%']} size={40} color={green} />
  <line x1="112" x2="1808" y1="724" y2="724" stroke="#D7DED9" />
  <Copy y={791} lines={['Reopened within 7 days', 'of closure']} size={34} />
  <Copy x={900} y={791} lines={['9 / 120 · 7.5%']} size={40} />
  <Copy x={1335} y={791} lines={['15 / 120 · 12.5%']} size={40} color={green} />
  <line x1="112" x2="1808" y1="861" y2="861" stroke="#A4B2AA" />
  <Copy y={922} lines={['Quality and reopening are separate measures: a passing ticket can reopen.',
    'Fictional team; synthetic, hand-authored figures—not an actual trial.']} size={30} color={muted} />
</Frame>;

const Evidence = () => <Frame number={2} title={['The pattern warrants a better test,', 'not a causal claim.']}
  summary="The observed median is 3 minutes lower, while quality pass rate is 5 percentage points lower and reopen rate 5 points higher. These are descriptive differences in synthetic data, not causal effects. Assignment was not randomized; ticket difficulty and agent experience were not controlled. There are no raw timing observations, variance estimates or confidence intervals. Medians cannot establish total hours saved. Labor costs and customer satisfaction were not measured.">
  <Copy y={360} lines={['What the comparison shows']} size={38} color={green} bold />
  <Copy y={433} lines={['3 minutes lower median handling time', '5 percentage points lower quality pass rate', '5 percentage points higher reopen rate']} size={37} />
  <Copy x={1035} y={360} lines={['What could explain it']} size={38} color={green} bold />
  <Copy x={1035} y={433} lines={['Assignment was not randomized.', 'Ticket difficulty and agent experience', 'were not controlled.']} size={37} />
  <Copy y={677} lines={['Precision is unknown']} size={38} color={green} bold />
  <Copy y={750} lines={['No raw timing observations, variance', 'estimates or confidence intervals.']} size={37} />
  <Copy x={1035} y={677} lines={['Business impact is unknown']} size={38} color={green} bold />
  <Copy x={1035} y={750} lines={['Medians cannot yield total hours saved.', 'No labor-cost or customer-satisfaction', 'results are available.']} size={37} />
  <Copy y={948} lines={['These are descriptive differences in synthetic data, not estimates of treatment effects.']} size={30} color={muted} />
</Frame>;

const Decision = () => <Frame number={3} title={['Extend with a longer randomized trial', 'and retain human review.']}
  summary="Recommendation to Cedar Support’s operations lead: authorize a longer randomized trial with comparable ticket categories and human review retained, rather than broad rollout. Agree quality and reopen-rate acceptance criteria before starting; no numerical thresholds have been set. Collect raw handling-time observations and both quality measures, retaining seven-day reopening follow-up. Decide whether speed improves while both quality guardrails are met; revise or stop expansion if either fails. These collection and decision details are recommendations, not observed results.">
  <Copy y={347} lines={['Recommendation to Cedar Support’s operations lead']} size={34} color={muted} />
  <Copy y={475} lines={['Before launch']} size={40} color={green} bold />
  <Copy x={650} y={475} lines={['Agree quality and reopen-rate acceptance criteria.', 'No numerical thresholds have been set.']} size={38} />
  <line x1="112" x2="1808" y1="578" y2="578" stroke="#D7DED9" />
  <Copy y={651} lines={['During the trial']} size={40} color={green} bold />
  <Copy x={650} y={651} lines={['Randomize across comparable ticket categories; retain human review.', 'Collect raw handling times and both quality measures.', 'Allow seven-day reopening follow-up after closure.']} size={35} />
  <line x1="112" x2="1808" y1="798" y2="798" stroke="#D7DED9" />
  <Copy y={871} lines={['At the decision']} size={40} color={green} bold />
  <Copy x={650} y={871} lines={['Does speed improve while both quality guardrails are met?', 'Use the results to judge rollout; revise or stop expansion if either fails.']} size={35} />
  <line x1="112" x2="1808" y1="968" y2="968" stroke="#A4B2AA" />
</Frame>;

export const meta = { title: 'Cedar Support — suggested replies decision', createdAt: '2026-09-12T14:00:00Z' };
export const notes = [
  'All figures are synthetic and supplied in PROMPT.md. Rates use 120 tickets in each group; quality review and reopening are not mutually exclusive.',
  'Differences are arithmetic descriptions only. Non-random assignment and uncontrolled difficulty/experience prevent causal attribution.',
  'The longer randomized trial, comparable categories, human review, and pre-agreed criteria are supplied proposals. Raw-time collection, complete follow-up and the decision sequence are author recommendations. Trial duration, sample size and thresholds require planning; none is invented here.',
];
export default [Tradeoff, Evidence, Decision];
