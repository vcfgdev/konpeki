import { compositionVocabulary } from "./schema.ts";
import { gridPresets, gridSchema, typeSteps } from "./grid.ts";
import { colorTokens, fontTokens } from "./theme-tokens.ts";

const literalVectorAttribute = { oneOf: [{ type: "string", maxLength: 10000, pattern: "^(?!theme:|scale:)" }, { type: "number" }] };

// Materialize the sole public contract from the shared semantic vocabulary.
const schema: any = structuredClone(compositionVocabulary);
schema.$id = "https://vcfgdev.github.io/konpeki/composition/v2/schema.json";
schema.title = gridSchema;
schema.properties.schema.const = gridSchema;
const slide = schema.properties.slides.items;
delete slide.properties.canvas;
delete slide.properties.innerPadding;
slide.required = slide.required.map((key: string) => key === "canvas" ? "grid" : key);
slide.properties.grid = {
  type: "object", additionalProperties: false, required: ["preset"],
  properties: { preset: { enum: Object.keys(gridPresets) } },
};
const gridInteger = { type: "integer", minimum: 1, maximum: 512 };
const area = {
  type: "object", additionalProperties: false, required: ["column", "span", "row", "rows"],
  properties: { column: { anyOf: [gridInteger, { const: "center" }] }, span: gridInteger,
    row: { anyOf: [gridInteger, { const: "center" }] }, rows: gridInteger },
};
slide.properties.groups.items.properties.area = area;
slide.properties.groups.items.properties.verticalAlignment = { enum: ["start", "center", "end"] };
slide.properties.groups.items.dependentRequired = { area: ["verticalAlignment"], verticalAlignment: ["area"] };
for (const component of slide.properties.components.items.oneOf) {
  delete component.properties.preferredRect;
  component.required = component.required.map((key: string) => key === "preferredRect" ? "area" : key);
  component.properties.area = area;
  component.properties.layer = { enum: ["background", "overlay"] };
  component.properties.padding = { type: "integer", minimum: 0, maximum: 24 };
  const style = component.properties.textStyle;
  if (style) {
    component.properties.appearance.properties.verticalAlignment = { enum: ["start", "center", "end"] };
    delete style.properties.size;
    delete style.properties.lineHeight;
    style.properties.step = { enum: typeSteps };
    style.properties.leading = { type: "integer", minimum: 1, maximum: 32 };
  }
  if (component.properties.topology) delete component.properties.topology.properties.nodes.items.properties.preferredRect;
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
export { schema as schemaV2 };
