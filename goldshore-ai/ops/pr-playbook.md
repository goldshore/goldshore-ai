# GoldShore PR Playbook (Conflicts, Lockfiles, and Priority)

This playbook defines how to handle:

- Merge conflicts that block PRs
- Giant `pnpm-lock.yaml` conflicts (never solved by hand)
- PR inventory and prioritization
- How/when to let “Jules” automation do the work

---

## 0. Principles

1. **Lockfiles are never hand-edited.**
   If `pnpm-lock.yaml` has conflicts, we delete and regenerate it.

2. **`main` is the source of truth.**
   Conflicted PR branches sync to `origin/main` first, then are fixed.

3. **High-impact files come first.**
   PRs touching infra, workers, or layouts get resolved before copy-only or minor tweaks.

4. **Automate where possible.**
   Use `gh` and (later) Jules bot/Actions to clean branches, not manual gymnastics.

---

## Mergeability audit helper

Before triage, you can quickly scan branch mergeability with:

```bash
scripts/merge-audit.sh --target origin/main
```

Detailed usage is documented in `docs/ops/mergeable-branches.md`.

---

## 1. Quick Triage Flow

When you see a PR with “This branch has conflicts that must be resolved”:

1. **Check what files are involved**
   ```bash
   gh pr view <id> --json files --jq '.files[].path'
   ```
2. If the PR includes pnpm-lock.yaml with conflicts → skip manual resolution and go to Section 2.2.
3. If the PR only has source/config files (no lockfile or generated assets) → follow Section 2.3.
4. If PR is obviously obsolete (old branch, pre-refactor layouts, dead worker path) → consider closing it or hard-resetting it to main.

⸻

## 2. Resolving Merge Conflicts for a PR

### 2.1 Fetch & Checkout the PR

With GitHub CLI (preferred):

```bash
# From repo root
gh pr checkout <id>
```

Without GH CLI:

```bash
git fetch origin pull/<id>/head:pr-<id>
git checkout pr-<id>
```

Make sure main is current:

```bash
git fetch origin main
```

⸻

### 2.2 Special Case: Lockfile Conflicts (pnpm-lock.yaml)

If pnpm-lock.yaml shows conflict markers (<<<<<<<, =======, >>>>>>>):

Do NOT open or edit the lockfile manually.

Instead:

```bash
# On the PR branch
git reset --hard origin/main  # if you want PR to match main exactly

rm -f pnpm-lock.yaml
rm -rf node_modules

pnpm install

git add pnpm-lock.yaml
git commit -m "Fix: regenerate pnpm-lock.yaml after syncing with main" || true
git push --force-with-lease
```

Result:

- All lockfile conflicts are gone
- Lockfile is clean and consistent with main + current package.json
- CI can now run properly

If the PR had important code changes you still care about, sync with main first using git rebase origin/main instead of reset, then still delete and regenerate pnpm-lock.yaml.

⸻

### 2.3 Resolving Conflicts in Source/Config Files

After syncing:

```bash
git rebase origin/main
# or
# git merge origin/main
```

If Git shows conflicts:

1. List conflicted files:
   ```bash
   git status
   ```
2. For each conflicted file (excluding lockfiles):
   - Open the file
   - Look for:
     ```
     <<<<<<< HEAD
     ...
     =======
     ...
     >>>>>>> branch-name
     ```
   - Decide:
     - Keep current (HEAD, which is main)
     - Keep incoming (PR branch)
     - Or blend them manually
   - Remove all conflict markers and ensure the code still makes sense.
3. Mark conflicts resolved:
   ```bash
   git add <file1> <file2> ...
   ```
4. Complete the rebase/merge:
   ```bash
   git rebase --continue  # if using rebase
   # or
   # git commit -m "Resolve merge conflicts for PR <id>"  # if using merge
   ```
5. Validate locally:
   ```bash
   pnpm lint || echo "Lint warnings (non-blocking)"
   pnpm build
   ```
6. Push updates:
   - Rebase:
     ```bash
     git push --force-with-lease
     ```
   - Merge:
     ```bash
     git push
     ```
7. Leave a short PR comment:
   - Example:
     ```
     Resolved conflicts by syncing with main, regenerating pnpm-lock.yaml, and merging:
     • apps/gs-admin/…
     • apps/gs-web/…
     Lint + build passing locally. CI re-run.
     ```

