import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['wrangler', 'deploy', '--dry-run', '--outdir=dist', '--env', 'prod'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
