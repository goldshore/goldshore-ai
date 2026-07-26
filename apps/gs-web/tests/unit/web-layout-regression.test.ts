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

test('Gold Shore page templates compose the shared shell and column contract', async () => {
  const [pageTemplate, sectionTemplate] = await Promise.all([
    readFile(new URL('components/GoldShorePageTemplate.astro', sourceRoot), 'utf8'),
    readFile(new URL('components/GoldShoreSection.astro', sourceRoot), 'utf8'),
  ]);

  for (const contract of [
    "import WebLayout from '../layouts/WebLayout.astro'",
    "Astro.slots.has('actions')",
    "Astro.slots.has('aside')",
    "'gs-shell-section'",
    "'gs-column-grid'",
  ]) {
    assert.ok(pageTemplate.includes(contract), `Page template must retain ${contract}`);
  }

  for (const contract of [
    'columns?: 1 | 2 | 3 | 4',
    "tone?: 'default' | 'surface' | 'accent'",
    'class="gs-shell-section gs-column-grid"',
    'repeat(4, minmax(0, 1fr))',
  ]) {
    assert.ok(sectionTemplate.includes(contract), `Section template must retain ${contract}`);
  }
});
