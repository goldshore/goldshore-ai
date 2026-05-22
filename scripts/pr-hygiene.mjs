#!/usr/bin/env node

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const repoSlug = process.env.GITHUB_REPOSITORY;
const staleDays = Number(process.env.STALE_DAYS || 3);

if (!token) {
  throw new Error('Missing GH_TOKEN or GITHUB_TOKEN');
}
if (!repoSlug || !repoSlug.includes('/')) {
  throw new Error('Missing GITHUB_REPOSITORY (expected owner/repo)');
}

const [owner, repo] = repoSlug.split('/');
const apiBase = 'https://api.github.com';

async function gh(path, options = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status} ${path}: ${body}`);
  }
  return res.status === 204 ? null : res.json();
}

function olderThanDays(dateString, days) {
  const created = new Date(dateString).getTime();
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  return created < threshold;
}

function hasRedChecks(checkRuns = []) {
  const bad = new Set(['action_required', 'cancelled', 'failure', 'startup_failure', 'timed_out']);
  return checkRuns.some((run) => bad.has(run.conclusion));
}

(async function main() {
  const openPRs = await gh(`/repos/${owner}/${repo}/pulls?state=open&per_page=100`);

  for (const pr of openPRs) {
    if (!olderThanDays(pr.created_at, staleDays)) continue;
    if (pr.draft) continue;

    const labels = (pr.labels || []).map((l) => l.name);
    if (labels.includes('keep-open')) continue;

    const detail = await gh(`/repos/${owner}/${repo}/pulls/${pr.number}`);
    const checks = await gh(`/repos/${owner}/${repo}/commits/${pr.head.sha}/check-runs?per_page=100`);

    const conflicted = detail.mergeable_state === 'dirty';
    const redCI = hasRedChecks(checks.check_runs || []);

    if (!conflicted && !redCI) continue;

    const replacementPRs = openPRs.filter((candidate) => {
      const body = `${candidate.body || ''}`.toLowerCase();
      const title = `${candidate.title || ''}`.toLowerCase();
      return candidate.number !== pr.number && (body.includes(`supersedes #${pr.number}`) || title.includes(`supersedes #${pr.number}`));
    });

    const replacementRef = replacementPRs[0] ? `#${replacementPRs[0].number}` : 'replacement PR pending from a clean branch';

    await gh(`/repos/${owner}/${repo}/issues/${pr.number}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        body: `Closing as superseded (older than ${staleDays} days with ${conflicted ? 'merge conflicts' : 'red CI'}). Replacement reference: ${replacementRef}.`,
      }),
    });

    await gh(`/repos/${owner}/${repo}/pulls/${pr.number}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'closed' }),
    });

    console.log(`Closed PR #${pr.number} as superseded. Replacement: ${replacementRef}`);
  }
})();
