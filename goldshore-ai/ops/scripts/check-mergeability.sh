#!/bin/bash
# Check if a branch can be merged cleanly into main

# Fetch all branches and prune deleted ones
git fetch --all --prune

TARGET_BRANCH="main"
echo "Checking mergeability against $TARGET_BRANCH..."

# Get all remote branches except the target
BRANCHES=$(git branch -r | grep -v "$TARGET_BRANCH" | grep -v "HEAD" | sed 's/origin\///')

for branch in $BRANCHES; do
    echo "--------------------------------------------------"
    echo "Checking $branch..."

    # Check if fully merged
    if git branch -r --merged "origin/$TARGET_BRANCH" | grep -q "$branch"; then
        echo " ✔ Fully merged (safe to delete)"
        continue
    fi

    # Dry-run merge check
    # Create a temporary branch based on main to test the merge without affecting current state
    TEMP_BRANCH="temp-merge-check-$(date +%s)"
    git checkout -b "$TEMP_BRANCH" "origin/$TARGET_BRANCH" >/dev/null 2>&1

    if git merge --no-commit --no-ff "origin/$branch" >/dev/null 2>&1; then
        echo " ✔ Mergeable (clean)"
    else
        echo " ✖ Conflicts detected"
    fi

    # Cleanup
    git merge --abort >/dev/null 2>&1
    git checkout - >/dev/null 2>&1
    git branch -D "$TEMP_BRANCH" >/dev/null 2>&1
done

echo "--------------------------------------------------"
echo "Done."
