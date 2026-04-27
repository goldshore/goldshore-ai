#!/usr/bin/env bash
set -e # Exit immediately if a command exits with a non-zero status.

PR=$1
if [ -z "$PR" ]; then
  echo "Usage: $0 <PR_NUMBER>"
  exit 1
fi

# Dynamically get the repo and org from the git remote
REMOTE_URL=$(git config --get remote.origin.url)
REPO_FULL_NAME=$(echo "$REMOTE_URL" | sed -n 's/.*github.com[:/]\(.*\).git/\1/p')

if [ -z "$REPO_FULL_NAME" ]; then
  echo "Could not determine repository from remote URL."
  exit 1
fi

branch=$(gh pr view $PR --repo $REPO_FULL_NAME --json headRefName --jq '.headRefName')

echo "Cleaning PR #$PR ($branch) in repo $REPO_FULL_NAME"

git fetch origin main
git fetch origin $branch

git checkout -B $branch origin/$branch

echo "Attempting to rebase onto main..."
if git rebase origin/main; then
  echo "Rebase successful. Pushing changes."
  git push --force
else
  echo "Rebase failed. Resolving lockfile conflict manually."
  git rebase --abort
  git merge origin/main --no-edit

  rm -f pnpm-lock.yaml
  rm -rf node_modules

  echo "Re-installing dependencies to regenerate lockfile..."
  pnpm install

  git add pnpm-lock.yaml
  git commit -m "Jules Manual Clean: Regenerated lockfile for PR #$PR"
  git push
fi

echo "Restarting checks..."
gh pr checks $PR --repo $REPO_FULL_NAME --watch
