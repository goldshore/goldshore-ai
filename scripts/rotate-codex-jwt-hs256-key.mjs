#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const SECRET_NAME = 'CODEX_JWT_HS256_KEY';
const DEFAULT_CLOUDFLARE_WORKERS = [
  'gs-agent',
  'gs-api',
  'gs-control',
  'gs-gateway',
  'gs-platform'
];

function usage() {
  console.log(`Usage: node scripts/rotate-codex-jwt-hs256-key.mjs --repo OWNER/REPO [options]\n\nGenerates a 512-bit HS256 key without printing it, stores it in GitHub and Cloudflare secrets, and prints only a SHA-256 fingerprint.\n\nOptions:\n  --repo OWNER/REPO              GitHub repository whose secret should be updated.\n  --cloudflare-workers a,b,c     Worker names to update. Defaults to: ${DEFAULT_CLOUDFLARE_WORKERS.join(', ')}\n  --skip-github                  Do not update the GitHub repository secret.\n  --skip-cloudflare              Do not update Cloudflare Worker secrets.\n  --dry-run                      Generate a key and report planned updates without writing secret stores.\n  --old-fingerprint SHA256       Record the previous key fingerprint in the output checklist.\n  --help                         Show this help.\n\nRequired CLIs when not skipped/dry-run:\n  - gh, authenticated with permission to write repository secrets\n  - pnpm exec wrangler, authenticated for the target Cloudflare account\n`);
}

function parseArgs(argv) {
  const args = {
    repo: undefined,
    cloudflareWorkers: DEFAULT_CLOUDFLARE_WORKERS,
    skipGithub: false,
    skipCloudflare: false,
    dryRun: false,
    oldFingerprint: undefined
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help') {
      usage();
      process.exit(0);
    } else if (arg === '--repo') {
      args.repo = argv[++i];
    } else if (arg === '--cloudflare-workers') {
      args.cloudflareWorkers = argv[++i].split(',').map((worker) => worker.trim()).filter(Boolean);
    } else if (arg === '--skip-github') {
      args.skipGithub = true;
    } else if (arg === '--skip-cloudflare') {
      args.skipCloudflare = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--old-fingerprint') {
      args.oldFingerprint = argv[++i];
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.repo && !args.skipGithub) {
    throw new Error('--repo OWNER/REPO is required unless --skip-github is set.');
  }

  return args;
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    ...options,
    encoding: 'utf8',
    stdio: options.input ? ['pipe', 'pipe', 'pipe'] : 'pipe'
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(' ')} failed:\n${result.stderr || result.stdout}`);
  }

  return result;
}

function commandExists(command, commandArgs = ['--version']) {
  const result = spawnSync(command, commandArgs, { encoding: 'utf8', stdio: 'ignore' });
  return result.status === 0;
}

function requireCommand(command, commandArgs) {
  if (!commandExists(command, commandArgs)) {
    throw new Error(`Required command is unavailable or not authenticated: ${command} ${commandArgs.join(' ')}`);
  }
}

function writeGithubSecret(repo, secret) {
  requireCommand('gh', ['auth', 'status']);
  run('gh', ['secret', 'set', SECRET_NAME, '--repo', repo, '--body', secret]);
}

function writeCloudflareSecret(worker, secret) {
  run('pnpm', ['exec', 'wrangler', 'secret', 'put', SECRET_NAME, '--name', worker], { input: `${secret}\n` });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const secret = randomBytes(64).toString('base64url');
  const fingerprint = createHash('sha256').update(secret, 'utf8').digest('hex');

  console.log(`Generated ${SECRET_NAME} with 512 bits of entropy.`);
  console.log(`New key SHA-256 fingerprint: ${fingerprint}`);
  console.log('The key value was not printed.');

  if (args.oldFingerprint) {
    console.log(`Previous key SHA-256 fingerprint to add to deny lists: ${args.oldFingerprint}`);
  }

  if (args.dryRun) {
    console.log('Dry run: no remote secret stores were updated.');
  } else {
    if (!args.skipGithub) {
      writeGithubSecret(args.repo, secret);
      console.log(`Updated GitHub secret ${SECRET_NAME} for ${args.repo}.`);
    }

    if (!args.skipCloudflare) {
      for (const worker of args.cloudflareWorkers) {
        writeCloudflareSecret(worker, secret);
        console.log(`Updated Cloudflare Worker secret ${SECRET_NAME} for ${worker}.`);
      }
    }
  }

  console.log('\nCutover checklist:');
  console.log('- Redeploy affected workers/services so the new runtime secret is loaded.');
  console.log('- Invalidate active Codex JWT sessions or temporarily reduce JWT max age during rollout.');
  console.log('- Search repositories and operational logs for the previous key value and both key fingerprints.');
  console.log('- Add the previous key fingerprint to supported secret-scanning deny lists.');
}

main();
