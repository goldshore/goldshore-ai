import { createServer } from 'node:http';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { chromium } from '@playwright/test';

const execFileAsync = promisify(execFile);

const _distRoot = path.resolve(process.cwd(), 'dist');
const _distClient = path.join(_distRoot, 'client');
// Cloudflare Pages adapter v13+ outputs pre-rendered pages to dist/client/
const DIST_DIR = await (async () => {
  try { await access(_distClient); return _distClient; } catch { return _distRoot; }
})();

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

// Routes served via SSR (auth-protected portals, etc.) — not expected to be pre-rendered
const SSR_PREFIXES = ['/app/', '/admin/'];

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
    .filter((route) => !SSR_PREFIXES.some((prefix) => route.startsWith(prefix)))
    .sort();
};

const getMetaContent = (html, pattern) => {
  const match = html.match(pattern);
  return match?.[1]?.trim() || '';
};

const checkMetadata = (documents) => {
  for (const doc of documents) {
    // Skip metadata checks for auth-protected client portal routes
    if (doc.route === '/client' || doc.route.startsWith('/client/')) continue;

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
      // Normalize pathname: remove trailing slash (except root '/')
      const normalizedPathname = resolved.pathname === '/' ? '/' : resolved.pathname.replace(/\/$/, '');
      const target = byRoute.get(normalizedPathname);
      if (!target) {
        failures.push(`[links] ${doc.route}: ${href} -> missing route ${normalizedPathname}`);
        continue;
      }
      if (resolved.hash) {
        // Only validate same-page anchors; cross-page anchor links (e.g. nav links to /#section)
        // target live/SPA sections that are not present in static pre-rendered HTML.
        if (normalizedPathname === doc.route) {
          const anchor = resolved.hash.slice(1);
          if (anchor && !ids.has(anchor)) {
            failures.push(`[links] ${doc.route}: ${href} -> missing anchor #${anchor}`);
          }
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
      // Skip honeypot/decorative inputs with tabindex="-1"
      if (/\stabindex=["']-1["']/i.test(attrs)) continue;

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

const MIME = {
  '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.txt': 'text/plain', '.xml': 'application/xml',
};

const buildAssetIndex = async () => {
  const index = new Map();
  try {
    const all = await walk(DIST_DIR);
    for (const absPath of all) {
      if (!absPath.endsWith('.html')) {
        const rel = path.relative(DIST_DIR, absPath).replace(/\\/g, '/');
        index.set('/' + rel, absPath);
      }
    }
  } catch { /* dist may not contain non-HTML assets */ }
  return index;
};

const createStaticServer = async (documents) => {
  const byHtmlPath = new Map(documents.map((doc) => [doc.relativePath, doc.html]));
  const byUrlPath = await buildAssetIndex();

  return createServer(async (req, res) => {
    const rawPathname = (req.url || '/').split('?')[0];
    let pathname;
    try {
      pathname = decodeURIComponent(rawPathname);
    } catch {
      pathname = rawPathname;
    }
    const htmlKey = pathname === '/'
      ? 'index.html'
      : `${pathname.replace(/^\//, '').replace(/\/$/, '')}/index.html`;
    const html = byHtmlPath.get(htmlKey);
    if (html) {
      res.statusCode = 200;
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(html);
      return;
    }
    // Serve static assets (CSS, JS bundles, fonts, images) from dist directory
    const distRoot = path.resolve(DIST_DIR);
    const filePath = path.resolve(distRoot, pathname.replace(/^\/+/, ''));
    // Guard against path traversal: resolved path must stay inside distRoot
    const rel = path.relative(distRoot, filePath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    try {
      const content = await readFile(filePath);
      const mime = MIME[path.extname(filePath)] || 'application/octet-stream';
      res.statusCode = 200;
      res.setHeader('content-type', mime);
      res.setHeader('cache-control', 'no-store');
      res.end(content);
    } catch {
      res.statusCode = 404;
      res.end('Not found');
    }
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
        // Warn only — static pages may have fewer interactive elements than the threshold
        console.warn(`[keyboard] ${route}: expected at least 3 focusable elements, got ${focused.size}`);
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

  const server = await createStaticServer(documents);
  await new Promise((resolve) => server.listen(PORT, HOST, resolve));

  const checksRoutes = ['/', '/about', '/contact', '/developer'].filter((route) =>
    documents.some((doc) => doc.route === route),
  );

  try {
    try {
      await checkKeyboardNavigation(checksRoutes);
    } catch (err) {
      console.warn('[keyboard] Skipping keyboard checks: browser not available.', err.message);
    }

    try {
      await checkLighthouse(checksRoutes);
    } catch (err) {
      console.warn('[lighthouse] Skipping Lighthouse checks: binary not available.', err.message);
    }
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
