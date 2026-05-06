# Reports Directory Policy

This directory stores canonical, human-readable reports that are useful for repository history.

## Versioned outputs

- `branch-audit.md` is the canonical branch audit summary and may be committed when refreshed.

## Non-versioned outputs

The following are considered ephemeral generated artifacts and must not be committed:

- Raw log captures (`*.log`, `*.txt`)
- Temporary scratch outputs and tool caches

## Regeneration workflow

When updating `branch-audit.md`:

1. Run the relevant local audit workflow/script.
2. Copy only the final curated summary into `reports/branch-audit.md`.
3. Keep intermediate logs in local temp files (ignored by `.gitignore`).
# Reports Directory

This directory stores **canonical, shareable report outputs** only.

## Versioned output

- `branch-audit.md`: the current branch audit summary intended for reviewers.

## Generation workflow

1. Run the branch/integration audit tooling (for example, repository automation under `scripts/` or `.Jules/`).
2. Regenerate `reports/branch-audit.md` from the latest run.
3. Commit only the refreshed `branch-audit.md` when report updates are needed.

## Not versioned

- Local execution logs (for example, `reports/*.txt`).
- One-off debugging artifacts and temporary run outputs.
