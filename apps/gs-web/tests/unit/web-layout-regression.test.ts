import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceRoot = new URL('../../src/', import.meta.url);

test('WebLayout keeps theme imports inside Astro frontmatter', async () => {
  const source = await readFile(new URL('layouts/WebLayout.astro', sourceRoot), 'utf8');
  const closingFrontmatter = source.indexOf('---', 3);
  assert.notEqual(closingFrontmatter, -1);
  assert.doesNotMatch(source.slice(closingFrontmatter + 3), /^\s*import\s.+from\s+['"]/m);
});

test('WebLayout retains the established public theme contract', async () => {
  const source = await readFile(new URL('layouts/WebLayout.astro', sourceRoot), 'utf8');

  for (const contract of [
    "import '../styles/goldshore-shell.css'",
    "import '../styles/global.css'",
    'class="gs-page-shell"',
    'class="header"',
    'class="gs-footer"',
  ]) {
    assert.ok(source.includes(contract), `WebLayout must retain ${contract}`);
  }
});
