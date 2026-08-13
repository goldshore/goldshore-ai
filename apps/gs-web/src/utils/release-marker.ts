import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const workingDirectory = process.cwd();
const webRoot = existsSync(path.join(workingDirectory, 'src', 'styles'))
  ? workingDirectory
  : path.join(workingDirectory, 'apps', 'gs-web');
const repositoryRoot = path.resolve(webRoot, '../..');

function gitReleaseSha(): string {
  const configured = process.env.RELEASE_SHA?.trim();
  if (configured) return configured;

  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim();
}

function addTreeToHash(hash: ReturnType<typeof createHash>, directory: string): void {
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
