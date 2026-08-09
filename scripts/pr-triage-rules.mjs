const PASSING_CONCLUSIONS = new Set(['success', 'neutral', 'skipped']);
const FAILING_CONCLUSIONS = new Set([
  'action_required',
  'cancelled',
  'failure',
  'startup_failure',
  'timed_out',
]);

function labelNames(pr) {
  return new Set(
    (pr.labels || []).map((label) =>
      typeof label === 'string' ? label : label.name,
    ),
  );
}

function checkState(checkRuns = [], ignoredNames = []) {
  const ignored = new Set(ignoredNames);
  const relevant = checkRuns.filter((run) => !ignored.has(run.name));
  const failures = relevant.filter((run) =>
    FAILING_CONCLUSIONS.has(run.conclusion),
  );
  const pending = relevant.filter(
    (run) =>
      run.status !== 'completed' ||
      (!run.conclusion && !PASSING_CONCLUSIONS.has(run.conclusion)),
  );
  return { failures, pending };
}

function addedOrModified(file) {
  return file.status !== 'removed';
}

export function evaluatePullRequest(input, rules) {
  const {
    pr,
    files = [],
    comparison = {},
    baseChecks = [],
    headChecks = [],
  } = input;
  const labels = labelNames(pr);
  const blockers = [];
  const holds = [];
  const notes = [];
  const approvals = rules.approvalLabels;

  if (!rules.allowedBaseBranches.includes(pr.base?.ref)) {
    blockers.push(`Base branch ${pr.base?.ref || '(missing)'} is not allowed.`);
  }

  if (pr.draft) holds.push('Pull request is a draft.');

  if (pr.mergeable_state === 'dirty') {
    blockers.push('Pull request has merge conflicts.');
  } else if (
    ['behind', 'blocked', 'unstable', 'unknown'].includes(pr.mergeable_state)
  ) {
    holds.push(`GitHub merge state is ${pr.mergeable_state}.`);
  }

  const illegalApps = files.filter((file) => {
    const match = file.filename.match(/^apps\/([^/]+)\//);
    return (
      match && !rules.canonicalApps.includes(match[1]) && addedOrModified(file)
    );
  });
  if (illegalApps.length) {
    blockers.push(
      `Satellite app changes are prohibited: ${illegalApps.map((file) => file.filename).join(', ')}`,
    );
  }

  const illegalDeployWorkflows = files.filter(
    (file) =>
      /^\.github\/workflows\/deploy-.*\.ya?ml$/.test(file.filename) &&
      !rules.allowedDeployWorkflows.includes(file.filename) &&
      addedOrModified(file),
  );
  if (illegalDeployWorkflows.length) {
    blockers.push(
      `Noncanonical deploy workflows are prohibited: ${illegalDeployWorkflows
        .map((file) => file.filename)
        .join(', ')}`,
    );
  }

  if (
    files.length > rules.maxChangedFiles &&
    !labels.has(approvals.largeChange)
  ) {
    blockers.push(
      `${files.length} changed files exceeds the ${rules.maxChangedFiles}-file limit without ${approvals.largeChange}.`,
    );
  }

  const isRevertBranch = rules.revertBranchPrefixes.some((prefix) =>
    (pr.head?.ref || '').startsWith(prefix),
  );
  if (isRevertBranch && !labels.has(approvals.revert)) {
    blockers.push(`Revert branches require the ${approvals.revert} label.`);
  }

  if (
    files.length > 0 &&
    comparison.ahead_by === 0 &&
    !labels.has(approvals.reapply)
  ) {
    blockers.push(
      `Head has no commits ahead of the base; a reverted-lineage reapplication requires ${approvals.reapply}.`,
    );
  }

  if ((comparison.behind_by || 0) > 0) {
    holds.push(
      `Branch is ${comparison.behind_by} commit(s) behind ${pr.base?.ref}.`,
    );
  }

  const baseState = checkState(baseChecks, ['PR Triage']);
  if (baseState.failures.length && !labels.has(approvals.baseRepair)) {
    holds.push(
      `Base branch has failing checks: ${baseState.failures.map((run) => run.name).join(', ')}.`,
    );
  } else if (baseState.failures.length) {
    notes.push(
      `Base failures accepted for focused repair via ${approvals.baseRepair}.`,
    );
  }

  const headState = checkState(headChecks, ['PR Triage']);
  if (headState.failures.length) {
    holds.push(
      `Head has failing checks: ${headState.failures.map((run) => run.name).join(', ')}.`,
    );
  }
  if (headState.pending.length) {
    holds.push(
      `Head has pending checks: ${headState.pending.map((run) => run.name).join(', ')}.`,
    );
  }

  const decision = blockers.length
    ? 'blocked'
    : holds.length
      ? 'hold'
      : 'ready';
  return { decision, blockers, holds, notes };
}
