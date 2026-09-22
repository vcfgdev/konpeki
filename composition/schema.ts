import {
  authoringModes,
  componentKinds,
  compositionSchema,
  themeIds,
  themeModes,
  typographyIds,
  vectorElementKinds,
} from "./types.ts";
import { chartTemplates, diagramTypes } from "./visualizations.ts";
import { tokensForAttribute } from "./theme-tokens.ts";

const literalVectorAttribute = { oneOf: [{ type: "string", maxLength: 10000, pattern: "^(?!theme:)" }, { type: "number" }] };

// Shared constrained vocabulary for schema validation and canvas controls.
const alignment = ["start", "center", "end"];
const titleStyle = ["plain", "prominent"];
const border = ["none", "outline", "filled"];
const colorScheme = [
  "monochrome",
  "accent-with-muted-context",
  "categorical",
  "sequential",
  "status",
];
const emphasis = ["none", "primary", "latest-series", "exception"];
const density = ["sparse", "standard"];
export const tableStyles = [
  "header-rule",
  "top-header-bottom",
  "row-rules",
  "full-grid",
] as const;
export type TableStyle = (typeof tableStyles)[number];

export function tableAppearanceForStyle(style: TableStyle) {
  if (style === "top-header-bottom")
    return {
      header: "both" as const,
      grid: "none" as const,
      border: "none" as const,
    };
  if (style === "row-rules")
    return {
      header: "row" as const,
      grid: "rows" as const,
      border: "none" as const,
    };
  if (style === "full-grid")
    return {
      header: "row" as const,
      grid: "all" as const,
      border: "none" as const,
    };
  return {
    header: "row" as const,
    grid: "none" as const,
    border: "none" as const,
  };
}

export function tableStyleForAppearance(appearance?: {
  header?: string;
  grid?: string;
  border?: string;
}): TableStyle {
  if (appearance?.grid === "all" || appearance?.header === "column")
    return "full-grid";
  if (appearance?.grid === "rows") return "row-rules";
  if (appearance?.header === "both" || appearance?.border === "outline")
    return "top-header-bottom";
  return "header-rule";
}

export const appearanceOptions: Record<
  (typeof componentKinds)[number],
  Record<string, readonly string[]>
