import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// --- Configuration Constants ---
const REPORT_PATH = 'docs/ci/CURRENT_STATE.md';
const APPS_DIR = 'apps';
const WORKFLOW_DIR = '.github/workflows';

const ALLOWED_APPS = [
  'gs-web',
  'gs-admin',
  'gs-api',
  'gs-mail',
  'gs-gateway',
  'gs-agent',
  'gs-control',
];

const BASELINE_BUILD_SCRIPTS = [
  'dev',
  'build',
  'build:openapi',
  'lint',
  'test',
  'check:pages',
  'scan:pii',
  'check:docs-consistency',
  'check:theme-exports',
  'check:naming',
  'validate:structure',
  'validate:names',
  'validate:workers',
  'validate:workspace',
  'validate',
  'branch:bootstrap',
  'scaffold:worker',
  'workspaces:list',
  'verify:workspace-filters',
  'verify:web-dist',
  'memory:check',
  'sync:infra',
  'sync:cf',
  'repo:clean',
  'repo:install',
  'repo:health',
  'audit',
  'build:api',
  'build:control',
];

const KNOWN_WORKFLOWS = [
  'archive-path-guard.yml',
  'canonical-structure-check.yml',
  'deploy-gs-admin.yml',
  'deploy-gs-agent.yml',
  'deploy-gs-api.yml',
  'deploy-gs-control.yml',
  'deploy-gs-gateway.yml',
  'deploy-gs-mail.yml',
  'deploy-gs-web.yml',
  'lockfile-guard.yml',
  'maintenance-gs-sync.yml',
  'maintenance.yml',
  'naming-guard.yml',
  'naming-lint.yml',
  'neuralegion.yml',
  'palette-manual.yml',
  'pii-scan.yml',
  'preview-gs-agent.yml',
  'preview-gs-admin.yml',
  'preview-gs-api.yml',
  'preview-gs-gateway.yml',
  'preview-gs-web.yml',
  'route-collision-check.yml',
  'sonarcloud.yml',
  'summary.yml',
  'tfsec.yml',
  'stabilization-task.yml',
];

const ALLOWED_ACTIONS = [
  'actions/checkout',
  'actions/setup-node',
  'actions/upload-artifact',
  'aquasecurity/tfsec-sarif-action',
  'cloudflare/pages-action',
  'github/codeql-action/upload-sarif',
  'pnpm/action-setup',
  'stefanzweifel/git-auto-commit-action',
  'NeuraLegion/run-scan',
  'SonarSource/sonarcloud-github-action',
];

// --- State Tracking ---
const governanceViolations = [];
const appLevelIssues = [];

