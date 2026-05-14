import { createServer } from 'node:http';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { chromium } from '@playwright/test';

const execFileAsync = promisify(execFile);

const DIST_DIR = path.resolve(process.cwd(), 'dist');
const PAGES_DIR = path.resolve(process.cwd(), 'src/pages');
const HOST = '127.0.0.1';
const PORT = Number(process.env.RELEASE_CHECK_PORT ?? 4173);

const LIGHTHOUSE_BUDGETS = {
  performance: Number(process.env.LH_MIN_PERFORMANCE ?? 0.8),
  accessibility: Number(process.env.LH_MIN_ACCESSIBILITY ?? 0.9),
  seo: Number(process.env.LH_MIN_SEO ?? 0.9),
};

const failures = [];

const exists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  }));
  return files.flat();
};

const toRoute = (relativeHtmlPath) => {
  const normalized = relativeHtmlPath.replace(/\\/g, '/');
  if (normalized === 'index.html') return '/';
  if (normalized.endsWith('/index.html')) return `/${normalized.slice(0, -11)}`;
  return `/${normalized.replace(/\.html$/, '')}`;
};

const toDistHtmlPath = (route) => (route === '/' ? 'index.html' : `${route.replace(/^\//, '')}/index.html`);

const getDocuments = async () => {
  const files = await walk(DIST_DIR);
  const htmlFiles = files.filter((file) => file.endsWith('.html'));
  return Promise.all(htmlFiles.map(async (absolutePath) => {
    const relativePath = path.relative(DIST_DIR, absolutePath).replace(/\\/g, '/');
    return {
      route: toRoute(relativePath),
      relativePath,
      html: await readFile(absolutePath, 'utf8'),
    };
  }));
};

const getExpectedRoutes = async () => {
  const files = await walk(PAGES_DIR);
  return files
    .filter((file) => /\.(astro|md|mdx)$/.test(file))
    .map((file) => path.relative(PAGES_DIR, file).replace(/\\/g, '/'))
    .filter((file) => !file.includes('/api/'))
    .filter((file) => !file.includes('['))
    .map((file) => {
      if (/^index\.(astro|md|mdx)$/.test(file)) return '/';
      return `/${file.replace(/\.(astro|md|mdx)$/, '').replace(/\/index$/, '')}`;
    })
    .sort();
};

const getMetaContent = (html, pattern) => {
  const match = html.match(pattern);
  return match?.[1]?.trim() || '';
};

