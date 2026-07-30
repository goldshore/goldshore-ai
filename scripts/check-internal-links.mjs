import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_DIST_DIR = 'apps/gs-web/dist';
// Keep the legacy app entry plus the primary homepage-linked routes in CI coverage.
const DEFAULT_ROUTES = ['/developer', '/apps/risk-radar', '/', '/platform', '/risk-radar', '/services', '/about', '/contact'];

const baseDistDir = path.resolve(process.env.DIST_DIR ?? DEFAULT_DIST_DIR);
const serverEntryFile = path.join(baseDistDir, 'server', 'entry.mjs');
// Cloudflare Pages adapter v13+ outputs pre-rendered pages to dist/client/
const clientDistDir = path.join(baseDistDir, 'client');
const distDir = await access(clientDistDir).then(() => clientDistDir, () => baseDistDir);
const routes = (process.env.LINK_CHECK_ROUTES ?? DEFAULT_ROUTES.join(','))
  .split(',')
  .map((route) => route.trim())
  .filter(Boolean);

const htmlCache = new Map();
const idsCache = new Map();

const isExternal = (href) => /^(?:[a-zA-Z][a-zA-Z\d+.-]*:|\/\/)/.test(href);

// Server-rendered-only routes (Cloudflare Access-gated admin/app pages, login)
// are never pre-rendered into dist/, so they can't be verified against the
// static output even though they're real, working routes.
const SSR_PREFIXES = ['/app/', '/admin/', '/login'];
const isSsrOnlyPath = (pathname) => SSR_PREFIXES.some((prefix) => `${pathname}/`.startsWith(prefix));

const normalizeRoutePath = (pathname) => {
  if (!pathname || pathname === '/') {
    return '/index.html';
  }
  if (pathname.endsWith('/')) {
    return `${pathname}index.html`;
  }
  if (path.extname(pathname)) {
    return pathname;
  }
  return `${pathname}/index.html`;
};

const distFileFromPath = (pathname) => {
  const normalized = normalizeRoutePath(pathname);
  return path.join(distDir, normalized.replace(/^\//, ''));
};

const loadHtml = async (pathname) => {
  const distFile = distFileFromPath(pathname);
  if (!htmlCache.has(distFile)) {
    const contents = await readFile(distFile, 'utf8');
    htmlCache.set(distFile, contents);
  }
  return htmlCache.get(distFile);
};

const loadIds = async (pathname) => {
  const distFile = distFileFromPath(pathname);
  if (!idsCache.has(distFile)) {
    const html = await loadHtml(pathname);
    const ids = new Set();
    const idPattern = /\sid=["']([^"']+)["']/g;
    let match;
    while ((match = idPattern.exec(html)) !== null) {
      ids.add(match[1]);
    }
    idsCache.set(distFile, ids);
  }
  return idsCache.get(distFile);
};

const listHrefs = (html) => {
  const hrefs = [];
  const hrefPattern = /\shref=["']([^"']+)["']/g;
  let match;
  while ((match = hrefPattern.exec(html)) !== null) {
    hrefs.push(match[1]);
  }
  return hrefs;
};

const exists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const failures = [];
const serverEntry = await exists(serverEntryFile) ? await readFile(serverEntryFile, 'utf8') : '';

const hasServerRoute = (route) => {
  const normalizedRoute = route === '/' ? '/' : route.replace(/\/+$/, '');
  const escapedRoute = normalizedRoute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`["']route["']\\s*:\\s*["']${escapedRoute}["']`).test(serverEntry);
};

for (const sourceRoute of routes) {
  const sourcePath = sourceRoute.startsWith('/') ? sourceRoute : `/${sourceRoute}`;
  const sourceFile = distFileFromPath(sourcePath);

  if (!(await exists(sourceFile))) {
    if (!hasServerRoute(sourcePath)) {
      failures.push(`${sourcePath}: source route missing from static output and server manifest`);
    }
    continue;
  }

  const sourceHtml = await loadHtml(sourcePath);
  const hrefs = listHrefs(sourceHtml);

  for (const href of hrefs) {
    if (
      !href ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('javascript:') ||
      href.startsWith('data:') ||
      href.startsWith('vbscript:')
    ) {
      continue;
    }

    if (isExternal(href)) {
      continue;
    }

    let targetPathname;
    let targetHash = '';

    if (href.startsWith('#')) {
      targetPathname = sourcePath;
      targetHash = href.slice(1);
    } else {
      const resolved = new URL(href, `https://goldshore.local${sourcePath.endsWith('/') ? sourcePath : `${sourcePath}/`}`);
      targetPathname = resolved.pathname;
      targetHash = resolved.hash.replace(/^#/, '');
    }

    if (isSsrOnlyPath(targetPathname)) {
      continue;
    }

    const targetFile = distFileFromPath(targetPathname);
    if (!(await exists(targetFile))) {
      if (!hasServerRoute(targetPathname)) {
        failures.push(`${sourcePath}: ${href} -> missing page ${targetPathname}`);
      }
      continue;
    }

    if (targetHash) {
      const ids = await loadIds(targetPathname);
      if (!ids.has(targetHash)) {
        failures.push(`${sourcePath}: ${href} -> missing anchor #${targetHash} on ${targetPathname}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`Internal link check failed for ${routes.length} pages.`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Internal link check passed for ${routes.length} pages.`);
}
