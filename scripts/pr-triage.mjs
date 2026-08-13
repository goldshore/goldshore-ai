#!/usr/bin/env node

import { appendFile, readFile } from 'node:fs/promises';
import { evaluatePullRequest } from './pr-triage-rules.mjs';

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const eventPath = process.env.GITHUB_EVENT_PATH;
const repository = process.env.GITHUB_REPOSITORY;

if (!token) throw new Error('Missing GITHUB_TOKEN or GH_TOKEN.');
if (!eventPath) throw new Error('Missing GITHUB_EVENT_PATH.');
if (!repository?.includes('/')) throw new Error('Missing GITHUB_REPOSITORY.');

const [owner, repo] = repository.split('/');
const event = JSON.parse(await readFile(eventPath, 'utf8'));
const number = event.pull_request?.number || event.number;
if (!number)
  throw new Error('The event does not contain a pull request number.');

const rules = JSON.parse(
  await readFile(
    new URL('../.github/pr-triage-ruleset.json', import.meta.url),
    'utf8',
  ),
);

async function api(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) {
    throw new Error(
      `GitHub API ${response.status} for ${path}: ${await response.text()}`,
    );
  }
  return response.json();
}

async function allFiles() {
  const files = [];
  for (let page = 1; ; page += 1) {
    const batch = await api(
      `/repos/${owner}/${repo}/pulls/${number}/files?per_page=100&page=${page}`,
    );
    files.push(...batch);
    if (batch.length < 100) return files;
  }
}

const pr = await api(`/repos/${owner}/${repo}/pulls/${number}`);
const [files, comparison, baseCheckResponse, headCheckResponse] =
  await Promise.all([
    allFiles(),
    api(`/repos/${owner}/${repo}/compare/${pr.base.sha}...${pr.head.sha}`),
    api(
      `/repos/${owner}/${repo}/commits/${pr.base.sha}/check-runs?filter=latest&per_page=100`,
    ),
    api(
      `/repos/${owner}/${repo}/commits/${pr.head.sha}/check-runs?filter=latest&per_page=100`,
    ),
  ]);

const result = evaluatePullRequest(
  {
    pr,
    files,
    comparison,
    baseChecks: baseCheckResponse.check_runs,
    headChecks: headCheckResponse.check_runs,
  },
  rules,
);

const sections = [
  `## PR Triage: ${result.decision.toUpperCase()}`,
  '',
  `- PR: #${number}`,
  `- Base: \`${pr.base.ref}\` at \`${pr.base.sha.slice(0, 8)}\``,
  `- Head: \`${pr.head.ref}\` at \`${pr.head.sha.slice(0, 8)}\``,
  `- Changed files: ${files.length}`,
  `- Ahead/behind: +${comparison.ahead_by || 0} / -${comparison.behind_by || 0}`,
];

for (const [heading, items] of [
  ['Blocking rules', result.blockers],
  ['Merge holds', result.holds],
  ['Notes', result.notes],
]) {
  if (!items.length) continue;
  sections.push('', `### ${heading}`, '', ...items.map((item) => `- ${item}`));
}

const summary = `${sections.join('\n')}\n`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, 'utf8');
}

for (const blocker of result.blockers) console.error(`::error::${blocker}`);
for (const hold of result.holds) console.warn(`::warning::${hold}`);

if (result.blockers.length) process.exitCode = 1;
