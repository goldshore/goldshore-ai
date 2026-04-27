#!/usr/bin/env bash
set -euo pipefail

BASE_BRANCH="origin/main"
INTEGRATION_BRANCH="integration/conflict-resolution/$(date +%Y%m%dT%H%M%SZ)"
REPORT_PATH="ops/conflict-report.json"
ALLOWLIST_PATH=""
ALLOW_DIRTY=0
DRY_RUN=0

usage() {
  cat <<'USAGE'
Usage: scripts/integration-conflict-sweeper.sh [options]

Options:
  --base <ref>           Base ref to merge onto (default: origin/main)
  --integration <name>   Integration branch name (default: integration/conflict-resolution/<timestamp>)
  --allowlist <path>     File with branch names to include (one per line)
  --report <path>        JSON report output path (default: ops/conflict-report.json)
  --dry-run              Do not perform merges; only report scoring and file counts
  --allow-dirty          Allow running with a dirty working tree (dry-run only)
  -h, --help             Show this help message
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      BASE_BRANCH="$2"; shift 2 ;;
    --integration)
      INTEGRATION_BRANCH="$2"; shift 2 ;;
    --allowlist)
      ALLOWLIST_PATH="$2"; shift 2 ;;
    --report)
      REPORT_PATH="$2"; shift 2 ;;
    --dry-run)
      DRY_RUN=1; shift ;;
    --allow-dirty)
      ALLOW_DIRTY=1; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -n "$(git status --porcelain)" && "$ALLOW_DIRTY" -ne 1 && "$DRY_RUN" -ne 1 ]]; then
  echo "Working tree is not clean. Please commit or stash changes before running." >&2
  exit 1
fi

git fetch --all --prune

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

python - <<PY
import json, subprocess, datetime, re, os, sys

base = "${BASE_BRANCH}"
integration = "${INTEGRATION_BRANCH}"
report_path = "${REPORT_PATH}"
dry_run = int("${DRY_RUN}")
allow_dirty = int("${ALLOW_DIRTY}")
allowlist_path = "${ALLOWLIST_PATH}"

now = datetime.datetime.now(datetime.timezone.utc)

def run(cmd):
    return subprocess.check_output(cmd, shell=True, text=True).strip()

def scan_conflict_markers():
    try:
        matches = run("git grep -n -I -E '^(<<<<<<<|=======|>>>>>>>)' -- .")
    except subprocess.CalledProcessError:
        return []
    results = []
    for line in matches.splitlines():
        path, rest = line.split(":", 1)
        results.append({"file": path, "line": rest})
    return results

def load_branches():
    refs = run("git for-each-ref --format='%(refname:short)' refs/remotes/origin").splitlines()
    branches = []
    for ref in refs:
        if ref == "origin/main":
            continue
        if not ref.startswith("origin/"):
            continue
        branches.append(ref[len("origin/"):])
    if allowlist_path:
        with open(allowlist_path, "r", encoding="utf-8") as f:
            allowlist = {line.strip() for line in f if line.strip()}
        branches = [branch for branch in branches if branch in allowlist]
    return branches

def score_branch(branch):
    date_str = run(f"git log -1 --format=%cI origin/{branch}")
    date = datetime.datetime.fromisoformat(date_str)
    age_days = (now - date).days
    diff = run(f"git diff --name-only {base}..origin/{branch}")
    files = [f for f in diff.splitlines() if f]
    file_count = len(files)
    if file_count <= 5:
        conflict_score = 4
    elif file_count <= 25:
        conflict_score = 3
    elif file_count <= 100:
        conflict_score = 2
    else:
        conflict_score = 1
    risk = 0
    if files:
        doc_ext = {'.md', '.mdx', '.txt'}
        doc_like = all(any(f.endswith(ext) for ext in doc_ext) or f.startswith('docs/') for f in files)
        if doc_like:
            risk = 3
        else:
            infra_files = any(f.startswith('.github/') or f.endswith('.yml') or f.endswith('.yaml') or f.endswith('pnpm-lock.yaml') or f.endswith('package.json') or f.endswith('pnpm-workspace.yaml') or f.startswith('infra/') for f in files)
            major_arch = any(f.startswith('apps/') or f.startswith('packages/') for f in files)
            if infra_files:
                risk = 1
            elif major_arch:
                risk = 0
            else:
                risk = 2
    test_like = any(re.search(r'(__tests__|\.test\.|\.spec\.|/tests?/)', f) for f in files)
    test_score = 1 if test_like else 0
    age_score = 1 if age_days <= 30 else 0
    total = conflict_score + risk + test_score + age_score
    return {
        "branch": branch,
        "authordate": date_str,
        "age_days": age_days,
        "file_count": file_count,
        "conflict_score": conflict_score,
        "risk_score": risk,
        "test_score": test_score,
        "age_score": age_score,
        "total_score": total,
        "touches_pnpm_lock": "pnpm-lock.yaml" in files,
        "files_sample": files[:10],
    }

results = []
for branch in load_branches():
    results.append(score_branch(branch))

# Optional conflict probing
conflict_results = {}
if not dry_run:
    subprocess.check_call(f"git switch -C {integration} {base}", shell=True)
    for item in results:
        branch = item["branch"]
        try:
            subprocess.check_call(f"git merge --no-commit --no-ff origin/{branch}", shell=True)
            conflict_files = subprocess.check_output("git diff --name-only --diff-filter=U", shell=True, text=True).strip().splitlines()
            item["conflicts"] = conflict_files
            item["merge_status"] = "clean" if not conflict_files else "conflict"
        except subprocess.CalledProcessError:
            conflict_files = subprocess.check_output("git diff --name-only --diff-filter=U", shell=True, text=True).strip().splitlines()
            item["conflicts"] = conflict_files
            item["merge_status"] = "conflict"
        finally:
            subprocess.check_call("git merge --abort", shell=True)
    subprocess.check_call("git switch -", shell=True)

results.sort(key=lambda r: (-r["total_score"], r["file_count"]))

payload = {
    "base": base,
    "integration_branch": integration,
    "generated_at": now.isoformat(),
    "dry_run": bool(dry_run),
    "allow_dirty": bool(allow_dirty),
    "conflict_markers": scan_conflict_markers(),
    "branches": results,
}

os.makedirs(os.path.dirname(report_path), exist_ok=True)
with open(report_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2)

print(f"Wrote report to {report_path}")
PY
