import { createComponent, createContentSlots, initialDraft } from "./document.ts";
import type { CompositionDocument, ExplicitTopology } from './types.ts';
import { diagramDefinition } from './visualizations.ts';

// Reconstructed contract exercises, not recovered historical pilot outputs.
function packet(title: string, kind: 'text-block' | 'chart' | 'diagram', instruction: string, diagramType: 'process' | 'architecture' = 'process'): CompositionDocument {
  const draft = initialDraft();
  const body = createComponent(kind, 2);
  if (body.kind === 'diagram') body.appearance = {
    ...body.appearance,
    type: diagramType,
  };
  body.intent = instruction;
  draft.title = title;
  const slide = draft.slides[0];
  const replacedId = slide.components[1].id;
  body.preferredRect = { ...slide.components[1].preferredRect };
  slide.components[1] = body;
  slide.contentSlots.splice(1, 1, ...createContentSlots(body));
  slide.contentSlots = slide.contentSlots.map(slot => "targets" in slot ? { ...slot, targets: slot.targets.map(target => target === replacedId ? body.id : target) } : slot);
  slide.readingOrder = slide.components.map(c => ({ kind: 'component', id: c.id }));
  slide.paintOrder = slide.components.map(c => c.id);
  return draft;
}
function withTopology(document: CompositionDocument, topology: ExplicitTopology) {
  const slide = document.slides[0];
  const component = slide.components[1];
  if (component.kind !== 'diagram') throw new Error('Topology requires a diagram');
  const old = component.slotIds;
  component.slotIds = topology.nodes.map(n => n.slotId);
  component.topology = topology;
  slide.contentSlots = slide.contentSlots.filter(s => !old.includes(s.id));
  slide.contentSlots.push(...topology.nodes.map(n => ({ id: n.slotId, label: n.id, required: true, instruction: `Preserve the supplied role and ownership of ${n.id}.`, role: diagramDefinition(component.appearance.type).slotRole })));
  return document;
}
const latency = packet('Observed candidate latency is lower, but missing runs and staging scope limit the conclusion', 'chart', 'Fictional Atlas: control median 420 ms / 60 runs; candidate median 310 ms / 55 observed runs. Five consecutive missing runs are not zero. Fixed staging workload, not peak production. Source AR-27, 8 September 2026.');
const comparison = packet('Compare the options without filling unavailable values', 'text-block', 'Use the same criteria for both options. Operational support for B is unavailable, not zero. Distinguish target from observation; exclude security review. Keep the recommendation conditional and preserve its revisit trigger.');
const comparisonBlock = comparison.slides[0].components[1];
if (comparisonBlock.kind !== 'text-block') throw new Error('Comparison requires a text block');
comparisonBlock.appearance = { ...comparisonBlock.appearance, layout: 'two-column', purpose: 'comparison', treatment: 'plain' };
comparison.slides[0].contentSlots[1].role = 'comparison-item';
const process = withTopology(packet('Keep pending separate from approved', 'diagram', 'Preserve the approval branch, pending return, and terminal security transfer. Do not invent a follow-on after transfer.', 'process'), {
  kind: 'explicit', nodes: ['submitted', 'review', 'approved', 'pending', 'security'].map(id => ({ id, slotId: `${id}-step` })),
  edges: [{ from: 'submitted', to: 'review' }, { from: 'review', to: 'approved', label: 'approved' }, { from: 'review', to: 'pending', label: 'incomplete' }, { from: 'pending', to: 'review', label: 'resubmit' }, { from: 'review', to: 'security', label: 'transfer' }],
});
const architecture = withTopology(packet('Show ownership and the complete polling route', 'diagram', 'Keep entity owners, two failure modes and retry uncertainty. Browser polling must visibly pass through Gateway and Report API. Request missing source details rather than assigning invented owners.', 'architecture'), {
  kind: 'explicit', nodes: ['browser', 'gateway', 'api', 'queue', 'worker', 'warehouse', 'store'].map(id => ({ id, slotId: `${id}-entity` })),
  edges: [
    { from: 'browser', to: 'gateway', label: 'initial request' }, { from: 'gateway', to: 'api', label: 'accepted request' },
    { from: 'api', to: 'queue', label: 'job write' }, { from: 'queue', to: 'worker', label: 'job read' },
    { from: 'worker', to: 'warehouse', label: 'query' }, { from: 'worker', to: 'store', label: 'generated report' },
    { from: 'worker', to: 'api', label: 'completion' }, { from: 'browser', to: 'gateway', label: 'later poll' }, { from: 'gateway', to: 'api', label: 'later poll' },
  ],
});
architecture.slides[0].relationships.push({ id: 'qualification', kind: 'qualifies', direction: 'forward', from: { nodeId: 'text-block-3' }, to: { nodeId: 'diagram-2', slotId: 'queue-entity' }, label: 'Preserve retry uncertainty' });
const overfull = packet('Do not silently drop required routing-decision content', 'text-block', 'All supplied decision criteria, alternatives, constraints, owners, risks, unresolved questions, evidence and sources are required. If these cannot fit readably on one slide, ask for a scope decision; do not conceal content or shrink it.');
const overfullBlock = overfull.slides[0].components[1];
if (overfullBlock.kind !== 'text-block') throw new Error('Overfull fixture requires a text block');
overfullBlock.appearance = { ...overfullBlock.appearance, layout: 'two-column', purpose: 'comparison', treatment: 'plain' };
overfull.slides[0].contentSlots[1].role = 'comparison-item';
overfull.slides[0].contentSlots[1].instruction = Array.from({ length: 24 }, (_, i) => `Required constraint ${i + 1}: preserve the supplied evidence, owner, scope and caveat; missing specifics must be requested.`).join('\n');
export const fixtures: Record<string, CompositionDocument> = {
  'long-headline-qualification': latency,
  'comparison-with-missing-value': comparison,
  'branching-process-return': process,
  'architecture-ownership': architecture,
  'overfull-required-content': overfull,
};
