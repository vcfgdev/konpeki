import { schema as v1 } from "./schema.ts";
import { gridPresets, gridSchema, typeSteps } from "./grid.ts";
import { colorTokens, fontTokens } from "./theme-tokens.ts";

// Reuse the semantic vocabulary without ever mutating the published v1 schema.
// JSON-schema nodes are heterogeneous; this clone is deliberately data, not a
// second hand-maintained copy of every component and topology definition.
const schema: any = structuredClone(v1);
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
for (const component of slide.properties.components.items.oneOf) {
  delete component.properties.preferredRect;
  component.required = component.required.map((key: string) => key === "preferredRect" ? "area" : key);
  component.properties.area = {
    type: "object", additionalProperties: false, required: ["column", "span", "row", "rows"],
    properties: Object.fromEntries(["column", "span", "row", "rows"].map(key => [key, { type: "integer", minimum: 1, maximum: 512 }])),
  };
  component.properties.layer = { enum: ["background", "overlay"] };
  component.properties.padding = { type: "integer", minimum: 0, maximum: 24 };
  const style = component.properties.textStyle;
  if (style) {
    delete style.properties.size;
    delete style.properties.lineHeight;
    style.properties.step = { enum: typeSteps };
    style.properties.leading = { type: "integer", minimum: 1, maximum: 32 };
  }
  if (component.properties.topology) delete component.properties.topology.properties.nodes.items.properties.preferredRect;
  const visual = component.properties.customVisual.oneOf[0];
  component.properties.customVisual = visual; // v2 artwork is editable, theme-bound vectors only.
  const attributes = visual.properties.elements.items.properties.attributes;
  for (const name of ["fill", "stroke", "color"]) attributes.properties[name] = { enum: ["none", "transparent", "currentColor", ...colorTokens.map(t => `theme:${t}`)] };
  attributes.properties["font-family"] = { enum: fontTokens.map(t => `theme:${t}`) };
  attributes.properties["font-size"] = { enum: typeSteps.map(t => `scale:${t}`) };
}
export { schema as schemaV2 };
