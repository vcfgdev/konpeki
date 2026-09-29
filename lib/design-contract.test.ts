import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

type Literal = string | number | { [key: string]: Literal };

// A conservative authoring contract, not a replacement for the upstream parser.
function literal(node: ts.Expression): Literal {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(node.properties.map(property => {
      assert(ts.isPropertyAssignment(property), 'Design cannot contain spreads or shorthand properties');
      assert(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name), 'Design keys must be literal');
      return [property.name.text, literal(property.initializer)];
    }));
  }
  throw new Error(`Nonliteral Design value: ${ts.SyntaxKind[node.kind]}`);
}

function readDesign(source: string) {
  const file = ts.createSourceFile('index.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'design') continue;
      assert(declaration.initializer, 'Design needs an initializer');
      return literal(declaration.initializer);
    }
  }
  return undefined;
}

test('active Design exports are literal and have the pinned upstream shape', () => {
  const file = new URL('../composition/fixtures/architecture/index.tsx', import.meta.url);
  const value = readDesign(readFileSync(file, 'utf8'));
  assert(value && typeof value === 'object');
  assert.deepEqual(Object.keys(value).sort(), ['fonts', 'palette', 'radius', 'typeScale']);
  for (const [group, keys] of [['palette', ['bg', 'text', 'accent']], ['fonts', ['display', 'body']]] as const) {
    const tokens: Literal = value[group];
    assert(tokens && typeof tokens === 'object');
    assert.deepEqual(Object.keys(tokens).sort(), [...keys].sort());
    for (const key of keys) assert.equal(typeof tokens[key], 'string', `architecture: ${group}.${key}`);
  }
  const scale = value.typeScale;
  assert(scale && typeof scale === 'object');
  assert.deepEqual(Object.keys(scale).sort(), ['body', 'hero']);
  assert(typeof scale.hero === 'number' && scale.hero > 0);
  assert(typeof scale.body === 'number' && scale.body > 0);
  assert(typeof value.radius === 'number' && value.radius >= 0);
});

test('literal Design parsing works independently of installed decks', () => {
  assert.deepEqual(readDesign('export const design = { palette: { bg: "#FFFFFF", text: "#121212" }, radius: 8 };'),
    { palette: { bg: '#FFFFFF', text: '#121212' }, radius: 8 });
  assert.equal(readDesign('export const meta = { title: "Example" };'), undefined);
});

test('computed Design values fail before reaching the editor', () => {
  assert.throws(() => readDesign('export const design = { palette: { bg: c.bg } };'), /Nonliteral/);
  assert.throws(() => readDesign('export const design = { fonts: { body: sans } };'), /Nonliteral/);
  assert.throws(() => readDesign('export const design = { ...base };'), /spreads/);
});
