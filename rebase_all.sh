#!/bin/bash
set -uo pipefail

# This script is intended to be run by the Gemini CLI agent.

# An array of all branches that have conflicts with main.
CONFLICTING_BRANCHES=(
  "origin/chore/structured-logging-rotate-keys-11470477386224970479"
  "origin/codex/add-merge-or-squash-info-to-commit-descriptions-2026-03-14"
  "origin/codex/add-parallax-hero-and-reusable-modal-2026-03-05"
  "origin/codex/add-parallax-hero-and-reusable-modal-2026-03-19-yx6l2h"
  "origin/codex/audit-and-update-workflow-references-2026-03-23"
  "origin/codex/configure-upstream-remote-and-refresh-refs-2026-03-12"
  "origin/codex/create-dual-frontend-deploy-workflow-2026-03-22"
  "origin/codex/evaluate-gs-web-access-to-gs_config-2026-03-22"
  "origin/codex/fix-critical-and-high-priority-bugs-2026-03-21"
  "origin/codex/fix-critical-and-high-priority-bugs-2026-03-22"
  "origin/codex/fix-high-priority-bugs-from-codex-review-2026-03-01-enshox"
  "origin/codex/fix-high-priority-deployment-bugs-2026-03-21"
  "origin/codex/fix-infra-deployment-for-renamed-gs-api-directory-2026-03-12"
  "origin/codex/github-mention-chore/working-copy-2026-03-19"
  "origin/codex/github-mention-chore/working-copy-2026-03-19-4fdatf"
  "origin/codex/github-mention-chore/working-copy-2026-03-19-mh995h"
  "origin/codex/harden-form-configuration-endpoints-2026-03-22"
  "origin/codex/locate-and-update-legacy-tokens-in-infra-2026-03-14"
  "origin/codex/locate-and-update-legacy-tokens-in-infra-2026-03-15"
  "origin/codex/locate-and-update-legacy-tokens-in-infra-2026-03-17-sde09k"
  "origin/codex/rationalize-manual-workflows-in-.github-2026-03-22"
  "origin/codex/refactor-branch-management-in-maintenance-workflow-2026-03-22"
  "origin/codex/refactor-csp-policies-and-metadata-handling-2026-03-22"
  "origin/codex/refactor-csp-policies-and-metadata-handling-2026-03-22-nnzosy"
  "origin/codex/refactor-csp-policies-and-metadata-handling-2026-03-23"
  "origin/codex/refactor-github-actions-workflows-2026-03-22"
  "origin/codex/refactor-global.css-for-clean-sections-2026-03-21"
  "origin/codex/refactor-status.astro-for-dynamic-operational-states-2026-03-22"
  "origin/codex/refactor-status.astro-for-dynamic-operational-states-2026-03-22-lqvlpp"
  "origin/codex/refactor-status.astro-for-dynamic-operational-states-2026-03-23"
  "origin/codex/replace-and-update-favicons-and-assets-2026-03-12-v88k1q"
  "origin/codex/replace-and-update-favicons-and-assets-2026-03-15-hverby"
  "origin/codex/replace-and-update-favicons-and-assets-2026-03-17-ie6a2x"
  "origin/codex/replace-hardcoded-colors-with-theme-variables-2026-03-13"
  "origin/codex/replace-logo-asset-with-gs-penrose.svg-2026-03-12"
  "origin/codex/resolve-conflicts-with-main-branch-2026-03-12"
  "origin/codex/review-and-update-workflow-models-2026-03-23"
  "origin/codex/review-main-repo-for-errors-2026-03-12"
  "origin/codex/rewrite-and-audit-readme-files-for-apps-2026-03-23"
  "origin/codex/separate-gs-control-worker-and-update-docs-2026-03-22"
  "origin/codex/standardize-cloudflare-worker-configuration-2026-03-18"
  "origin/codex/standardize-deployment-workflows-for-gs-agent-2026-03-23"
  "origin/codex/standardize-workflows-and-add-orchestration-2026-03-22"
  "origin/codex/update-book-strategy-call-target-2026-03-13"
  "origin/codex/update-configuration-and-documentation-2026-03-22"
  "origin/codex/update-organization-access-for-jules-and-codex-2026-03-11"
  "origin/codex/update-package.json-name-and-audit-labels-2026-02-15"
  "origin/codex/update-phase-5-in-validate-rebuild.sh-2026-03-13"
  "origin/codex/update-script-path-in-desired-state.yaml-2026-03-22"
  "origin/dependabot/npm_and_yarn/npm_and_yarn-fcabe22ab3"
  "origin/fix-gs-api-test-gateway-logging-14218566075491479944"
  "origin/fix-key-rotation-logging-2325371727348444016"
  "origin/fix-unimplemented-jose-verification-3846832832841325888"
  "origin/infra-monorepo-foundation"
  "origin/jules-gs-web-perf-opt-3524792721653830271"
  "origin/revert-4267-codex/add-svg-upload-sanitization-tests-2026-03-22"
  "origin/revert-4271-codex/separate-gs-control-worker-and-update-docs-2026-03-22"
  "origin/revert-4275-codex/evaluate-gs-web-access-to-gs_config-2026-03-22"
  "origin/revert-4285-dependabot/github_actions/actions/checkout-6"
  "origin/revert-4290-testing-cloudflare-metrics-17267066169392101118"
  "origin/revert-4330-codex/implement-actual-agent-signal-in-maintenance-workflow-2026-03-22"
  "origin/revert-4338-revert-4285-dependabot/github_actions/actions/checkout-6"
  "origin/revert-4341-revert-4330-codex/implement-actual-agent-signal-in-maintenance-workflow-2026-03-22"
  "origin/revert-4342-revert-4285-dependabot/github_actions/actions/checkout-6"
  "origin/testing-cloudflare-metrics-17267066169392101118"
  "origin/testing-json-utils-9285790993336685030"
)

# Ensure we are on main and up to date
git checkout main

# Log successes and failures
SUCCESS_LOG="rebase_success.log"
FAILURE_LOG="rebase_failure.log"
>"$SUCCESS_LOG"
>"$FAILURE_LOG"

for branch_with_origin in "${CONFLICTING_BRANCHES[@]}"; do
  branch=${branch_with_origin#"origin/"}
  echo "--- Processing branch: $branch ---"

  # Create a local branch tracking the remote, and check it out
  git checkout --track "$branch_with_origin"

  # Attempt to rebase directly
  if git rebase main; then
    echo "SUCCESS: Rebase successful for $branch."
    echo "$branch" >> "$SUCCESS_LOG"
    echo "Note: Changes for $branch are now available locally. They have NOT been pushed to origin."
  else
    echo "FAILURE: Rebase failed for $branch. Aborting rebase and logging."
    git rebase --abort
    echo "$branch" >> "$FAILURE_LOG"
  fi

  # Go back to main for the next iteration
  git checkout main
  # Delete the local branch we just processed to avoid clutter
  git branch -D "$branch"
done

echo "--- Rebase process complete ---"
echo "Successfully rebased branches are listed in $SUCCESS_LOG"
echo "Failed branches are listed in $FAILURE_LOG"
