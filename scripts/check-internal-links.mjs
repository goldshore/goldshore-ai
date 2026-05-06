import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_DIST_DIR = 'apps/gs-web/dist';
const DEFAULT_ROUTES = ['/developer', '/risk-radar', '/workflows'];

const distDir = path.resolve(process.env.DIST_DIR ?? DEFAULT_DIST_DIR);
const routes = (process.env.LINK_CHECK_ROUTES ?? DEFAULT_ROUTES.join(','))
  .split(',')
  .map((route) => route.trim())
  .filter(Boolean);

const htmlCache = new Map();
const idsCache = new Map();

const isExternal = (href) => /^(?:[a-zA-Z][a-zA-Z\d+.-]*:|\/\/)/.test(href);

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

for (const sourceRoute of routes) {
  const sourcePath = sourceRoute.startsWith('/') ? sourceRoute : `/${sourceRoute}`;
  const sourceFile = distFileFromPath(sourcePath);

  if (!(await exists(sourceFile))) {
    failures.push(`${sourcePath}: source page missing (${sourceFile})`);
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

    const targetFile = distFileFromPath(targetPathname);
    if (!(await exists(targetFile))) {
      failures.push(`${sourcePath}: ${href} -> missing page ${targetPathname}`);
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
