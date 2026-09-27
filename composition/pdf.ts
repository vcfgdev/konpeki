import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument, PDFHexString, PDFName, PDFOperator, PDFOperatorNames, PDFRef, PDFString, degrees, drawSvgPath, rgb,
  concatTransformationMatrix, endMarkedContent, popGraphicsState, pushGraphicsState,
  rectangle, clip, endPath, setFillingRgbColor, setGraphicsState,
  beginText, endText, setFontAndSize, setTextMatrix, showText, fill,
  LineCapStyle, LineJoinStyle, setDashPattern, setLineCap, setLineJoin,
} from "pdf-lib";
import type { FontContext } from "./fonts.ts";
import type { ScenePage, SceneShape, SceneText } from "./scene.ts";

const PX_TO_PT = 0.75;
const n = (value: string | number | undefined, fallback = 0) => value === undefined ? fallback : Number(value);
const escName = (value: string) => value.replace(/[^A-Za-z0-9]/g, "_");
const hex = (value: string | number | undefined): [number, number, number] | undefined => {
  if (typeof value !== "string" || value === "none") return undefined;
  const match = /^#([\da-f]{6})$/i.exec(value);
  if (!match) throw new Error(`PDF writer requires resolved six-digit hex colors, got ${value}`);
  return [0, 2, 4].map(index => parseInt(match[1].slice(index, index + 2), 16) / 255) as [number, number, number];
};
const utf16 = (value: string, byteOrderMark = false) => {
  let result = byteOrderMark ? "FEFF" : "";
  for (let index = 0; index < value.length; index++) result += value.charCodeAt(index).toString(16).padStart(4, "0").toUpperCase();
  return result;
};
const subsetName = (fontId: string) => {
  // ISO 32000 requires a six-uppercase-letter subset tag. Keep it deterministic.
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(fontId)) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  let tag = "";
  for (let index = 0; index < 6; index++) { tag += String.fromCharCode(65 + hash % 26); hash = Math.floor(hash / 26); }
  return `${tag}+${escName(fontId)}`;
};
const subsetBytes = (subset: ReturnType<ReturnType<typeof fontkit.create>["createSubset"]>) => new Promise<Uint8Array>((resolve, reject) => {
  const parts: Uint8Array[] = [];
  subset.encodeStream().on("data", part => parts.push(part)).on("end", () => {
    const size = parts.reduce((sum, part) => sum + part.length, 0), result = new Uint8Array(size);
    let offset = 0; for (const part of parts) { result.set(part, offset); offset += part.length; } resolve(result);
  }).on("error" as "end", reject);
});

type Use = { gid: number; text: string; cid: number; subsetGid?: number };
type Embedded = { name: PDFName; byKey: Map<string, Use>; ref: PDFRef };

function shapePath(shape: SceneShape) {
  const a = shape.attributes, x = n(a.x), y = n(a.y), width = n(a.width), height = n(a.height);
  switch (shape.tag) {
    case "rect": {
      const rx = Math.min(n(a.rx, n(a.ry)), width / 2), ry = Math.min(n(a.ry, rx), height / 2);
      return rx || ry ? `M${x + rx} ${y}H${x + width - rx}A${rx} ${ry} 0 0 1 ${x + width} ${y + ry}V${y + height - ry}A${rx} ${ry} 0 0 1 ${x + width - rx} ${y + height}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + height - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z` : `M${x} ${y}h${width}v${height}h${-width}Z`;
    }
    case "circle": { const cx = n(a.cx), cy = n(a.cy), r = n(a.r); return `M${cx-r} ${cy}a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0Z`; }
    case "ellipse": { const cx = n(a.cx), cy = n(a.cy), rx = n(a.rx), ry = n(a.ry); return `M${cx-rx} ${cy}a${rx} ${ry} 0 1 0 ${2*rx} 0a${rx} ${ry} 0 1 0 ${-2*rx} 0Z`; }
    case "line": return `M${n(a.x1)} ${n(a.y1)}L${n(a.x2)} ${n(a.y2)}`;
    case "polyline":
    case "polygon": {
      const points = String(a.points ?? "").trim().split(/[ ,\s]+/).map(Number);
      return points.map((x, index) => index % 2 ? "" : `${index ? "L" : "M"}${x} ${points[index + 1]}`).join("") + (shape.tag === "polygon" ? "Z" : "");
    }
    case "path": return String(a.d ?? "");
  }
}

