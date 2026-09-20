export type DiagramLayoutEngine =
  | "linear"
  | "branching"
  | "cyclical"
  | "layered"
  | "request-flow"
  | "hub-and-spoke";

export type DiagramDefinition = {
  label: string;
  category:
    | "Systems & technical structure"
    | "Flow, interaction & behavior"
    | "Data & software modeling"
    | "Hierarchy, containment & organization"
    | "Time & work"
    | "Quantitative & analytical"
    | "Conceptual & strategic";
  layout: DiagramLayoutEngine;
  slotRole: "process-step" | "entity";
  expression: string;
};

export type ChartDefinition = {
  label: string;
  expression: string;
  source: "diagram-design" | "konpeki";
};

export const diagramDefinitions = {
  architecture: {
    label: "Architecture",
    category: "Systems & technical structure",
    layout: "hub-and-spoke",
    slotRole: "entity",
    expression: "Show system boundaries, responsibilities, interfaces, and directional communication without implying physical deployment.",
  },
  "it-current-state": {
    label: "IT current state",
    category: "Systems & technical structure",
    layout: "hub-and-spoke",
    slotRole: "entity",
    expression: "Show the systems that exist today, their ownership, integration paths, friction, duplication, and known constraints.",
  },
  "high-level": {
    label: "High-level overview",
    category: "Systems & technical structure",
    layout: "layered",
    slotRole: "entity",
    expression: "Reduce the system to a small number of named capabilities and major relationships; suppress implementation detail.",
  },
  deployment: {
    label: "Deployment",
    category: "Systems & technical structure",
    layout: "layered",
    slotRole: "entity",
    expression: "Place software artifacts inside the environments, hosts, zones, or runtimes where they execute and show cross-zone communication.",
  },
  flowchart: {
    label: "Flowchart",
    category: "Flow, interaction & behavior",
    layout: "branching",
    slotRole: "process-step",
    expression: "Distinguish actions, decisions, merge points, and start or end states; label decision branches explicitly.",
  },
  sequence: {
    label: "Sequence",
    category: "Flow, interaction & behavior",
    layout: "request-flow",
    slotRole: "entity",
    expression: "Order actors horizontally and messages vertically through time; distinguish calls, returns, asynchronous messages, and branches.",
  },
  "state-machine": {
    label: "State machine",
    category: "Flow, interaction & behavior",
    layout: "branching",
    slotRole: "entity",
    expression: "Treat nodes as legal states and edges as guarded transitions; preserve initial, terminal, retry, and invalid transition semantics.",
  },
  swimlane: {
    label: "Swimlane",
    category: "Flow, interaction & behavior",
    layout: "layered",
    slotRole: "process-step",
    expression: "Partition steps by responsible actor or team and make every cross-lane handoff visible.",
  },
  process: {
    label: "Process",
    category: "Flow, interaction & behavior",
    layout: "linear",
    slotRole: "process-step",
    expression: "Show ordered work from trigger to outcome, including branches, loops, owners, and exceptional paths when supplied.",
  },
  "data-flow": {
    label: "Data flow",
    category: "Flow, interaction & behavior",
    layout: "hub-and-spoke",
    slotRole: "entity",
    expression: "Show data producers, transformations, stores, and consumers; label payloads and direction independently from control flow.",
  },
  "dp-integration": {
    label: "Data-product integration",
    category: "Flow, interaction & behavior",
    layout: "request-flow",
    slotRole: "entity",
    expression: "Show producer and consumer responsibilities, contracts, integration boundaries, and exchange direction for each data product.",
  },
  "er-data-model": {
    label: "ER / data model",
    category: "Data & software modeling",
    layout: "hub-and-spoke",
    slotRole: "entity",
    expression: "Represent entities with key attributes and label relationship cardinality and optionality at both endpoints.",
  },
  medallion: {
    label: "Medallion",
    category: "Data & software modeling",
    layout: "layered",
    slotRole: "entity",
    expression: "Arrange data products by progressive quality tier and show transformations from raw through refined to consumption-ready data.",
  },
  "dp-security-matrix": {
    label: "Data-product security matrix",
    category: "Data & software modeling",
    layout: "layered",
    slotRole: "entity",
    expression: "Use rows and columns as explicit subject and resource axes; encode permissions or controls at their intersections.",
  },
  "dependency-graph": {
    label: "Dependency graph",
    category: "Data & software modeling",
    layout: "branching",
    slotRole: "entity",
    expression: "Preserve many-parent fan-in, shared dependencies, and cycles; orient every dependency edge consistently.",
  },
  "uml-class": {
    label: "UML class",
    category: "Data & software modeling",
    layout: "hub-and-spoke",
    slotRole: "entity",
    expression: "Keep class names, attributes, and operations in separate compartments and preserve inheritance, aggregation, and composition notation.",
  },
  "database-schema": {
    label: "Database schema",
    category: "Data & software modeling",
    layout: "hub-and-spoke",
    slotRole: "entity",
    expression: "Show tables with typed columns, keys, constraints, and column-level foreign-key endpoints.",
  },
  nested: {
    label: "Nested containment",
    category: "Hierarchy, containment & organization",
    layout: "layered",
    slotRole: "entity",
    expression: "Use enclosure to express scope and ownership; containment must not be replaced by proximity alone.",
  },
  tree: {
    label: "Tree",
    category: "Hierarchy, containment & organization",
    layout: "branching",
    slotRole: "entity",
    expression: "Show a strict one-parent hierarchy with consistent depth and sibling ordering.",
  },
  "org-chart": {
    label: "Org chart",
    category: "Hierarchy, containment & organization",
    layout: "branching",
    slotRole: "entity",
    expression: "Show reporting structure, role ownership, and escalation paths; do not imply technical dependency.",
  },
  "layer-stack": {
    label: "Layer stack",
    category: "Hierarchy, containment & organization",
    layout: "layered",
    slotRole: "entity",
    expression: "Order abstraction or responsibility layers consistently and show only legitimate cross-layer dependencies.",
  },
  "pyramid-funnel": {
    label: "Pyramid / funnel",
    category: "Hierarchy, containment & organization",
    layout: "layered",
    slotRole: "entity",
    expression: "Use width and vertical order to encode rank, concentration, or drop-off; state which meaning applies.",
  },
  timeline: {
    label: "Timeline",
    category: "Time & work",
    layout: "linear",
    slotRole: "process-step",
    expression: "Place dated events on an honest temporal axis and preserve meaningful interval differences.",
  },
  gantt: {
    label: "Gantt",
    category: "Time & work",
    layout: "layered",
    slotRole: "process-step",
    expression: "Encode task start, duration, overlap, milestones, dependencies, and ownership against a shared time scale.",
  },
  kanban: {
    label: "Kanban",
    category: "Time & work",
    layout: "layered",
    slotRole: "entity",
    expression: "Use columns as workflow states, preserve card ownership and priority, and show WIP limits when supplied.",
  },
  "user-journey": {
    label: "User journey",
    category: "Time & work",
    layout: "linear",
    slotRole: "process-step",
    expression: "Order experience stages and align actions, touchpoints, pain points, and sentiment to each stage.",
  },
  "story-map": {
    label: "Story map",
    category: "Time & work",
    layout: "layered",
    slotRole: "entity",
    expression: "Use columns for narrative activity order and rows for release slices; preserve the release-cut line.",
  },
  quadrant: {
    label: "Quadrant",
    category: "Quantitative & analytical",
    layout: "layered",
    slotRole: "entity",
    expression: "Position items against two named axes with meaningful scales and make quadrant interpretation explicit.",
  },
  "loop-flywheel": {
    label: "Loop / flywheel",
    category: "Conceptual & strategic",
    layout: "cyclical",
    slotRole: "process-step",
    expression: "Show a reinforcing cycle with explicit direction and explain how each stage increases momentum or feeds the next.",
  },
  venn: {
    label: "Venn",
    category: "Conceptual & strategic",
    layout: "hub-and-spoke",
    slotRole: "entity",
    expression: "Use overlapping regions to encode set membership and label every meaningful intersection.",
  },
  fishbone: {
    label: "Fishbone",
    category: "Conceptual & strategic",
    layout: "branching",
    slotRole: "entity",
    expression: "Group candidate causes by category along branches that converge on one clearly stated effect.",
  },
  "wardley-map": {
    label: "Wardley map",
    category: "Conceptual & strategic",
    layout: "layered",
    slotRole: "entity",
    expression: "Position components by user visibility and evolution, then show value-chain dependencies and movement without treating the map as runtime architecture.",
  },
} as const satisfies Record<string, DiagramDefinition>;

