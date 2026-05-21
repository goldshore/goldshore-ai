import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import pLimit from 'p-limit';
import { loadDynamicRoutes } from './dynamic-routes';

const DEFAULT_BASE_URL = 'http://localhost:4321';
const DEFAULT_PAGES_DIR = 'apps/gs-web/src/pages';

const listFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listFiles(fullPath);
      }
      return [fullPath];
    })
  );
  return files.flat();
};

const isDynamicSegment = (segment: string) => segment.includes('[') && segment.includes(']');

const buildRoutesFromPages = async (pagesDir: string) => {
  const absoluteDir = path.resolve(pagesDir);
  const files = await listFiles(absoluteDir);
  const routes = files
    .filter((file) => path.extname(file) === '.astro')
    .map((file) => path.relative(absoluteDir, file))
    .filter((relative) => !relative.split(path.sep).some(isDynamicSegment))
    .map((relative) => {
      const normalized = relative.replace(/\\/g, '/');
      const withoutExt = normalized.replace(/\.astro$/, '');
      if (withoutExt === 'index') {
        return '/';
      }
      if (withoutExt.endsWith('/index')) {
        return `/${withoutExt.replace(/\/index$/, '')}`;
      }
      return `/${withoutExt}`;
    });
  return routes;
};

const fetchWithTiming = async (url: URL) => {
  const start = performance.now();
  const response = await fetch(url);
  const end = performance.now();
  return { response, durationMs: end - start };
};

const formatDuration = (durationMs: number) => `${durationMs.toFixed(1)}ms`;

const run = async () => {
  const baseUrl = process.env.BASE_URL ?? process.env.PAGES_BASE_URL ?? DEFAULT_BASE_URL;
  const pagesDir = process.env.PAGES_DIR ?? DEFAULT_PAGES_DIR;

  const [pageRoutes, dynamicRoutes] = await Promise.all([
    buildRoutesFromPages(pagesDir),
    loadDynamicRoutes()
  ]);

  const allRoutes = Array.from(new Set([...pageRoutes, ...dynamicRoutes])).sort();

  if (allRoutes.length === 0) {
    throw new Error('No routes found to check.');
  }

  console.log(`Checking ${allRoutes.length} routes against ${baseUrl}`);

  const failures: string[] = [];
  const limit = pLimit(10);

  await Promise.all(
    allRoutes.map((route) =>
      limit(async () => {
        const url = new URL(route, baseUrl);
        try {
          const { response, durationMs } = await fetchWithTiming(url);
          const status = response.status;
          console.log(`GET ${route} -> ${status} (${formatDuration(durationMs)})`);
          if (status !== 200) {
            failures.push(`GET ${route} -> ${status} (${formatDuration(durationMs)})`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.log(`GET ${route} -> ERROR (${message})`);
          failures.push(`GET ${route} -> ERROR (${message})`);
        }
      })
    )
  );

  if (failures.length > 0) {
    console.error('\nNon-200 responses detected:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