function clipping(item: { clip?: { x: number; y: number; width: number; height: number } }) {
  return item.clip ? [rectangle(item.clip.x, item.clip.y, item.clip.width, item.clip.height), clip(), endPath()] : [];
}

/** Render an owned scene without re-shaping its HarfBuzz glyph stream. */
export async function renderPDF(pages: ScenePage[], fonts: FontContext): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const uses = new Map<string, Map<string, Use>>();
  for (const page of pages) for (const item of page.items) if (item.kind === "text") for (const line of item.layout.lines) for (const glyph of line.glyphs) {
    const text = item.source.slice(glyph.clusterStart, glyph.clusterEnd), map = uses.get(glyph.fontId) ?? new Map<string, Use>();
    uses.set(glyph.fontId, map); const key = `${glyph.glyphId}\0${text}`;
    if (!map.has(key)) map.set(key, { gid: glyph.glyphId, text, cid: map.size + 1 });
  }
  const embedded = new Map<string, Embedded>();
  for (const [fontId, byKey] of uses) {
    const loaded = fonts.fonts.get(fontId); if (!loaded) throw new Error(`Unknown font id: ${fontId}`);
    const parsed = fontkit.create(loaded.data), subset = parsed.createSubset(); subset.includeGlyph(0);
    for (const use of byKey.values()) use.subsetGid = subset.includeGlyph(parsed.getGlyph(use.gid));
    const data = await subsetBytes(subset), context = pdf.context, base = subsetName(fontId);
    const fontFile = context.register(context.flateStream(data));
    const scale = 1000 / parsed.unitsPerEm, bbox = parsed.bbox;
    const descriptor = context.register(context.obj({ Type: "FontDescriptor", FontName: base, Flags: 4, FontBBox: [bbox.minX*scale,bbox.minY*scale,bbox.maxX*scale,bbox.maxY*scale], ItalicAngle: parsed.italicAngle || 0, Ascent: parsed.ascent*scale, Descent: parsed.descent*scale, CapHeight: (parsed.capHeight || parsed.ascent)*scale, StemV: 0, FontFile2: fontFile }));
    const max = byKey.size, gidMap = new Uint8Array((max + 1) * 2), widths: any[] = [];
    for (const use of byKey.values()) { gidMap[use.cid*2] = use.subsetGid! >> 8; gidMap[use.cid*2+1] = use.subsetGid! & 255; widths.push(use.cid, [parsed.getGlyph(use.gid).advanceWidth * scale]); }
    const cidFont = context.register(context.obj({ Type: "Font", Subtype: "CIDFontType2", BaseFont: base, CIDSystemInfo: { Registry: PDFString.of("Adobe"), Ordering: PDFString.of("Identity"), Supplement: 0 }, FontDescriptor: descriptor, CIDToGIDMap: context.register(context.flateStream(gidMap)), W: widths }));
    const mappings = [...byKey.values()].map(use => `<${use.cid.toString(16).padStart(4,"0")}> <${utf16(use.text)}>`).join("\n");
    const cmap = `/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Adobe-Identity-UCS def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange ${max} beginbfchar\n${mappings}\nendbfchar endcmap CMapName currentdict /CMap defineresource pop end end`;
    const fontRef = context.register(context.obj({ Type: "Font", Subtype: "Type0", BaseFont: base, Encoding: "Identity-H", DescendantFonts: [cidFont], ToUnicode: context.register(context.flateStream(cmap)) }));
    embedded.set(fontId, { name: PDFName.of(`F${embedded.size + 1}`), byKey, ref: fontRef });
  }
  for (const scene of pages) {
    const page = pdf.addPage([scene.width * PX_TO_PT, scene.height * PX_TO_PT]);
    for (const font of embedded.values()) page.node.setFontDictionary(font.name, font.ref);
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(PX_TO_PT, 0, 0, -PX_TO_PT, 0, scene.height * PX_TO_PT));
    const bg = hex(scene.background); if (bg) page.pushOperators(setFillingRgbColor(...bg), rectangle(0, 0, scene.width, scene.height), fill());
    for (const item of scene.items) item.kind === "shape" ? drawShape(pdf, page, item) : drawText(pdf, page, item, embedded);
    page.pushOperators(popGraphicsState());
  }
  return pdf.save({ useObjectStreams: false });
}

