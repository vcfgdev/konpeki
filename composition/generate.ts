import { mkdirSync, writeFileSync } from 'node:fs';
import { schemaV2 } from './schema-v2.ts';
import { canonicalJSON, compileHandoff } from './compile.ts';
import { fixtures } from './fixtures.ts';
import { toComposition } from './grid.ts';
const directory = new URL('./fixtures/', import.meta.url);
mkdirSync(directory, { recursive: true });
writeFileSync(new URL('./schema-v2.json', import.meta.url), canonicalJSON(schemaV2) + '\n');
for (const [name, document] of Object.entries(fixtures)) {
  const wire = toComposition(document);
  writeFileSync(new URL(`${name}.json`, directory), canonicalJSON(wire) + '\n');
  writeFileSync(new URL(`${name}.handoff.md`, directory), compileHandoff(wire));
}
console.log('Generated schema and five fixture pairs.');
