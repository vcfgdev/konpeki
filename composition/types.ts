import type { ChartTemplate, DiagramType } from "./visualizations.ts";
export type { ChartTemplate, DiagramType } from "./visualizations.ts";

export const compositionSchema = "konpeki-composition/v18" as const;
export const legacyCompositionSchemas = [
  "konpeki-composition/v1",
  "konpeki-composition/v2",
  "konpeki-composition/v3",
  "konpeki-composition/v4",
  "konpeki-composition/v5",
  "konpeki-composition/v6",
  "konpeki-composition/v7",
  "konpeki-composition/v8",
  "konpeki-composition/v9",
  "konpeki-composition/v10",
  "konpeki-composition/v11",
  "konpeki-composition/v12",
  "konpeki-composition/v13",
  "konpeki-composition/v14",
  "konpeki-composition/v15",
  "konpeki-composition/v16",
  "konpeki-composition/v17",
] as const;
export type CanvasSize = { width: number; height: number };
export const canvasSize = { width: 1920, height: 1080 } as const;
export const canvasPadding = {
  top: 72,
  right: 112,
  bottom: 0,
  left: 112,
} as const;
export const authoringModes = ["default", "dynamic"] as const;
export type AuthoringMode = (typeof authoringModes)[number];
export const themeIds = [
  "plex",
  "precision",
  "editorial",
  "blue-cyan",
  "orange-coral",
  "yellow",
  "green",
  "graphite",
] as const;
export type ThemeId = (typeof themeIds)[number];
export const themeModes = ["paper", "night"] as const;
export type ThemeMode = (typeof themeModes)[number];
export type Rect = { x: number; y: number; width: number; height: number };
export type Alignment = "start" | "center" | "end";
export type TitleStyle = "plain" | "prominent";
export type BorderTreatment = "none" | "outline" | "filled";
export type TextColor = "ink" | "muted" | "accent";
export type TextLayout =
  | "single"
  | "two-column"
  | "three-column"
  | "two-plus-two"
  | "four-column"
  | "one-plus-three"
  | "three-plus-one";
export type TextPurpose = "narrative" | "comparison" | "emphasis";
export type TextTreatment = "plain" | "subtle" | "strong";
export type TextLogicalOrder =
  | "none"
  | "parallel"
  | "progressive"
  | "cyclical"
  | "general-to-specific"
  | "hierarchical";
export type TextRole = "title" | "subtitle" | "body" | "caption" | "footnote";
export type ColorScheme =
  | "monochrome"
  | "accent-with-muted-context"
  | "categorical"
  | "sequential"
  | "status";
