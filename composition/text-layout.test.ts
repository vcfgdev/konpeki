import test from "node:test";
import assert from "node:assert/strict";
import { loadNodeFontContext } from "./fonts.ts";
import { layoutText } from "./text-layout.ts";

const context = await loadNodeFontContext(new URL("../fonts/", import.meta.url));
const options = { fontFamily: "IBM Plex Sans", fontSize: 20, lineHeight: 28, width: 100 };

test("shapes ligatures with source cluster ranges and deterministic baseline", () => {
  const result = layoutText(context, { ...options, text: "office" });
  assert.equal(result.lines.length, 1);
  assert.ok(result.lines[0].glyphs.length < 6, "HarfBuzz formed a ligature");
  assert.ok(result.lines[0].glyphs.some(glyph => glyph.clusterEnd - glyph.clusterStart > 1));
  assert.equal(result.lines[0].baseline, (28 - (result.ascent + result.descent) * 20) / 2 + result.ascent * 20);
  assert.match(context.glyphOutline(result.lines[0].glyphs[0].fontId, result.lines[0].glyphs[0].glyphId), /^M/);
  assert.ok(context.getBytes(result.lines[0].glyphs[0].fontId).byteLength > 1000);
});

test("wraps only at grapheme boundaries and preserves explicit empty lines", () => {
  const text = "Cafe\u0301 extraordinarily\n\nend\n";
  const result = layoutText(context, { ...options, width: 55, text, overflowWrap: "anywhere" });
  assert.equal(result.lines.at(-1)?.text, "");
  assert.ok(result.lines.some(line => line.text === ""));
  assert.ok(result.lines.every(line => !line.text.startsWith("\u0301")));
  assert.equal(result.lines.map(line => line.text).join("").replaceAll("\n", ""), text.replaceAll("\n", ""));
});

test("uses symbol fallback by whole grapheme and diagnoses truly missing glyphs", () => {
  const result = layoutText(context, { ...options, text: "A ★ B \u{10FFFF}" });
  const star = result.lines[0].glyphs.find(glyph => glyph.clusterStart === 2);
  assert.match(star?.fontId ?? "", /symbols/);
  assert.deepEqual(result.missingGlyphs.map(item => item.text), ["\u{10FFFF}"]);
});

test("uses the ordinary Noto Symbols fallback for U+2192", () => {
  const result = layoutText(context, { ...options, text: "A → B" });
  const arrow = result.lines[0].glyphs.find(glyph => glyph.clusterStart === 2);
  assert.equal(arrow?.fontId, "noto-sans-symbols-400-normal");
  assert.deepEqual(result.missingGlyphs, []);
});

test("supports no-wrap and alignment", () => {
  const result = layoutText(context, { ...options, text: "a label that is wider", width: 20, wrap: "no-wrap", align: "right" });
  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0].x, 20 - result.lines[0].width);
});

test("uses UAX14 opportunities before overflow-wrap:anywhere", () => {
  const normal = layoutText(context, { ...options, text: "alpha extraordinarily", width: 60, overflowWrap: "normal" });
  const anywhere = layoutText(context, { ...options, text: "alpha extraordinarily", width: 60, overflowWrap: "anywhere" });
  assert.deepEqual(normal.lines.map(line => line.text), ["alpha ", "extraordinarily"]);
  assert.ok(anywhere.lines.length > normal.lines.length);
  assert.equal(anywhere.lines.map(line => line.text).join(""), "alpha extraordinarily");
});

test("matches Chromium's 1/64px line-wrap boundary", () => {
  const below = layoutText(context, { ...options, text: "alpha beta", width: 49.74, overflowWrap: "anywhere" });
  const edge = layoutText(context, { ...options, text: "alpha beta", width: 49.75, overflowWrap: "anywhere" });
  assert.deepEqual(below.lines.map(line => line.text), ["alph", "a ", "beta"]);
  assert.deepEqual(edge.lines.map(line => line.text), ["alpha ", "beta"]);
});

test("treats LF and CRLF as hard breaks without exposing separators", () => {
  const result = layoutText(context, { ...options, text: "a\r\nb\nc\n\n" });
  assert.deepEqual(result.lines.map(line => line.text), ["a", "b", "c", "", ""]);
  assert.deepEqual(result.lines.map(line => [line.start, line.end]), [[0, 1], [3, 4], [5, 6], [7, 7], [8, 8]]);
});

test("never splits surrogate, combining, or ZWJ grapheme clusters", () => {
  const text = "é👩‍💻é";
  const result = layoutText(context, { ...options, text, width: 1, overflowWrap: "anywhere" });
  assert.deepEqual(result.lines.map(line => line.text), ["é", "👩‍💻", "é"]);
  assert.ok(result.lines.every(line => line.glyphs.every(glyph => glyph.clusterStart >= line.start && glyph.clusterEnd <= line.end)));
});

test("centers the OpenType em box in each line and advances baselines exactly", () => {
  const result = layoutText(context, { ...options, text: "one\ntwo" });
  const expected = (options.lineHeight - (1.025 + 0.275) * options.fontSize) / 2 + 1.025 * options.fontSize;
  assert.equal(context.match("IBM Plex Sans").metricsSource, "OS/2");
  assert.equal(result.lines[0].baseline, expected);
  assert.equal(result.lines[1].baseline - result.lines[0].baseline, options.lineHeight);
});
