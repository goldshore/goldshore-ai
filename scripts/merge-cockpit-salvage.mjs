import { execFileSync } from 'node:child_process';

const run = (command, args, options = {}) => execFileSync(command, args, {
  encoding: 'utf8',
  stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  ...options,
});

const capture = (command, args) => run(command, args, { capture: true }).trim();
const shaPattern = /^[a-f0-9]{40}$/i;
const prNumber = process.env.MERGE_COCKPIT_PR_NUMBER ?? '';
const expectedBase = process.env.MERGE_COCKPIT_BASE_SHA ?? '';
const expectedHead = process.env.MERGE_COCKPIT_HEAD_SHA ?? '';
const rawResolutions = process.env.MERGE_COCKPIT_RESOLUTIONS ?? '{}';

if (!/^\d+$/.test(prNumber) || !shaPattern.test(expectedBase) || !shaPattern.test(expectedHead)) {
  throw new Error('Invalid merge cockpit PR number or immutable SHA input.');
}

let resolutions;
try {
  resolutions = JSON.parse(rawResolutions);
} catch {
  throw new Error('resolutions_json must be valid JSON.');
}
if (!resolutions || typeof resolutions !== 'object' || Array.isArray(resolutions)) {
  throw new Error('resolutions_json must be an object keyed by repository path.');
}

run('git', [
  'fetch', '--no-tags', 'origin',
  'main:refs/remotes/origin/main',
  `refs/pull/${prNumber}/head:refs/merge-cockpit/incoming`,
]);
const actualBase = capture('git', ['rev-parse', 'origin/main']);
const actualHead = capture('git', ['rev-parse', 'refs/merge-cockpit/incoming']);
if (actualBase !== expectedBase || actualHead !== expectedHead) {
  throw new Error(`SHA lock failed. expected ${expectedBase}/${expectedHead}, found ${actualBase}/${actualHead}. Refresh the cockpit.`);
}

const branch = `merge-cockpit/pr-${prNumber}-${expectedHead.slice(0, 8)}`;
run('git', ['checkout', '-B', branch, expectedBase]);
run('git', ['config', 'user.name', 'Goldshore AI']);
run('git', ['config', 'user.email', 'admin@goldshore.org']);

try {
  run('git', ['merge', '--no-commit', '--no-ff', expectedHead]);
} catch {
  // Expected when the source branch has textual conflicts. The explicit
  // resolution map below must account for every remaining unmerged path.
}

for (const [filename, resolution] of Object.entries(resolutions)) {
  if (!['current', 'incoming'].includes(String(resolution)) || filename.includes('\0') || filename.includes('\n') ||
      filename.startsWith('/') || filename.split('/').includes('..')) {
    throw new Error(`Invalid resolution for ${filename}.`);
  }
  const source = resolution === 'current' ? expectedBase : expectedHead;
  let exists = true;
  try {
    run('git', ['cat-file', '-e', `${source}:${filename}`], { stdio: 'ignore' });
  } catch {
    exists = false;
  }
  if (exists) run('git', ['checkout', source, '--', filename]);
  else run('git', ['rm', '-f', '--ignore-unmatch', '--', filename]);
  run('git', ['add', '--', filename]);
}

const unresolved = capture('git', ['diff', '--name-only', '--diff-filter=U']);
if (unresolved) {
  throw new Error(`Unresolved paths remain:\n${unresolved}`);
}

run('git', ['commit', '-m', 'Merge strategy: squash', '-m', `Salvage PR #${prNumber} with cockpit-reviewed conflict decisions.`]);
run('git', ['push', '--force-with-lease', '--set-upstream', 'origin', branch]);

const existing = capture('gh', [
  'pr', 'list', '--head', branch, '--state', 'open', '--json', 'url', '--jq', '.[0].url // ""',
]);
if (existing) {
  console.log(`Salvage PR already open: ${existing}`);
} else {
  run('gh', [
    'pr', 'create', '--draft', '--base', 'main', '--head', branch,
    '--title', `Salvage #${prNumber}: SHA-locked conflict resolution`,
    '--body', [
      'Merge strategy: squash',
      '',
      `Cockpit-generated salvage of #${prNumber}.`,
      '',
      `Locked base: \`${expectedBase}\``,
      `Locked incoming head: \`${expectedHead}\``,
      '',
      'The original PR remains unchanged. Review this draft and require every GitHub and external Cloudflare check before merging.',
    ].join('\n'),
  ]);
}
