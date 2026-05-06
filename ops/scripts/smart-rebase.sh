#!/bin/bash
# Rebase Helper Script for GoldShore Workflow
#
# This script automates the recommended GoldShore workflow for rebasing feature branches onto main.
# It ensures a clean working directory, fetches the latest changes from origin, and attempts a rebase.
#
# Usage: ./ops/scripts/smart-rebase.sh [target_branch]

set -e

# Default target branch is main if not specified
TARGET_BRANCH="${1:-main}"
CURRENT_BRANCH=$(git branch --show-current)

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Smart Rebase...${NC}"
echo "Current Branch: $CURRENT_BRANCH"
echo "Target Branch: $TARGET_BRANCH"

# Check if we are on the target branch (prevent rebasing main onto main)
if [ "$CURRENT_BRANCH" == "$TARGET_BRANCH" ]; then
    echo -e "${RED}Error: You are currently on the target branch '$TARGET_BRANCH'. Please checkout your feature branch first.${NC}"
    exit 1
fi

# Check for uncommitted changes (staged or unstaged)
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}Error: You have uncommitted changes. Please commit or stash them before rebasing.${NC}"
    exit 1
fi

# Fetch latest changes from origin
echo -e "${YELLOW}Fetching latest changes from origin...${NC}"
git fetch origin "$TARGET_BRANCH"

# Check merge-base for unrelated histories
MERGE_BASE=$(git merge-base HEAD "origin/$TARGET_BRANCH" || echo "none")

if [ "$MERGE_BASE" == "none" ]; then
    echo -e "${YELLOW}Warning: No common ancestor found between $CURRENT_BRANCH and origin/$TARGET_BRANCH.${NC}"
    echo -e "${YELLOW}This implies unrelated histories. A standard rebase may cause significant conflicts.${NC}"
    # In interactive mode, we'd prompt. In non-interactive (CI/automation), we should likely abort or force.
    # Since this script is intended to be run by a user (or me), I'll add a flag or just fail safe.
    echo "Aborting rebase due to unrelated histories. Use --force-rebase to override (not implemented yet)."
    exit 1
fi

# Attempt Rebase
echo -e "${YELLOW}Attempting to rebase $CURRENT_BRANCH onto origin/$TARGET_BRANCH...${NC}"

if git rebase "origin/$TARGET_BRANCH"; then
    echo -e "${GREEN}Successfully rebased $CURRENT_BRANCH onto origin/$TARGET_BRANCH!${NC}"
else
    echo -e "${RED}Rebase failed due to conflicts.${NC}"
    echo "The rebase process has been paused. Please resolve conflicts manually and run 'git rebase --continue', or abort with 'git rebase --abort'."
    exit 1
fi