export type Density = "sparse" | "standard";
export type Emphasis = "none" | "primary" | "latest-series" | "exception";
export const vectorElementKinds = [
  "g",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "path",
  "text",
  "tspan",
] as const;
export type VectorElementKind = (typeof vectorElementKinds)[number];
export type VectorElement = {
  id: string;
  kind: VectorElementKind;
  parentId?: string;
  attributes: Record<string, string | number>;
  text?: string;
};
type VisualBase = {
  viewBox: { x: number; y: number; width: number; height: number };
  description: string;
  fit?: "contain" | "cover" | "stretch";
};
export type CustomVisual = VisualBase & (
  | { format: "vector"; elements: VectorElement[] }
  | { format: "svg"; source: string }
);
type ComponentBase = {
  id: string;
  preferredRect: Rect;
  slotIds: string[];
  intent?: string;
  customVisual?: CustomVisual;
};
export type TextBlockComponent = ComponentBase & {
  kind: "text-block";
  content?: string;
  textStyle?: {
    size?: number;
    weight?: 400 | 500 | 600;
    lineHeight?: number;
    color?: "ink" | "muted" | "accent";
    font?: "heading" | "body";
  };
  appearance: {
    role: TextRole;
    alignment?: Alignment;
    border?: BorderTreatment;
    layout?: TextLayout;
    orientation?: "horizontal" | "vertical";
    purpose?: TextPurpose;
    treatment?: TextTreatment;
    logicalOrder?: TextLogicalOrder;
    titleStyle?: TitleStyle;
    rule?: "none" | "top" | "bottom";
  };
};
type ChartAppearance = {
  selection?: "auto" | "explicit";
  border?: BorderTreatment;
  colorScheme?: ColorScheme;
  orientation?: "horizontal" | "vertical";
  emphasis?: Emphasis;
  density?: Density;
  legend?: "none" | "top" | "right" | "bottom";
};
export type ChartComponent = ComponentBase & ({
  kind: "chart";
  appearance: ChartAppearance & { template: "sankey" };
  topology?: ExplicitTopology;
} | {
  kind: "chart";
  appearance: ChartAppearance & {
    template: Exclude<ChartTemplate, "sankey">;
  };
  topology?: never;
});
export type ExplicitTopology = {
  kind: "explicit";
  nodes: {
    id: string;
    slotId: string;
    visible?: boolean;
    preferredRect?: Rect;
    primitive?:
      | {
          kind: "shape";
          shape: "rectangle" | "rounded-rectangle" | "circle" | "line";
          color?: TextColor;
          fill?: "none" | "solid" | "wash";
        }
      | {
          kind: "icon";
          name?: string;
          style?: "outline" | "filled";
          color?: TextColor;
        };
  }[];
  edges: { from: string; to: string; label?: string }[];
};
export type DiagramComponent = ComponentBase & {
  kind: "diagram";
  appearance: {
    type: DiagramType;
    selection?: "auto" | "explicit";
    border?: BorderTreatment;
    colorScheme?: ColorScheme;
    emphasis?: Emphasis;
    density?: Density;
  };
  topology?: ExplicitTopology;
};
export type ImageComponent = ComponentBase & {
  kind: "image";
  appearance?: {
    border?: BorderTreatment;
    fit?: "cover" | "contain";
  };
};
export type TableComponent = ComponentBase & {
  kind: "table";
  appearance?: {
    header?: "none" | "row" | "column" | "both";
    grid?: "none" | "rows" | "all";
    border?: BorderTreatment;
    colorScheme?: ColorScheme;
    density?: Density;
  };
};
export type CompositionComponent =
  | TextBlockComponent
  | ChartComponent
  | DiagramComponent
  | ImageComponent
  | TableComponent;
export const componentKinds = [
  "text-block",
  "chart",
  "diagram",
  "image",
  "table",
] as const satisfies readonly CompositionComponent["kind"][];
export type ContentSlotRole =
  | "takeaway"
  | "body"
  | "evidence"
  | "comparison-item"
  | "process-step"
  | "entity"
  | "qualification"
  | "source"
  | "image"
  | "table";
type ContentSlotBase = {
  id: string;
  label: string;
  required: boolean;
  instruction: string;
};
export type ContentSlot =
  | (ContentSlotBase & {
      role: Exclude<ContentSlotRole, "qualification" | "source">;
    })
  | (ContentSlotBase & { role: "qualification" | "source"; targets: string[] });
export type ManipulationGroup = {
  id: string;
  label?: string;
  childIds: string[];
};
export type ReadingOrderEntry =
  { kind: "component"; id: string } | { kind: "group"; id: string };
export type RelationshipEndpoint = { nodeId: string; slotId?: string };
export type SemanticRelationship = {
  id: string;
  kind:
    "flows-to" | "qualifies" | "compares-with" | "depends-on" | "connects-to";
  direction: "forward" | "bidirectional" | "undirected";
  from: RelationshipEndpoint;
  to: RelationshipEndpoint;
  label?: string;
};
export type CompositionSlide = {
  id: string;
  name: string;
  canvas: CanvasSize;
  innerPadding?: { top: number; right: number; bottom: number; left: number };
  pageNumber?: {
    style: "none" | "01" | "01/02";
    color: TextColor;
  };
  audience: string;
  question: string;
  intendedViewingSize: "presentation" | "social" | "article" | "custom";
  contentSlots: ContentSlot[];
  components: CompositionComponent[];
  groups: ManipulationGroup[];
  readingOrder: ReadingOrderEntry[];
  paintOrder: string[];
  relationships: SemanticRelationship[];
};
export type CompositionDocument = {
  schema: typeof compositionSchema;
  title: string;
  authoringMode?: AuthoringMode;
  theme?: { id: ThemeId; mode: ThemeMode };
  slides: CompositionSlide[];
};