> = {
  "text-block": {
    role: ["title", "subtitle", "body", "caption", "footnote"],
    alignment,
    border,
    layout: [
      "single",
      "two-column",
      "three-column",
      "two-plus-two",
      "four-column",
      "one-plus-three",
      "three-plus-one",
    ],
    orientation: ["horizontal", "vertical"],
    purpose: ["narrative", "comparison", "emphasis"],
    treatment: ["plain", "subtle", "strong"],
    logicalOrder: [
      "none",
      "parallel",
      "progressive",
      "cyclical",
      "general-to-specific",
      "hierarchical",
    ],
    titleStyle,
    rule: ["none", "top", "bottom"],
  },
  chart: {
    template: chartTemplates,
    selection: ["auto", "explicit"],
    border,
    colorScheme,
    orientation: ["horizontal", "vertical"],
    emphasis,
    density,
    legend: ["none", "top", "right", "bottom"],
  },
  diagram: {
    type: diagramTypes,
    selection: ["auto", "explicit"],
    border,
    colorScheme,
    emphasis,
    density,
  },
  image: { border, fit: ["cover", "contain"] },
  table: {
    header: ["row", "none", "column", "both"],
    grid: ["none", "rows", "all"],
    border,
    colorScheme,
    density,
  },
};
const text = { type: "string", minLength: 1, pattern: "\\S" };
const string = { type: "string" };
const enumeration = (values: readonly string[]) => ({
  type: "string",
  enum: values,
});
const object = (
  properties: Record<string, unknown>,
  required = Object.keys(properties),
) => ({ type: "object", properties, required, additionalProperties: false });
const array = (items: unknown, minItems = 0) => ({
  type: "array",
  items,
  minItems,
});
const ids = { ...array(text, 1), uniqueItems: true };
const endpoint = object({ nodeId: text, slotId: text }, ["nodeId"]);
const rect = object({
  x: { type: "number", minimum: 0, maximum: 4096 },
  y: { type: "number", minimum: 0, maximum: 4096 },
  width: { type: "number", exclusiveMinimum: 0, maximum: 4096 },
  height: { type: "number", exclusiveMinimum: 0, maximum: 4096 },
});
const visualBase = {
  viewBox: object({
    x: { type: "number" },
    y: { type: "number" },
    width: { type: "number", exclusiveMinimum: 0, maximum: 100000 },
    height: { type: "number", exclusiveMinimum: 0, maximum: 100000 },
  }),
  description: { ...text, maxLength: 1000 },
  fit: enumeration(["contain", "cover", "stretch"]),
};
const customVisual = {
  oneOf: [
    object(
      {
        format: { const: "vector" },
        elements: {
          ...array(
            object(
              {
                id: text,
                kind: enumeration(vectorElementKinds),
                parentId: text,
                attributes: {
                  type: "object",
                  maxProperties: 40,
                  properties: Object.fromEntries(["fill", "stroke", "color", "font-family"].map((name) => [name, {
                    anyOf: [literalVectorAttribute, { enum: tokensForAttribute(name).map((token) => `theme:${token}`) }],
                  }])),
                  additionalProperties: literalVectorAttribute,
                },
                text: { type: "string", maxLength: 10000 },
              },
              ["id", "kind", "attributes"],
            ),
            0,
          ),
          maxItems: 2000,
        },
        ...visualBase,
      },
      ["format", "elements", "viewBox", "description"],
    ),
    object(
      {
        format: { const: "svg" },
        source: {
          type: "string",
          minLength: 1,
          maxLength: 500000,
          pattern: "^\\s*<svg(?:\\s|>)",
        },
        ...visualBase,
      },
      ["format", "source", "viewBox", "description"],
    ),
  ],
};
const topology = object({
  kind: { const: "explicit" },
  nodes: {
    ...array(object({
      id: text,
      slotId: text,
      visible: { type: "boolean" },
      preferredRect: rect,
      primitive: {
        oneOf: [
          object({
            kind: { const: "shape" },
            shape: enumeration(["rectangle", "rounded-rectangle", "circle", "line"]),
            color: enumeration(["ink", "muted", "accent"]),
            fill: enumeration(["none", "solid", "wash"]),
          }, ["kind", "shape"]),
          object({
            kind: { const: "icon" },
            name: text,
            style: enumeration(["outline", "filled"]),
            color: enumeration(["ink", "muted", "accent"]),
          }, ["kind"]),
        ],
      },
    }, ["id", "slotId"]), 1),
    maxItems: 24,
  },
  edges: {
    ...array(
      object({ from: text, to: text, label: { ...text, maxLength: 120 } }, [
        "from",
        "to",
      ]),
      0,
    ),
    maxItems: 48,
  },
});
const components = componentKinds.map((kind) => {
  const options = appearanceOptions[kind];
  const requiredAppearance = [
    ...(kind === "chart" ? ["template"] : []),
    ...(kind === "text-block" ? ["role"] : []),
    ...(kind === "diagram" ? ["type"] : []),
  ];
  const component = object(
    {
      id: text,
      kind: { const: kind },
      preferredRect: rect,
      slotIds: ids,
      intent: string,
      customVisual,
      ...(kind === "text-block" ? {
        content: { type: "string", maxLength: 50000 },
        textStyle: object({
          size: { type: "number", minimum: 8, maximum: 240 },
          weight: { enum: [400, 500, 600] },
          lineHeight: { type: "number", minimum: 1, maximum: 3 },
          color: enumeration(["ink", "muted", "accent"]),
          font: enumeration(["heading", "body"]),
        }, []),
      } : {}),
      appearance: object(
        Object.fromEntries(
          Object.entries(options).map(([key, values]) => [
            key,
            enumeration(values),
          ]),
        ),
        requiredAppearance,
      ),
      ...(kind === "diagram" || kind === "chart" ? { topology } : {}),
    },
    [
      "id",
      "kind",
      "preferredRect",
      "slotIds",
      ...(requiredAppearance.length ? ["appearance"] : []),
    ],
  );
  return kind === "chart"
    ? {
        ...component,
        allOf: [{
          if: { required: ["topology"] },
          then: {
            properties: {
              appearance: {
                properties: { template: { const: "sankey" } },
              },
            },
          },
        }],
      }
    : component;
});
export const schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://vcfgdev.github.io/konpeki/composition/v1/schema.json",
  title: compositionSchema,
  ...object(
    {
      schema: { const: compositionSchema },
      title: text,
      authoringMode: enumeration(authoringModes),
      theme: object({
        id: enumeration(themeIds),
        mode: enumeration(themeModes),
        typography: enumeration(typographyIds),
      }, ["id", "mode"]),
      slides: array(
        object(
          {
          id: text,
          name: text,
          canvas: object({
            width: { type: "integer", minimum: 256, maximum: 4096 },
            height: { type: "integer", minimum: 256, maximum: 4096 },
          }),
          innerPadding: object({
            top: { type: "number", minimum: 0 },
            right: { type: "number", minimum: 0 },
            bottom: { type: "number", minimum: 0 },
            left: { type: "number", minimum: 0 },
          }),
          pageNumber: object({
            style: enumeration(["none", "01", "01/02"]),
            color: enumeration(["ink", "muted", "accent"]),
          }),
          audience: text,
          question: text,
          intendedViewingSize: enumeration(["presentation", "social", "article", "custom"]),
          contentSlots: array(
            {
              oneOf: [
                object({
                  id: text,
                  label: text,
                  required: { type: "boolean" },
                  instruction: text,
                  role: enumeration([
                    "takeaway",
                    "body",
                    "evidence",
                    "comparison-item",
                    "process-step",
                    "entity",
                    "image",
                    "table",
                  ]),
                }),
                object({
                  id: text,
                  label: text,
                  required: { type: "boolean" },
                  instruction: text,
                  role: enumeration(["qualification", "source"]),
                  targets: ids,
                }),
              ],
            },
            0,
          ),
          components: array({ oneOf: components }, 0),
          groups: array(
            object({ id: text, label: string, childIds: ids }, [
              "id",
              "childIds",
            ]),
          ),
          readingOrder: {
            ...array(
              object({ kind: enumeration(["component", "group"]), id: text }),
              0,
            ),
            uniqueItems: true,
          },
          paintOrder: { ...array(text, 0), uniqueItems: true },
          relationships: array(
            object(
              {
                id: text,
                kind: enumeration([
                  "flows-to",
                  "qualifies",
                  "compares-with",
                  "depends-on",
                  "connects-to",
                ]),
                direction: enumeration([
                  "forward",
                  "bidirectional",
                  "undirected",
                ]),
                from: endpoint,
                to: endpoint,
                label: string,
              },
              ["id", "kind", "direction", "from", "to"],
            ),
          ),
          },
          [
          "id",
          "name",
          "canvas",
          "audience",
          "question",
          "intendedViewingSize",
          "contentSlots",
          "components",
          "groups",
          "readingOrder",
          "paintOrder",
          "relationships",
          ],
        ),
        1,
      ),
    },
    ["schema", "title", "slides"],
  ),
};