// --- Utilities ---
const run = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();
const tryRun = (cmd) => {
  try {
    return run(cmd);
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

function resolveBaseRef() {
  if (gitRefExists('origin/main')) return 'origin/main';
  if (gitRefExists('main')) return 'main';
  return null;
}

function getBranchInfo() {
  const branch = run('git rev-parse --abbrev-ref HEAD');
  const baseRef = resolveBaseRef();
  if (!baseRef) {
    return {
      branch,
      baseRef: 'main (unavailable)',
      behind: 0,
      ahead: 0,
      divergenceNote:
        '⚠️ Could not resolve main tracking ref; divergence defaults to 0/0.',
    };
  }
  const [behindRaw, aheadRaw] = run(
    `git rev-list --left-right --count ${baseRef}...HEAD`,
  ).split(/\s+/);
  return {
    branch,
    baseRef,
    behind: parseInt(behindRaw, 10),
    ahead: parseInt(aheadRaw, 10),
  };
}

function resolveCiBranch(branch) {
  if (process.env.GITHUB_HEAD_REF) return process.env.GITHUB_HEAD_REF;
  if (process.env.GITHUB_REF?.startsWith('refs/heads/')) return process.env.GITHUB_REF.slice('refs/heads/'.length);
  if (process.env.GITHUB_REF_NAME && process.env.GITHUB_REF_NAME !== 'merge') return process.env.GITHUB_REF_NAME;
  if (branch && branch !== 'HEAD') return branch;

  const baseRef = resolveBaseRef();
  return baseRef ? baseRef.replace(/^origin\//, '') : 'main';
}

function getCiStatus(branch) {
  if (!tryRun('gh --version')) return { summary: '⚠️ gh CLI unavailable.' };

  const ciBranch = resolveCiBranch(branch);
  const prNumber = process.env.GITHUB_REF?.startsWith('refs/pull/')
    ? process.env.GITHUB_REF.split('/')[2]
    : tryRun(`gh pr list --head "${ciBranch}" --state open --limit 1 --json number --jq '.[0].number'`);

  if (prNumber) {
    const prData = tryRun(
      `gh pr view ${prNumber} --json number,url,statusCheckRollup`,
    );
    if (!prData)
      return { summary: `⚠️ Unable to fetch checks for PR #${prNumber}.` };

    const pr = JSON.parse(prData);
    const checks = (pr.statusCheckRollup || []).map((item) => ({
      name: item.name || item.context,
      status:
        item.status || (item.state === 'PENDING' ? 'IN_PROGRESS' : 'COMPLETED'),
      conclusion:
        item.conclusion || (item.state === 'SUCCESS' ? 'SUCCESS' : item.state),
    }));

    const hasFailed = checks.some((c) =>
      ['FAILURE', 'TIMED_OUT', 'CANCELLED'].includes(c.conclusion),
    );
    const state = hasFailed
      ? '❌ FAIL'
      : checks.every((c) => c.status === 'COMPLETED')
        ? '✅ PASS'
        : '🟡 PENDING';
    return {
      summary: `${state} PR #${pr.number} checks. [Link](${pr.url})`,
      checks,
    };
  }

  const runsRaw = tryRun(`gh run list --branch "${ciBranch}" --limit 10 --json workflowName,displayTitle,status,conclusion,url`);
  if (!runsRaw) {
    return { summary: `⚠️ No active PR found and unable to fetch recent workflow runs for branch '${ciBranch}'.` };
  }

  const runs = JSON.parse(runsRaw);
  if (!runs.length) {
    return { summary: `⚠️ No active PR found and no recent workflow runs detected for branch '${ciBranch}'.` };
  }

  const hasFailed = runs.some((r) =>
    [
      'failure',
      'timed_out',
      'cancelled',
      'action_required',
      'startup_failure',
    ].includes((r.conclusion || '').toLowerCase()),
  );
  const hasPending = runs.some(
    (r) => (r.status || '').toLowerCase() !== 'completed',
  );
  const state = hasFailed ? '❌ FAIL' : hasPending ? '🟡 PENDING' : '✅ PASS';
  const checks = runs.map((r) => ({
    name: r.workflowName || r.displayTitle,
    status: (r.status || '').toUpperCase(),
    conclusion: (r.conclusion || '').toUpperCase() || 'N/A',
    url: r.url,
  }));

  return {
    summary: `${state} Recent workflow runs for branch '${ciBranch}' (${runs.length} checked).`,
    checks,
  };
}

function checkBranchDiscipline() {
  if (!tryRun('gh --version')) return [];
  const discViolations = [];
  const openPrsRaw = tryRun(
    `gh pr list --state open --json number,baseRefName,autoMergeRequest`,
  );
  if (openPrsRaw) {
    JSON.parse(openPrsRaw).forEach((pr) => {
      if (pr.baseRefName !== 'main')
        discViolations.push(
          `PR #${pr.number} targets '${pr.baseRefName}' (not 'main').`,
        );
      if (pr.autoMergeRequest)
        discViolations.push(
          `PR #${pr.number} has auto-merge enabled (discouraged).`,
        );
    });
  }
  return discViolations;
}

function checkBuild(name, command) {
  try {
    execSync(command, { stdio: 'ignore' });
    return `| **${name}** | ✅ PASS | |`;
  } catch {
    appLevelIssues.push(`${name} build failed`);
    return `| **${name}** | ❌ FAIL | Check logs |`;
  }
}

// --- Report Generation ---
const { branch, behind, ahead, divergenceNote } = getBranchInfo();
let report = `# Stabilization Sync Check Report\n\n**Date:** ${new Date().toUTCString()}\n\n`;

// Section 1: Governance
report += '## 1. Governance Compliance Check\n\n';

const apps = fs
  .readdirSync(APPS_DIR)
  .filter((f) => fs.statSync(path.join(APPS_DIR, f)).isDirectory());
apps
  .filter((a) => !ALLOWED_APPS.includes(a))
  .forEach((a) => governanceViolations.push(`Forbidden app directory: ${a}`));

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
Object.keys(pkg.scripts || {})
  .filter((s) => !BASELINE_BUILD_SCRIPTS.includes(s))
  .forEach((s) => governanceViolations.push(`Unauthorized root script: ${s}`));

const workflows = fs.readdirSync(WORKFLOW_DIR);
workflows
  .filter((w) => !KNOWN_WORKFLOWS.includes(w))
  .forEach((w) => governanceViolations.push(`Unknown workflow file: ${w}`));

// Deep scan workflows for unpinned/unauthorized actions
workflows
  .filter((w) => w.endsWith('.yml'))
  .forEach((w) => {
    const content = fs.readFileSync(path.join(WORKFLOW_DIR, w), 'utf8');
    const actionMatches = content.matchAll(/uses:\s*([\w\-\/]+)@([^\s]+)/g);
    for (const match of actionMatches) {
      const [, action, version] = match;
      if (!ALLOWED_ACTIONS.includes(action))
        governanceViolations.push(`Unauthorized Action: ${action} in ${w}`);
      if (!/^[0-9a-fA-F]{40}$/.test(version))
        governanceViolations.push(
          `Unpinned Action: ${action}@${version} in ${w} (use SHA)`,
        );
    }
  });

if (governanceViolations.length) {
  report += '### ❌ Violations Detected\n';
  governanceViolations.forEach((v) => (report += `- ${v}\n`));
  report += '\n**Action:** Do not self-fix. Escalate via comment only.\n\n';
} else {
  report += '✅ No governance violations detected.\n\n';
}

// Section 2: Branch Discipline
report += `## 2. Branch Discipline Check\n\n**Branch:** ${branch} | **Divergence:** -${behind} / +${ahead}\n\n`;
if (divergenceNote) report += `${divergenceNote}\n\n`;
const branchViolations = checkBranchDiscipline();
branchViolations.forEach((v) => (report += `- ${v}\n`));

// Section 3: CI Status
report += '## 3. CI State Snapshot\n\n' + getCiStatus(branch).summary + '\n\n';
report +=
  '### Local Build Verification\n\n| App | Status | Notes |\n|---|---|---|\n';
['gs-web', 'gs-admin', 'gs-api', 'gs-mail'].forEach((app) => {
  report += checkBuild(app, `pnpm --filter @goldshore/${app} build`) + '\n';
});

// Section 4 & 5: Repairs & Recommendations
report += `\n## 4. App-Level Repairs\n\n${appLevelIssues.length ? '❌ Failures: ' + appLevelIssues.join(', ') : '✅ None required.'}\n\n`;
report += '## 5. Recommendations\n\n';
if (
  governanceViolations.length ||
  appLevelIssues.length ||
  branchViolations.length
) {
  report +=
    '### ❌ Actions Required\n- Fix app-level build issues in `apps/*`.\n- Escalate governance violations.\n';
} else {
  report += '### ✅ Clean State\nNo immediate actions required.\n';
}

// Finalize
if (!fs.existsSync(path.dirname(REPORT_PATH)))
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, report);
console.log(`Report successfully generated at ${REPORT_PATH}`);
process.exit(0);
