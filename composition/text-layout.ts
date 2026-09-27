import LineBreaker from "linebreak";
import { Buffer, ClusterLevel, shape } from "harfbuzzjs";
import type { FontContext, LoadedFont } from "./fonts.ts";

export interface TextLayoutOptions {
  text: string; width: number; fontFamily: string; fontSize: number; lineHeight: number;
  fontWeight?: number; fontStyle?: "normal" | "italic"; align?: "left" | "center" | "right";
  wrap?: "pre-wrap" | "no-wrap"; overflowWrap?: "normal" | "anywhere";
}
export interface GlyphRecord {
  fontId: string; glyphId: number; x: number; y: number; xAdvance: number; yAdvance: number;
  xOffset: number; yOffset: number; clusterStart: number; clusterEnd: number;
}
export interface TextLine { text: string; start: number; end: number; x: number; top: number; baseline: number; width: number; glyphs: GlyphRecord[] }
export interface MissingGlyphDiagnostic { start: number; end: number; text: string; codePoints: number[] }
export interface TextLayout { width: number; height: number; ascent: number; descent: number; capHeight: number; lines: TextLine[]; missingGlyphs: MissingGlyphDiagnostic[] }

const graphemes = new Intl.Segmenter("und", { granularity: "grapheme" });
// Blink compares inline widths on a 1/64 CSS-pixel layout-unit grid. HarfBuzz
// returns the unquantized scaled advance, so allow one layout unit at an edge.
const chromiumLayoutUnit = 1 / 64;
const segments = (text: string, offset = 0) => [...graphemes.segment(text)].map(part => ({ start: offset + part.index, end: offset + part.index + part.segment.length, text: part.segment }));
const supported = (font: LoadedFont, text: string) => [...text].every(char => /[\uFE00-\uFE0F\u200D]/u.test(char) || font.hbFont.nominalGlyph(char.codePointAt(0)!) !== undefined);

function chooseRuns(context: FontContext, primary: LoadedFont, text: string, offset: number, missing: MissingGlyphDiagnostic[]) {
  const choices = [primary, ...context.fallbackFonts()];
  const units = segments(text, offset).map(unit => {
    const font = choices.find(candidate => supported(candidate, unit.text)) ?? primary;
    if (!choices.some(candidate => supported(candidate, unit.text))) missing.push({ start: unit.start, end: unit.end, text: unit.text, codePoints: [...unit.text].map(c => c.codePointAt(0)!) });
    return { ...unit, font };
  });
  const runs: { start: number; end: number; font: LoadedFont }[] = [];
  for (const unit of units) {
    const last = runs.at(-1);
    if (last?.font === unit.font && last.end === unit.start) last.end = unit.end;
    else runs.push({ start: unit.start, end: unit.end, font: unit.font });
  }
  return runs;
}

function shapeRange(context: FontContext, primary: LoadedFont, source: string, start: number, end: number, size: number, missing: MissingGlyphDiagnostic[]) {
  const glyphs: GlyphRecord[] = []; let pen = 0;
  for (const run of chooseRuns(context, primary, source.slice(start, end), start, missing)) {
    const value = source.slice(run.start, run.end), buffer = new Buffer();
    buffer.addText(value); buffer.setClusterLevel(ClusterLevel.MONOTONE_GRAPHEMES); buffer.guessSegmentProperties(); shape(run.font.hbFont, buffer);
    const raw = buffer.getGlyphInfosAndPositions();
    const starts = [...new Set(raw.map(g => run.start + g.cluster))].sort((a, b) => a - b);
    const scale = size / run.font.unitsPerEm;
    for (const item of raw) {
      const clusterStart = run.start + item.cluster, next = starts.find(value => value > clusterStart) ?? run.end;
      glyphs.push({ fontId: run.font.id, glyphId: item.codepoint, x: pen + (item.xOffset ?? 0) * scale, y: -(item.yOffset ?? 0) * scale,
        xAdvance: (item.xAdvance ?? 0) * scale, yAdvance: (item.yAdvance ?? 0) * scale,
        xOffset: (item.xOffset ?? 0) * scale, yOffset: (item.yOffset ?? 0) * scale, clusterStart, clusterEnd: next });
      pen += (item.xAdvance ?? 0) * scale;
    }
  }
  return { glyphs, width: pen };
}

