import { compositionVocabulary } from "./schema.ts";
import { gridPresets, gridSchema, typeSteps } from "./grid.ts";
import { colorTokens, fontTokens } from "./theme-tokens.ts";

const literalVectorAttribute = { oneOf: [{ type: "string", maxLength: 10000, pattern: "^(?!theme:|scale:)" }, { type: "number" }] };

// Materialize the sole public contract from the shared semantic vocabulary.
const schema: any = structuredClone(compositionVocabulary);
schema.$id = "https://vcfgdev.github.io/konpeki/composition/v2/schema.json";
schema.title = gridSchema;
schema.properties.schema.const = gridSchema;
const slide = schema.properties.pages.items;
delete slide.properties.canvas;
delete slide.properties.innerPadding;
slide.required = slide.required.map((key: string) => key === "canvas" ? "grid" : key);
const defaultedSlideArrays = ["contentSlots", "groups", "relationships"];
slide.required = slide.required.filter((key: string) => !defaultedSlideArrays.includes(key) && key !== "readingOrder" && key !== "paintOrder");
for (const key of defaultedSlideArrays) {
  slide.properties[key].default = [];
  slide.properties[key].description = `Defaults to an empty ${key} array when omitted.`;
}
slide.properties.readingOrder.description = "Defaults to component entries in source component-array order when omitted.";
slide.properties.paintOrder.description = "Defaults to component IDs in source component-array order when omitted.";
slide.properties.grid = {
  type: "object", additionalProperties: false, required: ["preset"],
  properties: { preset: { enum: Object.keys(gridPresets) }, revision: { enum: [1, 2] } },
};
const gridInteger = { type: "integer", minimum: 1, maximum: 512 };
const gridColumn = { type: "number", minimum: 1, maximum: 512 };
const area = {
  type: "object", additionalProperties: false, required: ["column", "span", "row", "rows"],
  properties: { column: { anyOf: [gridColumn, { const: "center" }] }, span: gridColumn,
    row: { anyOf: [gridInteger, { const: "center" }] }, rows: gridInteger },
};
slide.properties.groups.items.properties.area = area;
slide.properties.groups.items.properties.verticalAlignment = { enum: ["start", "center", "end"] };
slide.properties.groups.items.properties.layout = { const: "stack" };
slide.properties.groups.items.properties.gap = { type: "number", minimum: 0, maximum: 4096 };
slide.properties.groups.items.allOf = [{
  if: { required: ["layout"] },
  then: { not: { required: ["verticalAlignment"] } },
  else: { dependentRequired: { area: ["verticalAlignment"], verticalAlignment: ["area"] }, not: { required: ["gap"] } },
}];
for (const component of slide.properties.components.items.oneOf) {
  delete component.properties.preferredRect;
  component.required = component.required.map((key: string) => key === "preferredRect" ? "area" : key);
  component.required = component.required.filter((key: string) => key !== "slotIds");
  component.properties.slotIds = structuredClone(component.properties.slotIds);
  component.properties.slotIds.minItems = 0;
  component.properties.slotIds.default = [];
  component.properties.slotIds.description = "Defaults to an empty array for components with no semantic content slots.";
  component.properties.area = area;
  component.properties.layer = { enum: ["background", "overlay"] };
  component.properties.padding = { type: "integer", minimum: 0, maximum: 24 };
  const style = component.properties.textStyle;
  if (style) {
    component.required = component.required.filter((key: string) => key !== "area");
    component.properties.flow = {
      type: "object", additionalProperties: false,
      properties: {
        gapBefore: { type: "number", minimum: 0, maximum: 4096 },
        offset: { type: "object", additionalProperties: false, required: ["x", "y"],
          properties: { x: { type: "number", minimum: -4096, maximum: 4096 }, y: { type: "number", minimum: -4096, maximum: 4096 } } },
      },
    };
    component.properties.appearance.properties.verticalAlignment = { enum: ["start", "center", "end"] };
    delete style.properties.size;
    delete style.properties.lineHeight;
    style.properties.step = { enum: typeSteps };
    style.properties.leading = { type: "integer", minimum: 1, maximum: 32 };
  }
  if (component.properties.topology) {
    component.properties.topology = structuredClone(component.properties.topology);
    delete component.properties.topology.properties.nodes.items.properties.preferredRect;
  }
  if (component.properties.kind.const === "diagram") {
    component.properties.processFlow = {
      type: "object", additionalProperties: false, required: ["direction"],
      properties: { direction: { enum: ["right", "down"] } },
    };
    component.properties.topology.properties.nodes.items.properties.position = {
      type: "object", additionalProperties: false, required: ["x", "y"],
      properties: { x: { type: "number" }, y: { type: "number" } },
    };
    component.properties.topology.properties.edges.items.properties.id = { type: "string", minLength: 1, maxLength: 120 };
  }
  const visual = component.properties.customVisual.oneOf[0];
  component.properties.customVisual = visual; // v2 artwork is editable, theme-bound vectors only.
  const attributes = visual.properties.elements.items.properties.attributes;
  const geometry = ["x", "y", "x1", "y1", "x2", "y2", "width", "height", "rx", "ry", "cx", "cy", "r", "d", "points", "fill-opacity", "stroke-width", "stroke-opacity", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "opacity", "vector-effect"];
  attributes.properties = Object.fromEntries(geometry.map(name => [name, literalVectorAttribute]));
  attributes.additionalProperties = false;
  for (const name of ["fill", "stroke", "color"]) attributes.properties[name] = { enum: ["none", "transparent", "currentColor", ...colorTokens.map(t => `theme:${t}`)] };
  attributes.properties["font-family"] = { enum: fontTokens.map(t => `theme:${t}`) };
  attributes.properties["font-size"] = { enum: typeSteps.map(t => `scale:${t}`) };
  attributes.properties["text-anchor"] = { enum: ["start", "middle", "end"] };
  attributes.properties["font-weight"] = { enum: [400, 500, 600, "400", "500", "600"] };
  attributes.properties["font-style"] = { enum: ["normal", "italic"] };
  visual.properties.elements.items.allOf = [
    {
      if: { properties: { kind: { enum: ["text", "tspan"] } } },
      then: { properties: { attributes: { propertyNames: { enum: ["x", "y", "text-anchor", "fill", "font-family", "font-size", "font-weight", "font-style"] } } } },
    },
    // Group opacity is an offscreen composite, not inherited per-shape alpha.
    // Until the scene supports composite groups, reject it rather than flatten it.
    {
      if: { properties: { kind: { const: "g" } } },
      then: { properties: { attributes: { not: { required: ["opacity"] } } } },
    },
  ];
}
// Older grid pages remain an import format. New pages author pixel geometry.
const legacySlide = structuredClone(slide);
const vocabularySlide: any = (compositionVocabulary.properties.pages as any).items;
delete slide.properties.grid;
slide.required = slide.required.filter((key: string) => key !== "grid");
slide.properties.canvas = structuredClone(vocabularySlide.properties.canvas);
for (const axis of ["width", "height"]) slide.properties.canvas.properties[axis].type = "number";
slide.properties.preset = { enum: Object.keys(gridPresets) };
slide.properties.innerPadding = structuredClone(vocabularySlide.properties.innerPadding);
slide.anyOf = [{ required: ["canvas"] }, { required: ["preset"] }];
const rect = structuredClone(vocabularySlide.properties.components.items.oneOf[0].properties.preferredRect);
const group = slide.properties.groups.items;
delete group.properties.area;
group.properties.rect = rect;
group.allOf = [{
  if: { required: ["layout"] },
  then: { not: { required: ["verticalAlignment"] } },
  else: { dependentRequired: { rect: ["verticalAlignment"], verticalAlignment: ["rect"] }, not: { required: ["gap"] } },
}];
for (const component of slide.properties.components.items.oneOf) {
  delete component.properties.area;
  component.required = component.required.map((key: string) => key === "area" ? "rect" : key);
  component.properties.rect = structuredClone(rect);
  component.properties.padding = { type: "number", minimum: 0, maximum: 4096 };
  if (component.properties.textStyle) {
    component.properties.rect.required = ["x", "y", "width"];
    component.properties.textStyle.properties.size = { type: "number", minimum: 1, maximum: 4096 };
    component.properties.textStyle.properties.leading = { type: "number", exclusiveMinimum: 0, maximum: 4096 };
  }
  component.properties.customVisual.properties.elements.items.properties.attributes.properties["font-size"] = {
    anyOf: [{ enum: typeSteps.map(t => `scale:${t}`) }, { type: "number", minimum: 1, maximum: 4096 }],
  };
}
schema.properties.pages.items = { oneOf: [slide, legacySlide] };
export { schema as schemaV2 };
