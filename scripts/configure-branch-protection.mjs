#!/usr/bin/env node

const token = process.env.GH_TOKEN;
const repoSlug = process.env.GITHUB_REPOSITORY;
const branch = process.env.PROTECTED_BRANCH || 'main';

if (!token) {
  throw new Error(
    'Missing GH_TOKEN. Configure the GH_PAT repository secret with branch administration access.',
  );
}
if (!repoSlug || !repoSlug.includes('/')) throw new Error('Missing GITHUB_REPOSITORY (owner/repo)');

const [owner, repo] = repoSlug.split('/');
const requiredChecks = [
  'Required Merge Checks / workspace-install',
  'Required Merge Checks / gs-api-build-test',
  'Required Merge Checks / gs-web-build',
  'Required Merge Checks / deployment-dry-run',
];

const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/${branch}/protection`, {
  method: 'PUT',
  headers: {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  },
  body: JSON.stringify({
    required_status_checks: {
      strict: true,
      contexts: requiredChecks,
    },
    enforce_admins: true,
    // This is a personal repository with a single active maintainer. Keep PRs,
    // strict checks, conversation resolution, and admin enforcement, but do
    // not require approval from a second account controlled by the owner.
    required_pull_request_reviews: null,
    restrictions: null,
    allow_force_pushes: false,
    allow_deletions: false,
    required_linear_history: true,
    block_creations: false,
    required_conversation_resolution: true,
    lock_branch: false,
    allow_fork_syncing: true,
  }),
});

if (!res.ok) {
  throw new Error(`Failed to configure branch protection: ${res.status} ${await res.text()}`);
}

console.log(`Branch protection updated for ${owner}/${repo}@${branch}`);
