import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

function resolveRoots() {
  const cwd = process.cwd();
  const candidates = [cwd, path.join(cwd, 'apps/gs-web')];
  const webRoot = candidates.find((candidate) =>
    existsSync(path.join(candidate, 'astro.config.mjs')),
  );
  if (!webRoot) throw new Error(`Unable to locate apps/gs-web from ${cwd}`);

  const repositoryRoot = path.resolve(webRoot, '../..');
  if (!existsSync(path.join(repositoryRoot, 'packages/theme'))) {
    throw new Error(`Unable to locate packages/theme from ${repositoryRoot}`);
  }
  return { repositoryRoot, webRoot };
}

function gitReleaseSha(): string {
  const configured = process.env.RELEASE_SHA?.trim();
  if (configured) return configured;

  const { repositoryRoot } = resolveRoots();

  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim();
}

function addTreeToHash(
  hash: ReturnType<typeof createHash>,
  directory: string,
  repositoryRoot: string,
): void {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) addTreeToHash(hash, absolutePath, repositoryRoot);
    if (entry.isFile()) {
      hash.update(path.relative(repositoryRoot, absolutePath));
      hash.update('\0');
      hash.update(readFileSync(absolutePath));
      hash.update('\0');
    }
  }
}

export function getWebReleaseMarker() {
  const { repositoryRoot, webRoot } = resolveRoots();
  const releaseSha = gitReleaseSha();
  const themeHash = createHash('sha256');
  addTreeToHash(themeHash, path.join(repositoryRoot, 'packages/theme'), repositoryRoot);
  addTreeToHash(themeHash, path.join(webRoot, 'src/styles'), repositoryRoot);
  const themeId = themeHash.digest('hex').slice(0, 16);

  return {
    application: 'gs-web',
    buildId: `${releaseSha}.${themeId}`,
    releaseSha,
    themeId,
  } as const;
}
