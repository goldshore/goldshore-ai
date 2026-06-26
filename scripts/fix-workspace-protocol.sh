#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BASE_REF="${BASE_REF:-}"
if [[ -z "$BASE_REF" ]]; then
  for candidate in origin/main main origin/master master; do
    if git rev-parse --verify "$candidate" >/dev/null 2>&1; then
      BASE_REF="$candidate"
      break
    fi
  done
fi

# Start with explicitly in-scope projects for this reconstruction pass.
declare -a scope=(
  "apps/gs-api"
  "apps/gs-web"
  "apps/gs-admin"
  "packages/auth"
  "packages/utils"
)

declare -A seen=()
for item in "${scope[@]}"; do
  seen["$item"]=1
done

# Add any packages/* folders touched on this branch.
if [[ -n "$BASE_REF" ]]; then
  while IFS= read -r package_dir; do
    [[ -z "$package_dir" ]] && continue
    if [[ -z "${seen[$package_dir]:-}" ]]; then
      scope+=("$package_dir")
      seen["$package_dir"]=1
    fi
  done < <(
    git diff --name-only "$BASE_REF"...HEAD \
      | awk -F/ '/^packages\/[^/]+\// { print $1"/"$2 }' \
      | sort -u
  )
fi

# Build package.json file list for existing scoped directories.
declare -a package_jsons=()
for project_dir in "${scope[@]}"; do
  pkg_file="$project_dir/package.json"
  if [[ -f "$pkg_file" ]]; then
    package_jsons+=("$pkg_file")
  fi
done

if [[ "${#package_jsons[@]}" -eq 0 ]]; then
  echo "No scoped package.json files found; nothing to update."
  exit 0
fi

node - "${package_jsons[@]}" <<'NODE'
const fs = require('node:fs');

const files = process.argv.slice(2);
const depFields = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

let updates = 0;

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const pkg = JSON.parse(raw);
  let changed = false;

  for (const field of depFields) {
    const deps = pkg[field];
    if (!deps || typeof deps !== 'object') continue;

    for (const [name, version] of Object.entries(deps)) {
      if (!name.startsWith('@goldshore/')) continue;
      if (version === 'workspace:*') {
        deps[name] = 'workspace:^';
        changed = true;
        updates += 1;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(`updated ${file}`);
  }
}

if (updates === 0) {
  console.log('no workspace:* @goldshore deps found in scope');
} else {
  console.log(`rewrote ${updates} dependency entr${updates === 1 ? 'y' : 'ies'}`);
}
NODE
