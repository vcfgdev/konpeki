import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { tableAppearanceForStyle, tableStyleForAppearance } from './schema.ts';
import { schemaV2 } from './schema-v2.ts';
import { fixtures } from './fixtures.ts';
import { canonicalJSON, compileHandoff } from './compile.ts';
import { validateComposition } from './validate.ts';
import { parseEditableSvg } from './vector.ts';
import { canvasPadding, componentKinds, compositionSchema, themeIds, typographyIds } from './types.ts';
import { chartDefinitions, chartTemplates, diagramDefinitions, diagramTypes } from './visualizations.ts';
import { addComponent, addSlide, createComponent, initialDraft, parseCompositionJSON, parseStoredDraft, serializeDraft } from "./document.ts";
import { resolveDocument, toComposition } from './grid.ts';
const publicSchema = JSON.parse(readFileSync(new URL('./schema-v2.json', import.meta.url), 'utf8'));
const validateSchema = new Ajv2020({ strict: false }).compile(publicSchema);
const firstSlide = (document: ReturnType<typeof initialDraft>) => document.slides[0];
test('public schema is generated from the runtime vocabulary', () => assert.deepEqual(publicSchema, schemaV2));
for (const [name, document] of Object.entries(fixtures)) test(`fixture and deterministic handoff: ${name}`, () => {
  const wire = toComposition(document);
  assert.equal(validateSchema(wire), true);
  assert.equal(validateComposition(wire).ok, true);
  assert.equal(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'), canonicalJSON(wire) + '\n');
  assert.equal(readFileSync(new URL(`./fixtures/${name}.handoff.md`, import.meta.url), 'utf8'), compileHandoff(wire));
  const body = document.slides[0].components[1].preferredRect;
  const emphasis = document.slides[0].components.find(component => component.kind === 'text-block' && component.appearance?.purpose === 'emphasis')?.preferredRect;
  if (emphasis) assert.ok(body.x + body.width <= emphasis.x, 'body and emphasis must not overlap');
});
test('schema exposes only five top-level component kinds and text roles replace headline and footnote', () => {
  assert.deepEqual(componentKinds, ['text-block', 'chart', 'diagram', 'image', 'table']);
  const doc = initialDraft();
  const roles = firstSlide(doc).components
    .filter(component => component.kind === 'text-block')
    .map(component => component.appearance.role);
  assert.deepEqual(roles, ['title', 'body', 'footnote']);
  assert.equal(validateSchema(toComposition(doc)), true);
  assert.equal(validateComposition(toComposition(doc)).ok, true);
});
test('raw SVG is rejected by the v2 wire contract', () => {
  const wire = toComposition(initialDraft()) as unknown as Record<string, any>;
  wire.slides[0].components[1].customVisual = {
    format: 'svg', source: '<svg/>', viewBox: { x: 0, y: 0, width: 1, height: 1 }, description: 'raw',
  };
  assert.equal(validateSchema(wire), false);
  assert.equal(validateComposition(wire).ok, false);
});
test('SVG primitives import as stable editable vector elements', () => {
  const parsed = parseEditableSvg(
    '<svg viewBox="0 0 400 200"><rect id="card" x="10" y="10" width="380" height="180" fill="theme:background"/><line id="link" x1="40" y1="100" x2="360" y2="100" stroke="theme:accent" stroke-width="4"/><text id="label" x="120" y="80" fill="theme:ink" font-family="theme:body-font" font-size="scale:body">Editable</text></svg>',
  );
  assert.deepEqual(parsed.viewBox, { x: 0, y: 0, width: 400, height: 200 });
  assert.deepEqual(
    parsed.elements.map((element) => [element.id, element.kind, element.parentId]),
    [
      ['card', 'rect', undefined],
      ['link', 'line', undefined],
      ['label', 'text', undefined],
    ],
  );
  assert.equal(parsed.elements.at(-1)?.text, 'Editable');
  const draft = initialDraft();
  draft.slides[0].components[1].customVisual = {
    format: 'vector',
    elements: parsed.elements,
    viewBox: parsed.viewBox,
    description: 'Editable card, line and label',
  };
  assert.equal(validateSchema(toComposition(draft)), true);
  assert.equal(validateComposition(toComposition(draft)).ok, true);
  assert.match(compileHandoff(draft), /preserve element IDs/);

  const invalid = structuredClone(draft);
  if (invalid.slides[0].components[1].customVisual?.format !== 'vector') return;
  invalid.slides[0].components[1].customVisual.elements[1].parentId = 'missing';
  assert.equal(validateComposition(toComposition(invalid)).ok, false);
});
test('diagram starting points and chart grammars have complete, disjoint definitions', () => {
  assert.ok(diagramTypes.length > 0);
  assert.deepEqual(Object.keys(diagramDefinitions), [...diagramTypes]);
  assert.ok(Object.values(diagramDefinitions).every(definition => definition.expression.length > 40));
  assert.deepEqual(
    [...new Set(Object.values(diagramDefinitions).map(definition => definition.layout))].sort(),
    ['branching', 'cyclical', 'hub-and-spoke', 'layered', 'linear', 'request-flow'],
  );
  assert.ok(Object.values(diagramDefinitions).every(definition => definition.category.trim()));
  assert.deepEqual(Object.keys(chartDefinitions), [...chartTemplates]);
  assert.equal('sankey' in diagramDefinitions, false);
  assert.equal(chartDefinitions.sankey.source, 'diagram-design');
  assert.deepEqual(diagramTypes.filter(type => (chartTemplates as readonly string[]).includes(type)), []);
  for (const template of chartTemplates) {
    const draft = initialDraft();
    const chart = draft.slides[0].components[1];
    if (chart.kind !== 'chart') throw new Error('Chart missing');
    chart.appearance.template = template;
    assert.equal(validateComposition(toComposition(draft)).ok, true, template);
  }
});
test('reading order expands groups exactly once independently of text role', () => {
  const doc = initialDraft();
  const slide = firstSlide(doc);
  slide.groups = [{ id: 'body', childIds: ['chart-2', 'text-block-3'] }];
  slide.readingOrder = [{ kind: 'component', id: 'text-block-1' }, { kind: 'group', id: 'body' }, { kind: 'component', id: 'text-block-4' }];
  slide.paintOrder.reverse(); assert.equal(validateComposition(toComposition(doc)).ok, true);
  slide.readingOrder.reverse(); assert.equal(validateComposition(toComposition(doc)).ok, true);
  slide.groups[0].childIds.push('text-block-1'); assert.equal(validateComposition(toComposition(doc)).ok, false);
});
test('references and rectangles cannot silently escape the contract', () => {
  const doc = initialDraft();
  const wire = toComposition(doc);
  wire.slides[0].components[1].area.column = 13;
  assert.equal(validateComposition(wire).ok, false);
  const reference = initialDraft();
  firstSlide(reference).relationships = [{ id: 'relation', kind: 'depends-on', direction: 'forward', from: { nodeId: 'chart-2', slotId: 'text-block-1-content' }, to: { nodeId: 'text-block-3' } }];
  assert.equal(validateComposition(toComposition(reference)).ok, false);
  firstSlide(reference).relationships[0].from.slotId = 'chart-2-content';
  assert.equal(validateComposition(toComposition(reference)).ok, true);
  firstSlide(reference).relationships.push({ ...firstSlide(reference).relationships[0] });
  assert.equal(validateComposition(toComposition(reference)).ok, false);
});
test('topology preserves parallel request/poll links and rejects missing, duplicate and self endpoints', () => {
  const doc = structuredClone(fixtures['architecture-ownership']);
  const c = firstSlide(doc).components[1]; assert.equal(c.kind, 'diagram');
  if (c.kind !== 'diagram' || !c.topology) throw new Error('Missing topology');
  assert.equal(c.topology.edges.length, 9);
  assert.equal(validateComposition(toComposition(doc)).ok, true);
  c.topology.edges.push({ ...c.topology.edges[0] }); assert.equal(validateComposition(toComposition(doc)).ok, false); c.topology.edges.pop();
  c.topology.edges[0].to = 'unknown'; assert.equal(validateComposition(toComposition(doc)).ok, false);
  c.topology.edges[0].to = c.topology.edges[0].from; assert.equal(validateComposition(toComposition(doc)).ok, false);
  c.topology.edges[0].to = 'gateway'; c.topology.nodes.pop(); assert.equal(validateComposition(toComposition(doc)).ok, false);
});
test('diagram topology requires unique exact slot coverage', () => {
  const doc = structuredClone(fixtures['branching-process-return']); const c = doc.slides[0].components[1];
  if (c.kind !== 'diagram' || !c.topology) throw new Error('Missing diagram');
  c.topology.nodes[1].slotId = c.topology.nodes[0].slotId;
  assert.equal(validateComposition(toComposition(doc)).ok, false);
});
test('diagram topology rejects derived node geometry', () => {
  const wire = toComposition(structuredClone(fixtures['branching-process-return']));
  const component = wire.slides[0].components[1];
  if (component.kind !== 'diagram' || !component.topology) throw new Error('Missing diagram');
  component.topology.nodes[0].preferredRect = { x: 150, y: 320, width: 160, height: 80 };
  assert.equal(validateComposition(wire).ok, false);
});
test('compiler canonicalizes object keys, retains array order and needs no authoring kit', () => {
  const doc = initialDraft();
  const reversedKeys = JSON.parse(JSON.stringify(doc, (_, value) => value && !Array.isArray(value) && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse()) : value));
  assert.equal(compileHandoff(doc), compileHandoff(reversedKeys));
  const before = compileHandoff(doc); firstSlide(doc).paintOrder.reverse();
  assert.notEqual(compileHandoff(doc), before);
  assert.match(before, /render every directed, labeled edge exactly once/);
  assert.match(before, /Keep ordinary text in native Text-block content, not artwork/);
  assert.match(before, /Do not write canvas, innerPadding, preferredRect/);
  assert.match(before, /Auto chart form .*Compare quantitative values across categories/);
  assert.doesNotMatch(before, /github\.com|Trusted target|AUTHORING\.md/);
});
test('compiler preserves an ordered multi-slide deck and slide names', () => {
  const document = addSlide(initialDraft()).draft;
  document.slides[1].name = 'Decision';
  const handoff = compileHandoff(document);
  assert.equal((handoff.match(/^### \d+\./gm) ?? []).length, 2);
  assert.match(handoff, /Surface: 1920×1080 pixels/);
  assert.match(handoff, /Preserve sources, qualifications, page order and page count/);
  assert.ok(handoff.indexOf('### 1. Slide 01') < handoff.indexOf('### 2. Decision'));
  assert.ok(handoff.indexOf('"name": "Slide 01"') < handoff.indexOf('"name": "Decision"'));
  const duplicateId = structuredClone(document);
  duplicateId.slides[1].id = duplicateId.slides[0].id;
  assert.equal(validateComposition(duplicateId).ok, false);
});
test('compiler summarizes explicit order, placement, relationships and only used component guidance', () => {
  const document = structuredClone(fixtures['architecture-ownership']);
  const handoff = compileHandoff(document);
  assert.match(handoff, /## Deck plan/);
  assert.match(handoff, /Text block `text-block-1`, column 1, span 11, row 1, rows 7/);
  assert.match(handoff, /Diagram `diagram-2`, column 1, span 7, row 18, rows 44/);
  assert.match(handoff, /Reading flow: Text block `text-block-1` → Diagram `diagram-2`/);
  assert.match(handoff, /qualifies \(forward\): Text block `text-block-3` → Diagram `diagram-2` \/ slot `queue-entity` — Preserve retry uncertainty/);
  assert.match(handoff, /Diagram `diagram-2`: `browser` → `gateway` — initial request/);
  assert.match(handoff, /- Diagram: Start from the explanation goal/);
  assert.match(handoff, /Auto form .*Show system boundaries/);
  assert.ok(handoff.indexOf('## Deck plan') < handoff.indexOf('## Composition JSON'));
});
test('diagram handoff prioritizes intent and explicit notation over a preset without rewriting the document', () => {
  const document = structuredClone(fixtures['architecture-ownership']);
  const diagram = document.slides[0].components.find(component => component.kind === 'diagram');
  assert.ok(diagram);
  diagram.intent = 'Explain message order. Use a UML sequence diagram.';
  const before = canonicalJSON(toComposition(document));
  const handoff = compileHandoff(document);
  assert.match(handoff, /Explain message order\. Use a UML sequence diagram\./);
  assert.match(handoff, /Only selection auto delegates the form choice/);
  assert.match(handoff, /Honor notation explicitly requested in the intent or brief/);
  assert.match(handoff, /update the returned type while preserving auto/);
  assert.match(handoff, /preserve every node and render every directed, labeled edge exactly once/);
  assert.doesNotMatch(handoff, /Honor the selected semantic diagram grammar/);
  assert.equal(canonicalJSON(toComposition(document)), before);
});
test('explicit diagram forms are binding and unknown schema versions are rejected', () => {
  const doc = structuredClone(fixtures['architecture-ownership']);
  const diagram = doc.slides[0].components.find(c => c.kind === 'diagram');
  assert.ok(diagram);
  const created = createComponent('diagram', 1);
  assert.ok(created.kind === 'diagram');
  assert.equal(created.appearance.selection, 'auto');
  diagram.appearance.selection = 'explicit';
  assert.match(compileHandoff(doc), /Required form: Architecture \(ask before switching\)/);
  assert.match(compileHandoff(doc), /preserve its type and component kind, and do not reset it to auto/);
  delete diagram.appearance.selection;
  assert.match(compileHandoff(doc), /Required form: Architecture/);
  assert.equal(validateComposition({ ...doc, schema: 'konpeki-composition/v1' }).ok, false);
});
test('chart choices are auto by default and explicit templates require permission to switch', () => {
  const document = initialDraft();
  const chart = document.slides[0].components.find(c => c.kind === 'chart');
  assert.ok(chart);
  assert.equal(chart.appearance.selection, 'auto');
  assert.match(compileHandoff(document), /Auto chart form/);
  chart.appearance.selection = 'explicit';
  assert.match(compileHandoff(document), /Required chart form: Grouped bar \(ask before switching\)/);
  assert.match(compileHandoff(document), /preserve its template and component kind, and do not reset it to auto/);
  delete chart.appearance.selection;
  assert.match(compileHandoff(document), /Required chart form: Grouped bar/);
  assert.match(compileHandoff(document), /Auto does not authorize discarding topology/);
  for (const invalid of ['automatic', null, false]) {
    const candidate = JSON.parse(JSON.stringify(document));
    candidate.slides[0].components.find((c: { kind: string }) => c.kind === 'chart').appearance.selection = invalid;
    assert.equal(validateComposition(toComposition(candidate)).ok, false);
  }
});
test('visual selection import and JSON round trips preserve SVG, vectors, topology and geometry', () => {
  for (const kind of ['diagram', 'chart'] as const) {
    for (const format of ['vector'] as const) {
      const document = addComponent(initialDraft(true), kind);
      const component = document.slides[0].components[0];
      assert.ok(component.kind === 'diagram' || component.kind === 'chart');
      const source = '<svg viewBox="0 0 100 100"><rect id="box" x="5" y="5" width="90" height="90"/></svg>';
      component.customVisual = { format, ...parseEditableSvg(source), description: 'Preserved artwork' };
      if (component.kind === 'diagram') {
        component.topology = { kind: 'explicit', nodes: component.slotIds.map(id => ({ id, slotId: id })), edges: [] };
      }
      for (const selection of ['auto', 'explicit', undefined] as const) {
        if (selection) component.appearance.selection = selection;
        else delete component.appearance.selection;
        const result = validateComposition(JSON.parse(canonicalJSON(toComposition(document))));
        assert.ok(result.ok);
        if (result.ok) assert.deepEqual(result.document, toComposition(document));
      }
      assert.equal(component.appearance.selection, undefined, 'round trip must not mutate source');
    }
  }
});
test('public schema and runtime allow topology only for Sankey charts', () => {
  for (const template of chartTemplates) {
    const wire = toComposition(initialDraft()) as unknown as Record<string, any>;
    const chart = wire.slides[0].components[1];
    chart.appearance.template = template;
    chart.topology = {
      kind: 'explicit',
      nodes: [{ id: 'flow', slotId: chart.slotIds[0] }],
      edges: [],
    };
    assert.equal(validateSchema(wire), template === 'sankey', template);
    assert.equal(validateComposition(wire).ok, template === 'sankey', template);
    delete chart.topology;
    assert.equal(validateSchema(wire), true, `${template} without topology`);
    assert.equal(validateComposition(wire).ok, true, `${template} without topology`);
  }
});
test('current documents reject image as a chart template', () => {
  const current = toComposition(initialDraft()) as unknown as Record<string, any>;
  const visual = current.slides[0].components.find((component: any) => component.kind === 'chart');
  visual.appearance.template = 'image';
  assert.equal(validateSchema(current), false);
  assert.equal(validateComposition(current).ok, false);
});
test('empty slides are valid in both schema and runtime validators', () => {
  const draft = initialDraft();
  Object.assign(firstSlide(draft), {
    contentSlots: [], components: [], groups: [], readingOrder: [], paintOrder: [], relationships: [],
  });
  assert.equal(validateSchema(toComposition(draft)), true);
  assert.equal(validateComposition(toComposition(draft)).ok, true);
});
test('new components default to no outer border and resolve from the preset margin', () => {
  const draft = initialDraft();
  assert.deepEqual(firstSlide(draft).innerPadding, { top: 72, right: 72, bottom: 72, left: 72 });
  for (const [index, kind] of componentKinds.entries()) {
    const component = createComponent(kind, index + 20);
    assert.equal((component.appearance as { border?: string }).border, 'none');
  }
  const headline = firstSlide(draft).components.find(component => component.kind === 'text-block' && component.appearance.role === 'title')!;
  const footnote = firstSlide(draft).components.find(component => component.kind === 'text-block' && component.appearance.role === 'footnote')!;
  assert.equal(headline.preferredRect.x, 72);
  assert.equal(footnote.preferredRect.x, 72);
  assert.equal(headline.preferredRect.width, footnote.preferredRect.width);
  const wire = toComposition(draft);
  assert.equal('innerPadding' in wire.slides[0], false, 'derived preset padding is not authored');
  for (const component of wire.slides[0].components)
    delete (component.appearance as { border?: string }).border;
  assert.equal(validateSchema(wire), true, 'omitted borders use the default');
  assert.equal(validateComposition(wire).ok, true);
});
test('text layouts and slide page-number settings stay constrained and valid', () => {
  const text = createComponent('text-block', 20);
  assert.equal(text.kind, 'text-block');
  assert.deepEqual(text.appearance, {
    alignment: 'start', border: 'none', layout: 'single', orientation: 'horizontal',
    role: 'body', purpose: 'narrative', treatment: 'plain', logicalOrder: 'none', titleStyle: 'plain', rule: 'none',
  });
  const draft = addComponent(initialDraft(), 'text-block');
  firstSlide(draft).pageNumber = { style: '01/02', color: 'accent' };
  const textInDraft = firstSlide(draft).components.find(component => component.kind === 'text-block');
  if (textInDraft?.kind === 'text-block')
    textInDraft.appearance = { ...textInDraft.appearance, layout: 'one-plus-three', orientation: 'vertical' };
  assert.equal(validateComposition(toComposition(draft)).ok, true);
  if (textInDraft?.kind === 'text-block')
    textInDraft.appearance = { ...textInDraft.appearance, layout: 'two-plus-two' };
  assert.equal(validateComposition(toComposition(draft)).ok, true);
  if (textInDraft?.kind === 'text-block')
    textInDraft.appearance = { ...textInDraft.appearance, layout: 'four-column', logicalOrder: 'hierarchical' };
  assert.equal(validateComposition(toComposition(draft)).ok, true);
  firstSlide(draft).pageNumber = { style: '01', color: 'invented' as 'accent' };
  assert.equal(validateComposition(toComposition(draft)).ok, false);
});
test('chart, image, table and diagram-internal icon and shape primitives are valid', () => {
  let draft = initialDraft();
  const visual = firstSlide(draft).components.find(component => component.kind === 'chart');
  if (visual?.kind === 'chart') visual.appearance.template = 'pie';
  for (const kind of ['image', 'table', 'diagram'] as const) draft = addComponent(draft, kind);
  const roles = firstSlide(draft).contentSlots.map(slot => slot.role);
  assert.ok(roles.includes('image'));
  assert.ok(roles.includes('table'));
  const diagram = firstSlide(draft).components.find(component => component.kind === 'diagram');
  if (diagram?.kind === 'diagram') {
    diagram.topology = {
      kind: 'explicit',
      nodes: [{ id: 'icon', slotId: diagram.slotIds[0], primitive: { kind: 'icon', name: 'milestone' } }],
      edges: [],
    };
  }
  const table = firstSlide(draft).components.find(component => component.kind === 'table');
  assert.deepEqual(table?.appearance, {
    header: 'row', grid: 'none', border: 'none', density: 'sparse',
  });
  assert.deepEqual(tableAppearanceForStyle('top-header-bottom'), {
    header: 'both', grid: 'none', border: 'none',
  });
  assert.equal(tableStyleForAppearance({ header: 'both', grid: 'none' }), 'top-header-bottom');
  assert.equal(tableStyleForAppearance({ header: 'row', grid: 'all' }), 'full-grid');
  assert.match(compileHandoff(draft), /table style: header rule/);
  assert.match(compileHandoff(draft), /Table: Derive rows, columns and headers from the supplied table content/);
  assert.equal(validateSchema(toComposition(draft)), true);
  assert.equal(validateComposition(toComposition(draft)).ok, true);
  if (table?.kind === 'table') table.appearance = { ...table.appearance, header: 'invented' as 'row' };
  assert.equal(validateComposition(toComposition(draft)).ok, false);
});
test('theme contract covers trusted themes in both modes, independent from authoring mode', () => {
  const doc = initialDraft();
  for (const id of themeIds) for (const mode of ['paper', 'night'] as const) {
    doc.theme = { id, mode }; doc.authoringMode = 'dynamic';
    assert.equal(validateComposition(toComposition(doc)).ok, true);
  }
  assert.equal(validateSchema({ ...doc, theme: { id: 'invented', mode: 'paper' } }), false);
});
test('independent typography survives validation, handoff and both JSON storage formats', () => {
  const doc = initialDraft();
  for (const typography of typographyIds) {
    doc.theme = { id: 'precision', mode: 'night', typography };
    assert.equal(validateSchema(toComposition(doc)), true);
    assert.equal(validateComposition(toComposition(doc)).ok, true);
    assert.deepEqual(parseCompositionJSON(canonicalJSON(toComposition(doc))), { ok: true, document: resolveDocument(toComposition(doc)) });
    assert.deepEqual(parseStoredDraft(serializeDraft(doc)), { ok: true, draft: doc });
    assert.match(compileHandoff(doc), new RegExp(`"typography": "${typography}"`));
  }
  const invalid = toComposition(doc) as unknown as Record<string, any>;
  invalid.theme.typography = 'invented';
  assert.equal(validateSchema(invalid), false);
  assert.equal(validateComposition(invalid).ok, false);
});
test('Konpeki primary white text satisfies normal-text WCAG AA', () => {
  const linear = [0, 123, 187].map(v => v / 255 <= .04045 ? v / 255 / 12.92 : ((v / 255 + .055) / 1.055) ** 2.4);
  const ratio = 1.05 / (.2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2] + .05);
  assert.ok(ratio >= 4.5, `contrast ${ratio}`);
});
