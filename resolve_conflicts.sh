#!/bin/bash

# Files deleted by them - accept deletion
git rm -q .Jules/palette.md 2>/dev/null || true
git rm -q apps/jules-bot/src/index.mjs 2>/dev/null || true
git rm -q apps/mail-worker/tsconfig.json 2>/dev/null || true

# Both deleted - accept deletion
git rm -q apps/gs-admin/src/env.d.legacy-20251128.ts 2>/dev/null || true
git rm -q apps/gs-admin/src/pages/systems/index.astro 2>/dev/null || true
git rm -q apps/gs-web/src/env.d.legacy-20251128.ts 2>/dev/null || true

# Get list of "added by us" files in renamed directories (gs-admin, gs-api, gs-control, gs-gateway, gs-web)
git status -s | grep "added by us" | awk '{print $NF}' | while read file; do
  if [[ $file == apps/gs-admin/* ]] || [[ $file == apps/gs-api/* ]] || [[ $file == apps/gs-control/* ]] || [[ $file == apps/gs-gateway/* ]] || [[ $file == apps/gs-web/* ]]; then
    git add "$file" 2>/dev/null || true
  fi
done

# Get list of "added by them" env files - keep ours
git status -s | grep "added by them" | awk '{print $NF}' | while read file; do
  if [[ $file == *"env.d.legacy"* ]]; then
    git rm "$file" 2>/dev/null || true
  fi
done

# Both added - keep ours (.vscode/extensions.json)
git add .vscode/extensions.json 2>/dev/null || true

# Files added by us in the root (astro-goldshore)
git status -s | grep "added by us" | awk '{print $NF}' | grep "^astro-goldshore/" | while read file; do
  git add "$file" 2>/dev/null || true
done

# Deleted by us - remove entirely
git rm -q apps/gs-admin/src/pages/logs.astro 2>/dev/null || true

echo "Conflict resolution completed"
git status --short | grep "^[UD]" || echo "No remaining conflicts in index"
