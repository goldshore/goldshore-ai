import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Locate the workspace root by walking up for `pnpm-workspace.yaml`.
 *
 * This module is bundled before it runs, and the emitted chunk does not sit at
 * the same depth as this source file, so resolving a fixed number of `..`
 * segments off `import.meta.url` points somewhere different at build time than
 * it does in source. Searching for the workspace marker is stable under both.
 */
function findRepositoryRoot(): string {
  const candidates = [process.cwd(), path.dirname(fileURLToPath(import.meta.url))];

  for (const candidate of candidates) {
    let directory = path.resolve(candidate);

    while (true) {
      if (existsSync(path.join(directory, 'pnpm-workspace.yaml'))) return directory;
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }

  throw new Error(
    'Unable to locate the workspace root (no pnpm-workspace.yaml found above ' +
      `${candidates.join(' or ')}).`,
  );
}

const repositoryRoot = findRepositoryRoot();
const webRoot = path.join(repositoryRoot, 'apps/gs-web');

function gitReleaseSha(): string {
  const configured = process.env.RELEASE_SHA?.trim();
  if (configured) return configured;

  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim();
}

function addTreeToHash(hash: ReturnType<typeof createHash>, directory: string): void {
  if (!existsSync(directory)) {
    throw new Error(`Release marker source directory is missing: ${directory}`);
  }

  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) addTreeToHash(hash, absolutePath);
    if (entry.isFile()) {
      hash.update(path.relative(repositoryRoot, absolutePath));
      hash.update('\0');
      hash.update(readFileSync(absolutePath));
      hash.update('\0');
    }
  }
}

export function getWebReleaseMarker() {
  const releaseSha = gitReleaseSha();
  const themeHash = createHash('sha256');
  addTreeToHash(themeHash, path.join(repositoryRoot, 'packages/theme'));
  addTreeToHash(themeHash, path.join(webRoot, 'src/styles'));
  const themeId = themeHash.digest('hex').slice(0, 16);

  return {
    application: 'gs-web',
    buildId: `${releaseSha}.${themeId}`,
    releaseSha,
    themeId,
  } as const;
}
