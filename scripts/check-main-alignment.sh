#!/usr/bin/env bash
set -euo pipefail

BASE_BRANCH="${1:-main}"
REMOTE="${2:-origin}"
REPO_SLUG="${3:-${GITHUB_REPO_SLUG:-goldshore/goldshore-ai}}"
GITHUB_API_URL="${GITHUB_API_URL:-https://api.github.com}"

usage() {
  cat <<USAGE
Usage: scripts/check-main-alignment.sh [base_branch] [remote] [repo_slug]

Reports whether open PR head branches targeting <base_branch> are ahead of it.

Arguments:
  base_branch   Base branch to compare against (default: main)
  remote        Git remote to use when configured locally (default: origin)
  repo_slug     GitHub repo slug for API fallback (default: goldshore/goldshore-ai)

Behavior:
  - If <remote> exists locally, the script fetches it and compares remote refs with git.
  - If <remote> is missing, it falls back to the GitHub REST API for PR discovery and
    ahead/behind comparisons, so the audit still works in detached/local-only clones.

Examples:
  scripts/check-main-alignment.sh
  scripts/check-main-alignment.sh main origin
  scripts/check-main-alignment.sh main origin goldshore/goldshore-ai
USAGE
}

if [[ "$BASE_BRANCH" == "-h" || "$BASE_BRANCH" == "--help" ]]; then
  usage
  exit 0
fi

AUTH_HEADER=()
for token_var in GITHUB_TOKEN GH_TOKEN; do
  token_value="${!token_var:-}"
  if [[ -n "$token_value" ]]; then
    AUTH_HEADER=(-H "Authorization: Bearer ${token_value}")
    break
  fi
done

fetch_pr_heads() {
  python - <<'PY' "$GITHUB_API_URL" "$REPO_SLUG" "$BASE_BRANCH"
import json, os, sys, urllib.request
api_url, repo_slug, base_branch = sys.argv[1:4]
url = f"{api_url}/repos/{repo_slug}/pulls?state=open&per_page=100"
headers = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "goldshore-main-alignment-audit",
}
for token_env in ("GITHUB_TOKEN", "GH_TOKEN"):
    token = os.environ.get(token_env)
    if token:
        headers["Authorization"] = f"Bearer {token}"
        break
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as response:
    pulls = json.load(response)
heads = sorted({pr["head"]["ref"] for pr in pulls if pr["base"]["ref"] == base_branch})
for head in heads:
    print(head)
PY
}

compare_via_api() {
  local head_branch="$1"
  python - <<'PY' "$GITHUB_API_URL" "$REPO_SLUG" "$BASE_BRANCH" "$head_branch"
import json, os, sys, urllib.error, urllib.parse, urllib.request
api_url, repo_slug, base_branch, head_branch = sys.argv[1:5]
compare_ref = urllib.parse.quote(f"{base_branch}...{head_branch}", safe='')
url = f"{api_url}/repos/{repo_slug}/compare/{compare_ref}"
headers = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "goldshore-main-alignment-audit",
}
for token_env in ("GITHUB_TOKEN", "GH_TOKEN"):
    token = os.environ.get(token_env)
    if token:
        headers["Authorization"] = f"Bearer {token}"
        break
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        payload = json.load(response)
except urllib.error.HTTPError as exc:
    if exc.code == 404:
        print('-', '-', 'missing_remote_ref')
    else:
        print('-', '-', f'api_http_{exc.code}')
    raise SystemExit(0)
except Exception:
    print('-', '-', 'api_error')
    raise SystemExit(0)
print(payload.get("behind_by", 0), payload.get("ahead_by", 0), payload.get("status", "unknown"))
PY
}

HAS_REMOTE=0
if git remote | grep -qx "$REMOTE"; then
  HAS_REMOTE=1
fi

if [[ "$HAS_REMOTE" -eq 1 ]]; then
  echo "==> Fetching latest refs from $REMOTE..."
  git fetch "$REMOTE" --prune >/dev/null
else
  echo "==> Remote '$REMOTE' not configured locally; using GitHub API fallback for ${REPO_SLUG}."
fi

mapfile -t HEADS < <(fetch_pr_heads)

if [[ "${#HEADS[@]}" -eq 0 ]]; then
  echo "No open PR branches targeting $BASE_BRANCH."
  exit 0
fi

echo
echo "==> Ahead/behind report versus ${REMOTE}/${BASE_BRANCH}"
printf "%-55s %-10s %-10s %s\n" "branch" "behind" "ahead" "status"
printf "%-55s %-10s %-10s %s\n" "------" "------" "-----" "------"

ahead_any=0

for branch in "${HEADS[@]}"; do
  behind="-"
  ahead="-"
  status="missing_remote_ref"

  if [[ "$HAS_REMOTE" -eq 1 ]]; then
    if ! git show-ref --verify --quiet "refs/remotes/$REMOTE/$branch"; then
      git fetch "$REMOTE" "$branch:refs/remotes/$REMOTE/$branch" >/dev/null 2>&1 || true
      git fetch "$REMOTE" "$branch" >/dev/null 2>&1 || true
    fi

    if git show-ref --verify --quiet "refs/remotes/$REMOTE/$branch"; then
      counts="$(git rev-list --left-right --count "$REMOTE/$BASE_BRANCH...$REMOTE/$branch")"
      behind="$(awk '{print $1}' <<<"$counts")"
      ahead="$(awk '{print $2}' <<<"$counts")"
      status="aligned"
    else
      read -r behind ahead status < <(compare_via_api "$branch")
    fi
  else
    read -r behind ahead status < <(compare_via_api "$branch")
  fi

  if [[ "$ahead" != "-" && "$ahead" -gt 0 ]]; then
    status="AHEAD_OF_${BASE_BRANCH}"
    ahead_any=1
  elif [[ "$ahead" != "-" ]]; then
    status="aligned"
  fi

  printf "%-55s %-10s %-10s %s\n" "$branch" "$behind" "$ahead" "$status"
done

echo
if [[ "$ahead_any" -eq 1 ]]; then
  echo "❗Some PR branches are ahead of $BASE_BRANCH."
  echo "Action: merge/cherry-pick those commits into $BASE_BRANCH, then rebase or close stale branches."
  exit 2
else
  echo "✅ All open PR branches are fully contained in $BASE_BRANCH (none ahead)."
fi
