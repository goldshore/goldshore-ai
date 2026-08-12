# Repo Maintenance Workflow

Manual workflow for periodic repository health checks and maintenance reporting.

## Usage

Trigger via GitHub Actions → "Repo Maintenance" → "Run workflow"

### Inputs

- **Target ref** (default: `origin/main`)
  - Which branch to analyze for the report
  
- **Number of logs** (default: `20`)
  - How many recent commit logs to include in the report
  
- **Confirm apply** (default: `false`)
  - Set to `true` to run reconciliation commands
  - Leave `false` for dry-run reporting only

## What it does

1. Installs dependencies
2. Runs `pnpm run repo:health` (lockfile, asset, build checks)
3. Builds all packages (`pnpm -r build`)
4. Generates a branch report via `scripts/maintenance/branch-report.sh`
5. If `confirm_apply: true`, applies any recommended fixes

## Recommended frequency

- **Quarterly**: Full report with build verification
- **After major updates**: Check repo health after dependency upgrades
- **Before archiving branches**: Verify final state

---

**See also:** `scripts/maintenance/branch-report.sh` for report details.
