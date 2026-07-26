import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const layoutRoot = new URL('../../src/layouts/', import.meta.url);
const sourceRoot = new URL('../../src/', import.meta.url);

async function readLayout(name: string) {
  return readFile(new URL(name, layoutRoot), 'utf8');
}

test('public layout aliases delegate to the canonical marketing shell', async () => {
  const [baseLayout, webLayout, marketingLayout] = await Promise.all([
    readLayout('BaseLayout.astro'),
    readLayout('WebLayout.astro'),
    readLayout('MarketingLayout.astro'),
  ]);

  assert.match(baseLayout, /import MarketingLayout from '\.\/MarketingLayout\.astro'/);
  assert.match(webLayout, /import MarketingLayout from '\.\/MarketingLayout\.astro'/);
  assert.match(marketingLayout, /import GoldShoreShell from '\.\/GoldShoreShell\.astro'/);
});

test('layout imports remain inside Astro frontmatter', async () => {
  for (const name of ['BaseLayout.astro', 'WebLayout.astro', 'MarketingLayout.astro', 'GoldShoreShell.astro']) {
    const source = await readLayout(name);
    const closingFrontmatter = source.indexOf('---', 3);
    assert.notEqual(closingFrontmatter, -1, `${name} must close its Astro frontmatter`);

    const renderedTemplate = source.slice(closingFrontmatter + 3);
    assert.doesNotMatch(
      renderedTemplate,
      /^\s*import\s.+from\s+['"]/m,
      `${name} must not render imports as page text`,
    );
  }
});

test('canonical theme exposes reusable shell and content primitives', async () => {
  const [shell, theme, flowSection] = await Promise.all([
    readLayout('GoldShoreShell.astro'),
    readFile(new URL('styles/public-theme.css', sourceRoot), 'utf8'),
    readFile(new URL('components/FlowSection.astro', sourceRoot), 'utf8'),
  ]);

  for (const contract of ['topbar', 'nav-toggle', 'site-footer', 'brand-logo']) {
    assert.match(shell, new RegExp(contract), `shell must provide ${contract}`);
  }

  for (const primitive of [
    '.gs-hero',
    '.gs-section',
    '.gs-btn',
    '.gs-divider',
    '.gs-brand-lockup',
    '[data-reveal]',
  ]) {
    assert.ok(theme.includes(primitive), `theme must provide ${primitive}`);
  }

  assert.match(flowSection, /tone = 'default'/);
  assert.match(flowSection, /size = 'default'/);
});
