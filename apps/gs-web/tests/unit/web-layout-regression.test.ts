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
    'class="gs-page-shell gs-shell-v284"',
    'import PublicHeader',
    'import PublicFooter',
    '<PublicHeader currentPath={Astro.url.pathname} />',
    '<PublicFooter />',
  ]) {
    assert.ok(source.includes(contract), `WebLayout must retain ${contract}`);
  }
});

test('WebLayout delegates responsive navigation to the shared chrome', async () => {
  const source = await readFile(new URL('layouts/WebLayout.astro', sourceRoot), 'utf8');
  assert.doesNotMatch(source, /class="header"|id="header-login-link"|mobile-navigation/);
  assert.doesNotMatch(source, /menuGlobal|matchMedia/);
});

test('public header supplies the responsive navigation shared with the homepage', async () => {
  const [source, homepage] = await Promise.all([
    readFile(new URL('components/PublicHeader.astro', sourceRoot), 'utf8'),
    readFile(new URL('pages/index.astro', sourceRoot), 'utf8'),
  ]);

  assert.equal(source.match(/>Log in<\/a>/g)?.length, 1);
  assert.match(source, /import\s*\{[^}]*CANONICAL_ADMIN_DASHBOARD_URL[^}]*\}/s);
  assert.match(source, /href=\{CANONICAL_ADMIN_DASHBOARD_URL\}/);
  assert.match(source, /import \{ publicMenuGroups \}/);
  assert.match(source, /id="main-nav" class="main-nav"/);
  assert.match(source, /class="main-nav__tier"/);
  assert.match(source, /class="main-nav__submenu"/);
  assert.match(source, />GOLDSHORE<\/span>/);
  assert.match(source, /penrose-logo\.png/);
  assert.doesNotMatch(source, /40°|74°|GS-LAB/);
  assert.match(source, /import '\.\.\/styles\/global\.css'/);
  assert.match(source, /import '\.\.\/scripts\/theme-navigation'/);
  assert.doesNotMatch(source, /dashboard\.goldshore\.ai/);
  assert.doesNotMatch(source, />Admin →<\/a>/);
  assert.match(homepage, /import PublicHeader/);
  assert.match(homepage, /<PublicHeader currentPath=/);
  assert.match(homepage, /https:\/\/\$\{adminHost\}\/app\/dashboard/);
});

test('public shells share the tablet navigation breakpoint and branded lockup', async () => {
  const [webLayout, legacyShell, themeChrome, homeTheme] = await Promise.all([
    readFile(new URL('layouts/WebLayout.astro', sourceRoot), 'utf8'),
    readFile(new URL('layouts/GoldShoreShell.astro', sourceRoot), 'utf8'),
    readFile(new URL('styles/theme-chrome.css', sourceRoot), 'utf8'),
    readFile(new URL('styles/home-theme.css', sourceRoot), 'utf8'),
  ]);

  assert.match(webLayout, /<PublicHeader currentPath=/);
  assert.match(webLayout, /<PublicFooter \/>/);
  assert.doesNotMatch(webLayout, /GS-LAB|header-coordinates/);
  assert.doesNotMatch(legacyShell, /class="brand-logo"/);
  assert.match(legacyShell, /@media \(max-width: 1023px\)/);
  assert.match(themeChrome, /@media \(max-width: 1023px\)/);
  assert.match(homeTheme, /@media \(max-width: 1023px\)/);
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

test('PublicHeader marks parent nav links current on nested public routes', async () => {
  const source = await readFile(new URL('components/PublicHeader.astro', sourceRoot), 'utf8');

  assert.match(source, /const activePath = normalizePath\(currentPath\)/);
  assert.match(source, /activePath\.startsWith\(normalizedHref\)/);
  assert.equal(source.match(/aria-current=\{isCurrent\(link\.href\)/g)?.length, 1);
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

test('homepage has one complete document and shares navigation sources', async () => {
  const source = await readFile(new URL('pages/index.astro', sourceRoot), 'utf8');

  assert.equal(source.match(/<\/html>/g)?.length, 1);
  assert.doesNotMatch(source, /<\/WebLayout>/);
  assert.match(source, /import PublicHeader/);
  assert.match(source, /import PublicFooter/);
  assert.match(source, /<PublicFooter \/>/);
  assert.match(source, /CANONICAL_ADMIN_DASHBOARD_URL/);
});

test('shared header and footer use one complete public taxonomy', async () => {
  const [navigation, header, footer] = await Promise.all([
    readFile(new URL('config/navigation.ts', sourceRoot), 'utf8'),
    readFile(new URL('components/PublicHeader.astro', sourceRoot), 'utf8'),
    readFile(new URL('components/PublicFooter.astro', sourceRoot), 'utf8'),
  ]);

  for (const group of ['Platform', 'Services', 'Resources', 'Company', 'Access']) {
    assert.match(navigation, new RegExp(`label: '${group}'`));
  }
  assert.match(header, /publicMenuGroups\.filter/);
  assert.match(footer, /publicMenuGroups\.map/);
  assert.match(footer, /penrose-logo\.png/);
  assert.doesNotMatch(footer, /40°|74°|GS-LAB/);
});
