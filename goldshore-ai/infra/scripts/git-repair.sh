#!/usr/bin/env bash
#
# GIT HISTORY REPAIR SCRIPT (SOP-001)
# Targets: goldshore/Astro-goldshore
#
# This script identifies all open PRs with conflicts and forces a clean rebase onto 'main'.
# NOTE: This relies on GitHub CLI (`gh`) being installed in the execution environment (Jules/Actions).

set -euo pipefail

OWNER="goldshore"
REPO="Astro-goldshore"
BASE_BRANCH="main"

ensure_local_branch() {
    local branch="$1"

    # If branch already exists locally, nothing to do.
    if git show-ref --verify --quiet "refs/heads/${branch}"; then
        return 0
    fi

    # Attempt to materialize a local tracking branch from origin.
    if git ls-remote --exit-code --heads origin "${branch}" > /dev/null 2>&1; then
        git fetch origin "${branch}:${branch}"
        return 0
    fi

    return 1
}

echo "--- JULES AI: GITHUB CONFLICT REPAIR INITIATED ---"
echo "Targeting repository: ${OWNER}/${REPO}"

# Check for required gh CLI
if ! command -v gh &> /dev/null
then
    echo "ERROR: GitHub CLI 'gh' not found. Cannot list PRs."
    exit 1
fi

# 1. Fetch latest changes for synchronization
echo "1. Fetching latest state of ${BASE_BRANCH}..."
git fetch origin "${BASE_BRANCH}"
git checkout "${BASE_BRANCH}"

# 2. Get list of open Pull Requests that require conflict resolution
PR_LIST=$(gh pr list --repo "${OWNER}/${REPO}" --state open --json number,headRefName,mergeableStatus --jq '.[] | select(.mergeableStatus == "dirty") | .headRefName')

if [ -z "$PR_LIST" ]; then
    echo "2. No conflicting Pull Requests found. Exiting."
    exit 0
fi

echo "3. Starting rebase and conflict resolution loop for branches:"

# Convert the newline-separated list into an array
mapfile -t CONFLICT_BRANCHES <<< "$PR_LIST"

for BRANCH in "${CONFLICT_BRANCHES[@]}"; do
    BRANCH=$(echo "$BRANCH" | xargs)
    if [ -z "$BRANCH" ]; then continue; fi

    echo "  - Processing branch: ${BRANCH}"

    if ! git checkout "${BRANCH}"; then
        echo "  - ERROR: Cannot checkout branch ${BRANCH}"
    if ! ensure_local_branch "${BRANCH}"; then
        echo "  - ERROR: Branch ${BRANCH} does not exist on origin. Skipping."
        git checkout "${BASE_BRANCH}"
        continue
    fi

    if ! git checkout "${BRANCH}"; then
        echo "  - ERROR: Cannot checkout local branch ${BRANCH}"
        git checkout "${BASE_BRANCH}"
        continue
    fi

    # Attempt rebase (relies on Jules/Codex to auto-resolve conflicts where possible)
    if git rebase "origin/${BASE_BRANCH}"; then

        # Rebase succeeded; push the cleaned branch
        git push origin "${BRANCH}" --force-with-lease
        echo "  - PUSHED: Branch ${BRANCH} is now clean and mergeable."

        # Post comment on the PR
        PR_NUMBER=$(gh pr list --repo "${OWNER}/${REPO}" --head "${BRANCH}" --json number --jq '.[0].number')
        if [ -n "${PR_NUMBER}" ]; then
            gh pr comment "${PR_NUMBER}" --body "🤖 **Jules AI Fix:** Automated rebase onto \`main\` successful. The branch is now clean and ready to merge."
        fi
    else
        echo "  - FAILED: Branch ${BRANCH} still has complex conflicts. Leaving for manual review."
    fi

    git checkout "${BASE_BRANCH}"
done

echo "--- GIT REPAIR COMPLETE. Check GitHub for mergeable PRs. ---"