export type DiagramType = keyof typeof diagramDefinitions;

export const diagramTypes = Object.keys(diagramDefinitions) as DiagramType[];

export const chartDefinitions = {
  "grouped-bar": {
    label: "Grouped bar",
    expression: "Compare quantitative values across categories with a shared zero baseline; use grouped series only when each category has comparable values.",
    source: "diagram-design",
  },
  line: {
    label: "Line",
    expression: "Encode values on a shared scale and connect observations in meaningful order, usually time; preserve intervals and do not imply missing measurements.",
    source: "diagram-design",
  },
  pie: {
    label: "Pie",
    expression: "Show a small set of mutually exclusive parts of one whole; preserve the total and label values directly when comparison by angle is difficult.",
    source: "konpeki",
  },
  "annotated-detail": {
    label: "Annotated detail",
    expression: "Focus on one visual detail and connect concise annotations to exact evidence without obscuring the underlying image or chart.",
    source: "konpeki",
  },
  radar: {
    label: "Radar",
    expression: "Compare multivariate profiles on consistently normalized radial axes; preserve axis order, scale, and direction across every series.",
    source: "diagram-design",
  },
  treemap: {
    label: "Treemap",
    expression: "Encode part-to-whole magnitude by rectangle area within explicit hierarchy; preserve parent totals and avoid implying rank from position.",
    source: "diagram-design",
  },
  scatter: {
    label: "Scatter",
    expression: "Position observations by two measured quantitative variables; preserve axis scales, units, outliers, and uncertainty about correlation.",
    source: "diagram-design",
  },
  sankey: {
    label: "Sankey",
    expression: "Encode conserved quantity through splits and merges using proportional ribbon width; preserve node totals, flow direction, and units.",
    source: "diagram-design",
  },
} as const satisfies Record<string, ChartDefinition>;

export type ChartTemplate = keyof typeof chartDefinitions;

export const chartTemplates = Object.keys(chartDefinitions) as ChartTemplate[];

export const visualizationDefinitions = {
  diagram: diagramDefinitions,
  chart: chartDefinitions,
} as const;

export const diagramCategories = Array.from(
  new Set(Object.values(diagramDefinitions).map((definition) => definition.category)),
);

export function diagramDefinition(type: DiagramType): DiagramDefinition {
  return diagramDefinitions[type];
}

export function migrateLegacyDiagramType(
  type: unknown,
  layout: unknown,
): DiagramType | undefined {
  if (typeof type !== "string" || typeof layout !== "string") return undefined;
  const legacyTypes: Record<string, DiagramType> = {
    "process/linear": "process",
    "process/branching": "flowchart",
    "process/cyclical": "loop-flywheel",
    "system/layered": "layer-stack",
    "system/request-flow": "sequence",
    "system/hub-and-spoke": "architecture",
  };
  return legacyTypes[`${type}/${layout}`];
}
