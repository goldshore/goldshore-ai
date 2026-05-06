import fs from 'node:fs';
import { execSync } from 'node:child_process';

const REPORT_PATH = 'docs/ci/CURRENT_STATE.md';

/**
 * Standardized command runner with error suppression for verification checks.
 */
const run = (cmd) => {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

const gitRefExists = (ref) => {
  try {
    execSync(`git rev-parse --verify ${ref}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const resolveBaseRef = () => {
  if (gitRefExists('origin/main')) return 'origin/main';
  if (gitRefExists('main')) return 'main';
  return null;
};

// 1. Ensure report exists
if (!fs.existsSync(REPORT_PATH)) {
  console.error(`❌ Missing report: ${REPORT_PATH}`);
  process.exit(1);
}

const content = fs.readFileSync(REPORT_PATH, 'utf8');
const currentBranch = run('git rev-parse --abbrev-ref HEAD');

// 2. Parse Metadata using Regex
const branchMatch = content.match(/\*\*Current Branch:\*\*\s*(.+)/);
const divergenceMatch = content.match(/\*\*Divergence vs ([^:]+):\*\*\s*Behind:\s*(\d+),\s*Ahead:\s*(\d+)/);

if (!branchMatch || !divergenceMatch) {
  console.error('❌ CURRENT_STATE.md is missing required branch metadata fields.');
  process.exit(1);
}

// 3. Validate Branch Name
if (branchMatch[1].trim() !== currentBranch) {
  console.error(`❌ Stale branch metadata: Report says "${branchMatch[1].trim()}", but actual is "${currentBranch}".`);
  process.exit(1);
}

// 4. Validate Divergence (Behind/Ahead counts)
const baseRef = resolveBaseRef();
if (!baseRef) {
  console.log('⚠️ Skipping divergence freshness check: No main tracking ref available.');
  process.exit(0);
}

const divergenceResult = run(`git rev-list --left-right --count ${baseRef}...HEAD`);
if (!divergenceResult) {
  console.error('❌ Failed to calculate git divergence.');
  process.exit(1);
}

const [behind, ahead] = divergenceResult.split(/\s+/);

const reportBase = divergenceMatch[1].trim();
const reportBehind = divergenceMatch[2].trim();
const reportAhead = divergenceMatch[3].trim();

if (reportBase !== baseRef || reportBehind !== behind || reportAhead !== ahead) {
  console.error(`❌ Stale divergence metadata detected.`);
  console.error(`Expected: ${baseRef} (Behind: ${behind}, Ahead: ${ahead})`);
  console.error(`Found in report: ${reportBase} (Behind: ${reportBehind}, Ahead: ${reportAhead})`);
  process.exit(1);
}

console.log('✅ CURRENT_STATE.md branch metadata is fresh and verified.');
process.exit(0);
