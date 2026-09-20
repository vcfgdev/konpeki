import type { ReactNode } from 'react';
import '../../lib/typeface.ts';

const ink = '#172D28';
const green = '#16704A';
const muted = '#52625D';

function Canvas({ name, description, children }: { name: string; description: string; children: ReactNode }) {
  return <div style={{ width: 1920, height: 1080, background: '#FFFFFF', display: 'flex', alignItems: 'center' }}>
    <svg data-artwork={name} xmlns="http://www.w3.org/2000/svg" width="1920" height="1008" viewBox="0 0 1200 630" role="img" aria-label={description} fontFamily="IBM Plex Sans" fill={ink}>
      <rect width="1200" height="630" fill="#FFFFFF" />
      {children}
    </svg>
  </div>;
}

function Check({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`} fill="none" stroke={green} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
    <rect width="36" height="36" rx="8" />
    <path d="M9 18l6 6 13-14" />
  </g>;
}

const Article = () => <Canvas name="article" description="A green build is not a release. Separate checks, approval and publication. Article illustration: checks complete, human approval and publication remain distinct. Fictional Clearpath example.">
  <text x="72" y="132" fontSize="76" fontWeight="600">A green build</text>
  <text x="72" y="218" fontSize="76" fontWeight="600">is not a release</text>
  <text x="74" y="287" fontSize="32" fill={muted}>Separate checks, approval and publication.</text>
  <g transform="translate(74 384)">
    <Check x={0} y={0} />
    <text x="0" y="85" fontSize="30" fontWeight="500">Checks</text>
    <circle cx="383" cy="18" r="18" fill="none" stroke={ink} strokeWidth="3" />
    <text x="365" y="85" fontSize="30" fontWeight="500">Approval</text>
    <rect x="730" y="0" width="36" height="36" rx="4" fill="none" stroke={ink} strokeWidth="3" />
    <text x="730" y="85" fontSize="30" fontWeight="500">Publication</text>
  </g>
  <text x="74" y="569" fontSize="22" fill={muted}>Clearpath · Fictional project</text>
</Canvas>;

const Release = () => <Canvas name="release" description="Clearpath 0.4. Preview release notes before exporting Markdown. Release illustration: a person reviews a local preview before Markdown export; the tool does not publish releases. Fictional release.">
  <text x="72" y="148" fontSize="96" fontWeight="600">Clearpath <tspan fill={green}>0.4</tspan></text>
  <text x="74" y="219" fontSize="32" fill={muted}>Preview release notes before</text>
  <text x="74" y="262" fontSize="32" fill={muted}>exporting Markdown.</text>
  <g transform="translate(74 338)">
    <rect width="650" height="153" rx="12" fill="none" stroke="#B5C5BE" strokeWidth="2" />
    <text x="28" y="49" fontSize="28" fontWeight="500">Release-note preview</text>
    <path d="M28 79H450 M28 104H370 M28 129H490" stroke="#B5C5BE" strokeWidth="6" />
    <Check x={720} y={16} />
    <text x="720" y="90" fontSize="28" fontWeight="500">Human review</text>
    <text x="720" y="129" fontSize="24" fill={muted}>before export</text>
  </g>
  <text x="74" y="569" fontSize="22" fill={muted}>Fictional release · Does not publish releases</text>
</Canvas>;

const Repository = () => <Canvas name="repository" description="Clearpath. A local release checklist for small software teams. Repository illustration: a local checklist prepares a release-note preview for human review and Markdown export, without publishing. Fictional project.">
  <text x="72" y="156" fontSize="110" fontWeight="600">Clearpath</text>
  <text x="74" y="237" fontSize="34" fill={muted}>A local release checklist</text>
  <text x="74" y="283" fontSize="34" fill={muted}>for small software teams.</text>
  <g transform="translate(840 98)">
    <rect width="270" height="340" rx="16" fill="none" stroke="#B5C5BE" strokeWidth="3" />
    <Check x={32} y={46} /><path d="M94 64H230" stroke={green} strokeWidth="7" />
    <Check x={32} y={130} /><path d="M94 148H203" stroke={green} strokeWidth="7" />
    <rect x="32" y="214" width="36" height="36" rx="8" fill="none" stroke={muted} strokeWidth="3" />
    <path d="M94 232H219" stroke="#B5C5BE" strokeWidth="7" />
  </g>
  <text x="74" y="425" fontSize="28" fontWeight="500" fill={green}>Review the release-note preview.</text>
  <text x="74" y="469" fontSize="28" fill={muted}>Markdown export. No publishing.</text>
  <text x="74" y="569" fontSize="22" fill={muted}>Fictional project</text>
</Canvas>;

export const meta = { title: 'Clearpath — link-preview images', createdAt: '2026-09-12T14:20:00Z' };
export const notes = [
  'Article link preview. Checks, human approval and publication are separate concerns. Clearpath does not publish releases.',
  'Fictional release link preview, not a real release announcement. The preview must be reviewed by a person before Markdown export.',
  'Fictional repository link preview. No repository URL, logo or adoption claims were supplied or invented.',
];
export default [Article, Release, Repository];