function drawShape(pdf: PDFDocument, page: ReturnType<PDFDocument["addPage"]>, shape: SceneShape) {
  const fill = hex(shape.attributes.fill), stroke = hex(shape.attributes.stroke);
  const [a, b, c, d] = shape.transform;
  const strokeScale = shape.attributes["vector-effect"] === "non-scaling-stroke" ? Math.sqrt(Math.abs(a * d - b * c)) || 1 : 1;
  const width = n(shape.attributes["stroke-width"], 1) / strokeScale;
  const opacity = n(shape.attributes.opacity, 1), fillOpacity = opacity * n(shape.attributes["fill-opacity"], 1), strokeOpacity = opacity * n(shape.attributes["stroke-opacity"], 1);
  const gsName = page.node.newExtGState("GS", pdf.context.obj({ Type: "ExtGState", ca: fillOpacity, CA: strokeOpacity }));
  page.pushOperators(pushGraphicsState(), ...clipping(shape), concatTransformationMatrix(...shape.transform), concatTransformationMatrix(1,0,0,-1,0,0));
  const cap = String(shape.attributes["stroke-linecap"] ?? "butt");
  const join = String(shape.attributes["stroke-linejoin"] ?? "miter");
  const dash = String(shape.attributes["stroke-dasharray"] ?? "").trim();
  const lineCap = cap === "round" ? LineCapStyle.Round : cap === "square" ? LineCapStyle.Projecting : LineCapStyle.Butt;
  const dashArray = dash && dash !== "none" ? dash.split(/[ ,]+/).map(Number).map(value => value / strokeScale) : [];
  page.pushOperators(
    setLineCap(lineCap),
    setLineJoin(join === "round" ? LineJoinStyle.Round : join === "bevel" ? LineJoinStyle.Bevel : LineJoinStyle.Miter),
    setDashPattern(dashArray, 0),
  );
  page.pushOperators(...drawSvgPath(shapePath(shape), { x: 0, y: 0, scale: 1, color: fill ? rgb(...fill) : undefined, borderColor: stroke ? rgb(...stroke) : undefined, borderWidth: stroke ? width : 0, borderLineCap: lineCap, borderDashArray: dashArray, rotate: degrees(0), graphicsState: gsName }));
  page.pushOperators(popGraphicsState());
}

function drawText(pdf: PDFDocument, page: ReturnType<PDFDocument["addPage"]>, text: SceneText, fonts: Map<string, Embedded>) {
  const color = hex(text.color)!; const gsName = page.node.newExtGState("GS", pdf.context.obj({ Type: "ExtGState", ca: text.opacity, CA: text.opacity }));
  page.pushOperators(pushGraphicsState(), ...clipping(text), setGraphicsState(gsName), setFillingRgbColor(...color));
  for (const line of text.layout.lines) {
    let active = "";
    for (const glyph of line.glyphs) {
      const source = text.source.slice(glyph.clusterStart, glyph.clusterEnd), cluster = `${glyph.clusterStart}:${glyph.clusterEnd}`;
      if (cluster !== active) { if (active) page.pushOperators(endMarkedContent()); page.pushOperators(PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [PDFName.of("Span"), pdf.context.obj({ ActualText: PDFHexString.of(utf16(source, true)) }) as any])); active = cluster; }
      const font = fonts.get(glyph.fontId)!; const use = font.byKey.get(`${glyph.glyphId}\0${source}`)!;
      page.pushOperators(beginText(), setFontAndSize(font.name, text.fontSize), setTextMatrix(1,0,0,-1,text.box.x + glyph.x,text.box.y + glyph.y), showText(PDFHexString.of(use.cid.toString(16).padStart(4,"0"))), endText());
    }
    if (active) page.pushOperators(endMarkedContent());
  }
  page.pushOperators(popGraphicsState());
}
