import fs from 'node:fs';
import { execSync } from 'node:child_process';

const canonicalRoots = ['apps/gs-', 'packages/', 'infra/'];
const canonicalTopLevelFiles = new Set(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'turbo.json', 'README.md']);
const legacyCompatFiles = new Set([
  'apps/web/package.json',
  'apps/web/README.md',
  'apps/admin/package.json',
  'apps/admin/README.md',
]);
const disallowed = ['apps/web', 'apps/admin', 'astro-goldshore', 'public', 'src'];

const trackedChangedFiles = execSync('git diff --name-only HEAD', { encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const mutableOutsideCanonical = trackedChangedFiles.filter((file) => {
  if (file.startsWith('.github/workflows/')) return false;
  if (file.startsWith('docs/')) return false;
  if (file.startsWith('scripts/')) return false;
  if (legacyCompatFiles.has(file)) return false;
  if (canonicalTopLevelFiles.has(file)) return false;
  return !canonicalRoots.some((root) => file.startsWith(root));
});

if (mutableOutsideCanonical.length > 0) {
  console.error('❌ Mutation outside canonical scope detected:');
  mutableOutsideCanonical.forEach((file) => console.error(`  - ${file}`));
  process.exit(1);
}

const changedSet = new Set(trackedChangedFiles);
const hasGsWeb = trackedChangedFiles.some((f) => f.startsWith('apps/gs-web/'));
const hasLegacyWeb = trackedChangedFiles.some((f) => f.startsWith('apps/web/') && !legacyCompatFiles.has(f));
const hasGsAdmin = trackedChangedFiles.some((f) => f.startsWith('apps/gs-admin/'));
const hasLegacyAdmin = trackedChangedFiles.some((f) => f.startsWith('apps/admin/'));

if ((hasGsWeb && hasLegacyWeb) || (hasGsAdmin && hasLegacyAdmin)) {
  console.error('❌ Duplicate surface mutation detected (canonical + legacy trees changed together).');
  process.exit(1);
}

let drift = false;
for (const path of disallowed) {
  if (fs.existsSync(path) && Array.from(changedSet).some((f) => (f === path || f.startsWith(`${path}/`)) && !legacyCompatFiles.has(f))) {
    console.warn(`⚠ Structural drift detected: ${path}`);
    drift = true;
  }
}

if (drift) {
  process.exit(1);
}

console.log('✅ Canonical structure valid.');