⸻

## 3. Inventory: Open PRs & Critical Files

Use this when things feel “crowded” or you’re not sure which PR to tackle next.

### 3.1 List Open PRs

```bash
gh pr list --state open --limit 50 \
  --json number,title,headRefName,baseRefName,mergeable \
  --jq '.[] | {number,title,head: .headRefName,base: .baseRefName,mergeable}'
```

Optional: run per repo if you have multiple (e.g. monorepo vs infra repo).

⸻

### 3.2 Identify “Vital” PRs

For each PR, get the touched files:

```bash
gh pr view <id> \
  --json files \
  --jq '.files[].path'
```

Flag PRs that touch:
- package.json, pnpm-lock.yaml
- apps/gs-admin/\*
- apps/gs-web/\*
- apps/gs-api/_, apps/gs-gateway/_, apps/gs-control/\*
- tsconfig.json, astro.config.mjs, wrangler.toml
- shared packages/* (theme, ui, auth, utils, etc.)

- package.json, pnpm-lock.yaml
- apps/admin/\*
- apps/web/\*
- apps/api-worker/_, apps/gateway/_, apps/control-worker/\*
- tsconfig.json, astro.config.mjs, wrangler.toml
- shared packages/\* (theme, ui, auth, utils, etc.)

Those are high-impact and should be cleaned/merged before small copy changes.

⸻

### 3.3 Decide Merge Order

Recommended priority:
1. Infra / config PRs
   - Root package.json
   - tsconfig.json
   - .github/workflows/*
   - infra/cloudflare/*

1. Infra / config PRs
   - Root package.json
   - tsconfig.json
   - .github/workflows/\*
   - infra/cloudflare/\*
   - wrangler.toml changes
2. Workers
   - apps/gs-api
   - apps/gs-gateway
   - apps/gs-control
3. Web/Admin frameworks
   - apps/gs-web/astro.config.mjs, apps/gs-admin/astro.config.mjs
   - WebLayout, AdminLayout, NavBar, Footer
4. Pages and content
   - apps/web/src/pages/*
   - apps/admin/src/pages/*
   - apps/web/src/pages/\*
   - apps/admin/src/pages/\*
   - apps/gs-web/src/pages/\*
   - apps/gs-admin/src/pages/\*
5. Docs / README / comment-only PRs

⸻

## 4. Using Jules (Automation Layer)

As Jules evolves into a hybrid GitHub App + Actions bot, the idea is:

- Let Jules handle:
  - Lockfile regeneration
  - Resetting branches against main
  - Deleting dead directories (apps/gs-agent, old prototypes, etc.)
  - Re-running CI after fixes
- Let you handle:
  - Semantic decisions in conflicted source files
  - “Does this change still match the product?”
  - Merge order and which PRs to keep/close

Future commands (once wired):

- /jules clean → sync branch to main, regenerate lockfile, push fix
- /jules status → summarize conflicts, CI, and required manual steps
- /jules diag → attach logs from failing builds/lint for this PR

Until that’s live, this playbook is the manual version of what Jules will eventually automate.

⸻

## 5. Common Scenarios

**Scenario A — PR blocked only by pnpm-lock.yaml**

1. Checkout PR branch
2. Delete lockfile
3. pnpm install
4. Commit new lockfile
5. Push (force if rebased)

✅ No manual merge of 200+ lines. Let PNPM do the work.

⸻

**Scenario B — PR touches apps/web/src/pages/index.astro and apps/admin/src/pages/index.astro**
**Scenario B — PR touches apps/gs-web/src/pages/index.astro and apps/gs-admin/src/pages/index.astro**

1. Sync branch with main (rebase origin/main)
2. Resolve conflicts in those .astro files manually
3. Delete/regenerate lockfile if needed
4. Build: pnpm build
5. Push, then re-run CI

⸻

**Scenario C — PR is clearly obsolete or colliding with newer architecture**

1. Decide if any code is still valuable
2. If no:
   - Close PR with comment:
     Closing in favor of the latest main structure. Re-open or rebase if needed.
3. If yes:
   - Cherry-pick key commits into a fresh branch based on main
   - Open a new clean PR

⸻

This file should live as:

ops/pr-playbook.md

and can be linked from your README.md under a “Contributing / PR Workflow” section if you want others (or future-you) to follow the same flow.
