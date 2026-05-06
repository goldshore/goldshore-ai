import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export type DynamicRouteSource =
  | {
      name: string;
      type: 'content';
      basePath: string;
      contentDir: string;
      extensions: string[];
    }
  | {
      name: string;
      type: 'openapi';
      basePath: string;
      specPath: string;
      includeIndex: boolean;
    };

export const dynamicRouteSources: DynamicRouteSource[] = [
  {
    name: 'docs',
    type: 'content',
    basePath: '/developer/docs',
    contentDir: 'apps/gs-web/src/content/docs',
    extensions: ['.md', '.mdx']
  },
  {
    name: 'api-docs',
    type: 'openapi',
    basePath: '/developer/api',
    specPath: 'apps/gs-web/src/data/v1.json',
    includeIndex: true
  }
];

const normalizeSlug = (filePath: string) =>
  filePath.replace(/\\/g, '/').replace(/^\//, '');

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

const buildContentRoutes = async (source: Extract<DynamicRouteSource, { type: 'content' }>) => {
  const absoluteDir = path.resolve(source.contentDir);
  const files = await listFiles(absoluteDir);
  return files
    .filter((file) => source.extensions.includes(path.extname(file)))
    .map((file) => {
      const relative = path.relative(absoluteDir, file);
      const slug = normalizeSlug(relative).replace(path.extname(relative), '');
      return `${source.basePath}/${slug}`;
    });
};

const buildOpenApiRoutes = async (source: Extract<DynamicRouteSource, { type: 'openapi' }>) => {
  const specRaw = await readFile(path.resolve(source.specPath), 'utf-8');
  const spec = JSON.parse(specRaw) as { paths?: Record<string, unknown> };
  const routes = new Set<string>();
  if (source.includeIndex) {
    routes.add(source.basePath);
  }
  for (const apiPath of Object.keys(spec.paths ?? {})) {
    const slug = apiPath.replace(/^\//, '').replace(/{/g, '').replace(/}/g, '');
    routes.add(`${source.basePath}/${slug}`);
  }
  return Array.from(routes);
};

export const loadDynamicRoutes = async () => {
  const routePromises = dynamicRouteSources.map((source) =>
    source.type === 'content' ? buildContentRoutes(source) : buildOpenApiRoutes(source)
  );
  const results = await Promise.all(routePromises);
  return results.flat();
};
