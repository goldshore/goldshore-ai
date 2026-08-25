import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('contact submissions accept the JSON payload sent by gs-web', async () => {
  const source = await readFile(new URL('./forms.ts', import.meta.url), 'utf8');

  assert.match(source, /contentType\.includes\('application\/json'\)/);
  assert.match(source, /c\.req\.json<Record<string, unknown>>\(\)/);
  assert.match(source, /c\.req\.parseBody\(\)/);
  assert.match(source, /Invalid submission payload/);
});