export function layoutText(context: FontContext, options: TextLayoutOptions): TextLayout {
  const { text, width, fontFamily, fontSize, lineHeight } = options;
  if (!(width >= 0 && fontSize > 0 && lineHeight > 0)) throw new Error("width must be non-negative and fontSize/lineHeight positive");
  const primary = context.match(fontFamily, options.fontWeight, options.fontStyle), missingGlyphs: MissingGlyphDiagnostic[] = [];
  const breakSet = new Set<number>();
  const breaker = new LineBreaker(text);
  for (let br = breaker.nextBreak(); br; br = breaker.nextBreak()) breakSet.add(br.position);
  const boundaries = segments(text).map(segment => segment.end);
  const ranges: [number, number][] = [];
  // CSS segment breaks include CRLF as one break, and lone CR/LF as one code unit.
  const hardBreak = /\r\n|[\r\n]/g;
  const paragraphs: { start: number; end: number }[] = [];
  let paragraphStart = 0, match: RegExpExecArray | null;
  while ((match = hardBreak.exec(text))) {
    paragraphs.push({ start: paragraphStart, end: match.index });
    paragraphStart = match.index + match[0].length;
  }
  paragraphs.push({ start: paragraphStart, end: text.length });

  for (const paragraph of paragraphs) {
    let lineStart = paragraph.start;
    if (lineStart === paragraph.end) { ranges.push([lineStart, lineStart]); continue; }
    if (options.wrap === "no-wrap") { ranges.push([lineStart, paragraph.end]); continue; }
    while (lineStart < paragraph.end) {
      const ends = boundaries.filter(value => value > lineStart && value <= paragraph.end);
      let lastFit = lineStart;
      for (const end of ends) {
        // U+0020 at a pre-wrap line edge hangs: it remains shaped, but does not
        // consume the wrapping measure. Other preserved whitespace is measured.
        let measuredEnd = end;
        while (measuredEnd > lineStart && text[measuredEnd - 1] === " ") measuredEnd--;
        if (shapeRange(context, primary, text, lineStart, measuredEnd, fontSize, []).width <= width + chromiumLayoutUnit) lastFit = end;
        else break;
      }
      if (lastFit === paragraph.end) { ranges.push([lineStart, paragraph.end]); break; }
      const legalFit = [...breakSet].filter(value => value > lineStart && value <= lastFit && value <= paragraph.end).at(-1);
      let chosen = legalFit;
      if (chosen === undefined && options.overflowWrap === "anywhere") chosen = lastFit > lineStart ? lastFit : ends[0];
      if (chosen === undefined) chosen = [...breakSet].find(value => value > lineStart && value <= paragraph.end) ?? paragraph.end;
      ranges.push([lineStart, chosen]);
      lineStart = chosen;
    }
  }
  const firstBaseline = (lineHeight - (primary.ascent + primary.descent) * fontSize) / 2 + primary.ascent * fontSize;
  const lines = ranges.map(([start, end], index) => {
    const shaped = shapeRange(context, primary, text, start, end, fontSize, missingGlyphs);
    const x = options.align === "center" ? (width - shaped.width) / 2 : options.align === "right" ? width - shaped.width : 0;
    const baseline = firstBaseline + index * lineHeight;
    return { text: text.slice(start, end), start, end, x, top: index * lineHeight, baseline, width: shaped.width,
      glyphs: shaped.glyphs.map(glyph => ({ ...glyph, x: glyph.x + x, y: glyph.y + baseline })) };
  });
  return { width, height: lines.length * lineHeight, ascent: primary.ascent, descent: primary.descent, capHeight: primary.capHeight, lines, missingGlyphs };
}
