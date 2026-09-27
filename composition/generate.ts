import { mkdirSync, writeFileSync } from 'node:fs';
import { schema } from './schema.ts';
import { schemaV2 } from './schema-v2.ts';
import { canonicalJSON, compileHandoff } from './compile.ts';
import { fixtures } from './fixtures.ts';
const directory = new URL('./fixtures/', import.meta.url);
mkdirSync(directory, { recursive: true });
writeFileSync(new URL('./schema.json', import.meta.url), canonicalJSON(schema) + '\n');
writeFileSync(new URL('./schema-v2.json', import.meta.url), canonicalJSON(schemaV2) + '\n');
for (const [name, document] of Object.entries(fixtures)) {
  writeFileSync(new URL(`${name}.json`, directory), canonicalJSON(document) + '\n');
  writeFileSync(new URL(`${name}.handoff.md`, directory), compileHandoff(document));
}
console.log('Generated schema and five fixture pairs.');
