import { Sankey, type CustomSankeyLayerProps, type DefaultLink } from '@nivo/sankey';
import { chartDefaults } from '../../lib/charts';
import { palettes } from '../../lib/taste';
import '../../lib/typeface';

type Node = { id: string; fill: string };
const data = {
  nodes: [
    { id: 'Web', fill: '#526579' },
    { id: 'Email', fill: '#526579' },
    { id: 'Automated', fill: '#2458C7' },
    { id: 'Specialist', fill: '#2458C7' },
    { id: 'Resolved', fill: '#526579' },
    { id: 'Escalated', fill: '#98451F' },
  ],
  links: [
    { source: 'Web', target: 'Automated', value: 50 },
    { source: 'Web', target: 'Specialist', value: 20 },
    { source: 'Email', target: 'Automated', value: 30 },
    { source: 'Email', target: 'Specialist', value: 20 },
    { source: 'Automated', target: 'Resolved', value: 70 },
    { source: 'Automated', target: 'Escalated', value: 10 },
    { source: 'Specialist', target: 'Resolved', value: 20 },
    { source: 'Specialist', target: 'Escalated', value: 20 },
  ],
};

function DirectLabels({ nodes, links }: CustomSankeyLayerProps<Node, DefaultLink>) {
  return <g fill="#172331" fontFamily="IBM Plex Sans" fontSize={30} fontWeight={500}>
    {links.map(link => {
      // Label close to the source: crossing ribbons remain individually identifiable.
      const t = 0.24;
      const x = link.source.x1 + (link.target.x0 - link.source.x1) * t;
      const curveT = (t - 0.5) * 2;
      // Invert the symmetric cubic's x coordinate to find its corresponding y.
      let u = t;
      for (let i = 0; i < 8; i++) {
        u -= (3 * u - 3 * u * u + 2 * u * u * u - (curveT + 1)) / (3 - 6 * u + 6 * u * u);
      }
      const y = link.pos0 + (link.pos1 - link.pos0) * (3 * u * u - 2 * u * u * u);
      return <g key={`${link.source.id}-${link.target.id}`} data-flow={`${link.source.id}-${link.target.id}`}
        data-count={link.value} data-thickness={link.thickness}>
        <rect x={x - 27} y={y - 23} width={54} height={46} rx={9} fill="white" />
        <text x={x} y={y + 10} textAnchor="middle">{link.value}</text>
      </g>;
    })}
    {nodes.map(node => {
      const middle = node.depth === 1;
      const x = node.depth === 0 ? node.x0 - 20 : middle ? (node.x0 + node.x1) / 2 : node.x1 + 20;
      const y = middle ? node.y0 - 18 : (node.y0 + node.y1) / 2 - 6;
      return <text key={node.id} x={x} y={y} textAnchor={node.depth === 0 ? 'end' : middle ? 'middle' : 'start'}
        data-node={node.id} data-total={node.value} data-height={node.height}
        stroke="white" strokeWidth={7} paintOrder="stroke" strokeLinejoin="round">
        {middle ? `${node.id} · ${node.value}` : node.id}
        {!middle && <tspan x={x} dy={38} fontSize={34} fontWeight={600}>{node.value}</tspan>}
      </text>;
    })}
  </g>;
}

const Brook = () => <svg xmlns="http://www.w3.org/2000/svg" width={1920} height={1080}
  viewBox="0 0 1920 1080" fontFamily="IBM Plex Sans" role="img" aria-labelledby="brook-title brook-description">
  <title id="brook-title">Specialist handling accounts for 20 of 30 escalations</title>
  <desc id="brook-description">Brook, a fictional support team. 120 tickets in one synthetic week.
    Web 70: 50 automated, 20 specialist. Email 50: 30 automated, 20 specialist.
    Automated 80: 70 resolved, 10 escalated. Specialist 40: 20 resolved, 20 escalated.
    Resolved total 90; escalated total 30. Each stage conserves 120 tickets.
    Complexity and routing criteria are unknown; this does not establish causation or relative performance.
    Channel-to-outcome breakdowns are not supplied and cannot be inferred through merged flows.</desc>
  <rect width={1920} height={1080} fill="white" />
  <text x={100} y={122} fill="#172331" fontSize={60} fontWeight={600}>Specialist handling accounts for</text>
  <text x={100} y={193} fill="#172331" fontSize={60} fontWeight={600}>20 of 30 escalations</text>
  <text x={100} y={255} fill="#475564" fontSize={30}>Brook support · 120 tickets · One fictional week · Synthetic, hand-authored counts</text>
  <g fill="#475564" fontSize={27} fontWeight={500}>
    <text x={280} y={321}>Intake · 120</text>
    <text x={940} y={321} textAnchor="middle">Handling · 120</text>
    <text x={1620} y={321} textAnchor="end">Outcome · 120</text>
  </g>
  <g transform="translate(100 345)">
    <Sankey<Node, DefaultLink> {...chartDefaults(palettes.paper)} data={data}
      width={1720} height={485} margin={{ top: 42, right: 200, bottom: 0, left: 180 }}
      colors={node => node.fill} sort="input" align="justify" nodeThickness={24}
      nodeSpacing={95} nodeBorderWidth={0} nodeBorderRadius={0} linkContract={0}
      linkOpacity={0.28} linkBlendMode="normal" enableLinkGradient={false}
      labelTextColor="#172331" layers={['links', 'nodes', DirectLabels]} />
  </g>
  <text x={100} y={883} fill="#172331" fontSize={29} fontWeight={500}>Every ticket follows one route per stage; no loops, duplicates or omissions.</text>
  <text x={100} y={939} fill="#475564" fontSize={28}>Complexity and routing criteria are unknown; these counts do not establish cause or performance.</text>
  <text x={100} y={986} fill="#475564" fontSize={28}>Channel-to-outcome breakdowns are not supplied and cannot be inferred through the merged flows.</text>
</svg>;

export const meta = { title: 'Brook — support ticket flow' };
export default [Brook];
