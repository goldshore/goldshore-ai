import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePullRequest } from './pr-triage-rules.mjs';

const rules = {
  allowedBaseBranches: ['main'],
  canonicalApps: ['gs-web', 'gs-api'],
  allowedDeployWorkflows: [
    '.github/workflows/deploy-gs-api.yml',
    '.github/workflows/deploy-gs-web.yml',
  ],
  maxChangedFiles: 40,
  approvalLabels: {
    largeChange: 'triage:large-approved',
    revert: 'triage:revert-approved',
    reapply: 'triage:reapply-approved',
    baseRepair: 'triage:base-repair',
  },
  revertBranchPrefixes: ['revert-'],
};

function input(overrides = {}) {
  return {
    pr: {
      base: { ref: 'main' },
      head: { ref: 'agent/focused-change' },
      labels: [],
      draft: false,
      mergeable_state: 'clean',
      ...(overrides.pr || {}),
    },
    files: [{ filename: 'apps/gs-api/src/index.ts', status: 'modified' }],
    comparison: { ahead_by: 1, behind_by: 0 },
    baseChecks: [{ name: 'CI', status: 'completed', conclusion: 'success' }],
    headChecks: [{ name: 'CI', status: 'completed', conclusion: 'success' }],
    ...overrides,
  };
}

test('allows a focused, clean, green two-app change', () => {
  assert.equal(evaluatePullRequest(input(), rules).decision, 'ready');
});

test('blocks added satellite apps but allows their removal', () => {
  const added = evaluatePullRequest(
    input({
      files: [{ filename: 'apps/gs-gateway/src/index.ts', status: 'added' }],
    }),
    rules,
  );
  assert.equal(added.decision, 'blocked');
  assert.match(added.blockers[0], /Satellite app/);

  const removed = evaluatePullRequest(
    input({
      files: [{ filename: 'apps/gs-gateway/src/index.ts', status: 'removed' }],
    }),
    rules,
  );
  assert.equal(removed.decision, 'ready');
});

test('blocks noncanonical deploy workflows', () => {
  const result = evaluatePullRequest(
    input({
      files: [
        { filename: '.github/workflows/deploy-gs-mail.yml', status: 'added' },
      ],
    }),
    rules,
  );
  assert.equal(result.decision, 'blocked');
  assert.match(result.blockers[0], /Noncanonical deploy workflows/);
});

test('requires approval for broad changes', () => {
  const files = Array.from({ length: 41 }, (_, index) => ({
    filename: `apps/gs-web/src/pages/page-${index}.astro`,
    status: 'modified',
  }));
  const result = evaluatePullRequest(input({ files }), rules);
  assert.equal(result.decision, 'blocked');
  assert.match(result.blockers[0], /triage:large-approved/);
});

test('blocks unapproved revert and reverted-lineage branches', () => {
  const revert = evaluatePullRequest(
    input({ pr: { ...input().pr, head: { ref: 'revert-123-feature' } } }),
    rules,
  );
  assert.equal(revert.decision, 'blocked');
  assert.match(revert.blockers[0], /triage:revert-approved/);

  const reapplied = evaluatePullRequest(
    input({ comparison: { ahead_by: 0, behind_by: 3 } }),
    rules,
  );
  assert.equal(reapplied.decision, 'blocked');
  assert.match(reapplied.blockers[0], /triage:reapply-approved/);
});

test('holds drafts, behind branches, and red checks without creating a circular gate', () => {
  const result = evaluatePullRequest(
    input({
      pr: { ...input().pr, draft: true, mergeable_state: 'behind' },
      comparison: { ahead_by: 1, behind_by: 2 },
      baseChecks: [{ name: 'CI', status: 'completed', conclusion: 'failure' }],
      headChecks: [
        { name: 'Workers Builds', status: 'completed', conclusion: 'failure' },
      ],
    }),
    rules,
  );
  assert.equal(result.decision, 'hold');
  assert.equal(result.blockers.length, 0);
  assert.ok(result.holds.some((hold) => hold.includes('draft')));
  assert.ok(result.holds.some((hold) => hold.includes('Base branch')));
  assert.ok(
    result.holds.some((hold) => hold.includes('Head has failing checks')),
  );
});