const checkMetadata = (documents) => {
  for (const doc of documents) {
    const title = getMetaContent(doc.html, /<title>([\s\S]*?)<\/title>/i);
    const description = getMetaContent(doc.html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    const ogTitle = getMetaContent(doc.html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const ogDescription = getMetaContent(doc.html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    const ogType = getMetaContent(doc.html, /<meta[^>]+property=["']og:type["'][^>]+content=["']([^"']+)["']/i);
    const ogUrl = getMetaContent(doc.html, /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);

    if (!title) failures.push(`[metadata] ${doc.route}: missing <title>`);
    if (!description) failures.push(`[metadata] ${doc.route}: missing meta description`);
    if (!ogTitle) failures.push(`[metadata] ${doc.route}: missing og:title`);
    if (!ogDescription) failures.push(`[metadata] ${doc.route}: missing og:description`);
    if (!ogType) failures.push(`[metadata] ${doc.route}: missing og:type`);
    if (!ogUrl) failures.push(`[metadata] ${doc.route}: missing og:url`);
  }
};

const getIds = (html) => new Set(Array.from(html.matchAll(/\sid=["']([^"']+)["']/gi)).map((m) => m[1]));
const getLinks = (html) => Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)).map((m) => m[1]);

const hasLabelFor = (html, id) => new RegExp(`<label[^>]+for=["']${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(html);

const checkRoutesAndLinks = (documents, expectedRoutes) => {
  const byRoute = new Map(documents.map((doc) => [doc.route, doc]));

  for (const route of expectedRoutes) {
    if (!byRoute.has(route)) {
      failures.push(`[routes] missing built route: ${route} (${toDistHtmlPath(route)})`);
    }
  }

  for (const doc of documents) {
    const ids = getIds(doc.html);
    const links = getLinks(doc.html);

    for (const href of links) {
      if (!href || /^(mailto:|tel:|javascript:|data:)/i.test(href) || /^(https?:)?\/\//i.test(href)) continue;

      const resolved = new URL(href, `https://goldshore.local${doc.route.endsWith('/') ? doc.route : `${doc.route}/`}`);
      const target = byRoute.get(resolved.pathname);
      if (!target) {
        failures.push(`[links] ${doc.route}: ${href} -> missing route ${resolved.pathname}`);
        continue;
      }
      if (resolved.hash) {
        const targetIds = resolved.pathname === doc.route ? ids : getIds(target.html);
        const anchor = resolved.hash.slice(1);
        if (anchor && !targetIds.has(anchor)) {
          failures.push(`[links] ${doc.route}: ${href} -> missing anchor #${anchor}`);
        }
      }
    }
  }
};

const checkFormLabels = (documents) => {
  const controlRegex = /<(input|select|textarea)\b([^>]*)>/gi;

  for (const doc of documents) {
    let match;
    while ((match = controlRegex.exec(doc.html)) !== null) {
      const [fullTag, tag, attrs] = match;
      const type = (attrs.match(/\stype=["']([^"']+)["']/i)?.[1] || '').toLowerCase();
      if (tag === 'input' && ['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue;

      const id = attrs.match(/\sid=["']([^"']+)["']/i)?.[1];
      const hasAriaLabel = /\saria-label=["'][^"']+["']/i.test(attrs) || /\saria-labelledby=["'][^"']+["']/i.test(attrs);
      const wrappedByLabel = /<label[\s\S]*$/.test(doc.html.slice(0, match.index)) && /<\/label>/.test(doc.html.slice(match.index));
      const hasLinkedLabel = id ? hasLabelFor(doc.html, id) : false;

      if (!hasAriaLabel && !hasLinkedLabel && !wrappedByLabel) {
        failures.push(`[forms] ${doc.route}: unlabeled ${tag} control (${fullTag.slice(0, 80)}...)`);
      }
    }
  }
};

const createStaticServer = (documents) => {
  const byPath = new Map(documents.map((doc) => [doc.relativePath, doc.html]));
  return createServer((req, res) => {
    const pathname = (req.url || '/').split('?')[0];
    const key = pathname === '/' ? 'index.html' : `${pathname.replace(/^\//, '').replace(/\/$/, '')}/index.html`;
    const html = byPath.get(key);
    if (!html) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    res.statusCode = 200;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(html);
  });
};

const checkKeyboardNavigation = async (routes) => {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--disable-gpu', '--use-angle=swiftshader', '--use-gl=swiftshader'],
  });

  try {
    for (const route of routes) {
      const page = await browser.newPage();
      await page.goto(`http://${HOST}:${PORT}${route}`, { waitUntil: 'networkidle' });

      const focused = new Set();
      for (let i = 0; i < 10; i += 1) {
        await page.keyboard.press('Tab');
        const locator = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el) return '';
          const tag = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : '';
          return `${tag}${id}`;
        });
        if (locator) focused.add(locator);
      }

      if (focused.size < 3) {
        failures.push(`[keyboard] ${route}: expected at least 3 focusable elements, got ${focused.size}`);
      }

      await page.close();
    }
  } finally {
    await browser.close();
  }
};

const checkLighthouse = async (routes) => {
  for (const route of routes) {
    const { stdout } = await execFileAsync('npx', [
      '--yes',
      'lighthouse',
      `http://${HOST}:${PORT}${route}`,
      '--quiet',
      '--output=json',
      '--output-path=stdout',
      '--chrome-flags=--headless --no-sandbox',
      '--only-categories=performance,accessibility,seo',
    ], { maxBuffer: 8 * 1024 * 1024 });

    const report = JSON.parse(stdout);
    for (const [category, minScore] of Object.entries(LIGHTHOUSE_BUDGETS)) {
      const score = report?.categories?.[category]?.score;
      if (typeof score !== 'number' || score < minScore) {
        failures.push(`[lighthouse] ${route}: ${category} ${score ?? 'n/a'} below ${minScore}`);
      }
    }
  }
};

const main = async () => {
  if (!(await exists(DIST_DIR))) {
    console.error('dist/ not found. Run `pnpm build` first.');
    process.exit(1);
  }

  const documents = await getDocuments();
  const expectedRoutes = await getExpectedRoutes();

  checkMetadata(documents);
  checkRoutesAndLinks(documents, expectedRoutes);
  checkFormLabels(documents);

  const server = createStaticServer(documents);
  await new Promise((resolve) => server.listen(PORT, HOST, resolve));

  const checksRoutes = ['/', '/about', '/contact', '/developer'].filter((route) =>
    documents.some((doc) => doc.route === route),
  );

  try {
    await checkKeyboardNavigation(checksRoutes);
    await checkLighthouse(checksRoutes);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }

  if (failures.length > 0) {
    console.error('❌ gs-web release quality gate failed');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log('✅ gs-web release quality gate passed');
};

await main();
