# Phase 1 CI Baseline Script

This repository includes an idempotent helper script for stabilization-mode workflow reduction:

- Script: `scripts/phase1-ci-baseline.sh`
- Default mode: dry-run (prints intended file operations)
- Apply mode: `--apply`

## What it does

1. Ensures `.github/workflows/_DISABLED_ARCHIVE/` exists.
2. Ensures `.github/workflows/ci-main.yml` exists with a minimal, no-`uses:` build pipeline.
3. Ensures `.github/workflows/.placeholder` exists.
4. Moves all other workflow YAML files to `.github/workflows/_DISABLED_ARCHIVE/`.

## Usage

```bash
# Preview only
bash scripts/phase1-ci-baseline.sh

# Apply changes
bash scripts/phase1-ci-baseline.sh --apply
```

## Why this is useful

This isolates CI to a single deterministic baseline workflow while preserving historical workflows in archive for controlled reintroduction.
