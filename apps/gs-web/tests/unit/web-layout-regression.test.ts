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

test('WebLayout renders one responsive admin login control', async () => {
  const source = await readFile(new URL('layouts/WebLayout.astro', sourceRoot), 'utf8');
  const loginLabels = source.match(/>Log in<\/a>/g) ?? [];

  assert.equal(loginLabels.length, 1);
  assert.match(source, /id="header-login-link"/);
  assert.match(source, /mobileActions\.insertBefore\(loginLink, mobileDeveloperLink\)/);
  assert.match(source, /desktopNav\.insertBefore\(loginLink, desktopCta\)/);
});

test('public header renders one dashboard action per responsive navigation', async () => {
  const [source, navigation] = await Promise.all([
    readFile(new URL('components/PublicHeader.astro', sourceRoot), 'utf8'),
    readFile(new URL('config/navigation.ts', sourceRoot), 'utf8'),
  ]);

  assert.equal(source.match(/authLinks\.map/g)?.length, 2);
  assert.match(source, /import \{ authLinks, primaryNavLinks \}/);
  assert.doesNotMatch(source, /dashboard\.goldshore\.ai/);
  assert.doesNotMatch(source, />Admin →<\/a>/);
  assert.match(navigation, /https:\/\/admin\.goldshore\.ai\/app\/dashboard/);
  assert.equal(navigation.match(/label: 'Dashboard access'/g)?.length, 1);
});

test('BaseLayout composes global theme parts without a shell wrapper', async () => {
  const [layout, globalCss] = await Promise.all([
    readFile(new URL('layouts/BaseLayout.astro', sourceRoot), 'utf8'),
    readFile(new URL('styles/global.css', sourceRoot), 'utf8'),
  ]);
  assert.match(layout, /import PublicHeader/);
  assert.match(layout, /import PublicFooter/);
  assert.match(layout, /import '\.\.\/scripts\/theme-navigation'/);
  assert.doesNotMatch(layout, /GoldShoreShell/);
  assert.match(globalCss, /@import '\.\/theme-chrome\.css'/);
});

test('WebLayout marks parent nav links current on nested public routes', async () => {
  const source = await readFile(new URL('layouts/WebLayout.astro', sourceRoot), 'utf8');

  assert.match(source, /const activePath = normalizePath\(Astro\.url\.pathname\)/);
  assert.match(source, /activePath\.startsWith\(normalizedHref\)/);
  assert.equal(source.match(/aria-current=\{isCurrent\(link\.href\)/g)?.length, 2);
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
    "heroMotion?: 'none' | 'starfield' | 'parallax'",
    '<VibrantHeroField mode={heroMotion} />',
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
