#!/usr/bin/env bash
set -euo pipefail

environment="${1:?environment is required}"
backup_dir="${2:?backup directory is required}"
case "$environment" in preview|prod) ;; *) echo "environment must be preview or prod" >&2; exit 2 ;; esac

root="apps/gs-api"
manifest="$root/db/migrations/manifest.json"
mkdir -p "$backup_dir"
mapfile -t migrations < <(find "$root/db/migrations" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | sort)
test "${#migrations[@]}" -gt 0 || { echo 'No migrations discovered' >&2; exit 1; }

for migration in "${migrations[@]}"; do
  database="$(node -e "const m=require('./$manifest'); const d=m[process.argv[1]]; if(!d) process.exit(1); process.stdout.write(d)" "$migration")" || {
    echo "Migration $migration has no database mapping in $manifest" >&2; exit 1;
  }
  checksum="$(sha256sum "$root/db/migrations/$migration" | cut -d' ' -f1)"
  ledger_sql="CREATE TABLE IF NOT EXISTS _goldshore_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, git_sha TEXT NOT NULL);"
  pnpm --dir "$root" exec wrangler d1 execute "$database" --remote --env "$environment" --command "$ledger_sql"
  query="SELECT checksum FROM _goldshore_migrations WHERE name = '$migration';"
  ledger_json="$(pnpm --dir "$root" exec wrangler d1 execute "$database" --remote --env "$environment" --command "$query" --json)"
  applied="$(printf '%s' "$ledger_json" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);process.stdout.write(j[0]?.results?.[0]?.checksum||'')})")"
  if [ -n "$applied" ]; then
    test "$applied" = "$checksum" || { echo "Checksum drift for applied migration $migration" >&2; exit 1; }
    echo "Already applied: $migration ($database)"
    continue
  fi

  export_file="$backup_dir/${environment}-${database}-before-${migration%.sql}.sql"
  if pnpm --dir "$root" exec wrangler d1 export "$database" --remote --env "$environment" --output "$(realpath -m "$export_file")"; then
    printf '%s\n' "$export_file" >> "$backup_dir/export-references.txt"
  else
    echo "Export unsupported or unavailable for $database before $migration" | tee -a "$backup_dir/export-references.txt"
  fi

  combined="$(mktemp)"
  trap 'rm -f "$combined"' EXIT
  cat "$root/db/migrations/$migration" > "$combined"
  printf "\nINSERT INTO _goldshore_migrations(name, checksum, git_sha) VALUES ('%s', '%s', '%s');\n" \
    "$migration" "$checksum" "${GITHUB_SHA:-local}" >> "$combined"
  pnpm --dir "$root" exec wrangler d1 execute "$database" --remote --env "$environment" --file "$combined"
  rm -f "$combined"
  trap - EXIT
  echo "Applied: $migration ($database)"
done
