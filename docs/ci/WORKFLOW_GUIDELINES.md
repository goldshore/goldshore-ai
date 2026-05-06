# Workflow Guidelines: Anti-pattern Removal Examples

The following workflow files were corrected to remove YAML and GitHub Actions anti-patterns that break workflow parsing or execution.

## Corrected examples

- `.github/workflows/lockfile-guard.yml`
  - Removed an accidental second top-level `on:` block.
  - Removed an accidental second top-level `jobs:` block.
  - Kept a single lockfile guard job with clear intent.

- `.github/workflows/preview-gs-agent.yml`
  - Removed duplicate `uses:` setup-node step duplication.
  - Removed duplicate `run:` key in a single deploy step (invalid YAML mapping).
  - Preserved deploy behavior with the canonical Cloudflare config path.

- `.github/workflows/sonarcloud.yml`
  - Reduced a step containing two `uses:` entries to one action reference.

- `.github/workflows/summary.yml`
  - Reduced a step containing two `uses:` entries to one action reference.

- `.github/workflows/pii-scan.yml`
  - Reduced setup step to one `uses:` action.
  - Reduced artifact upload step to one `uses:` action.

- `.github/workflows/palette-manual.yml`
  - Reduced setup step to one `uses:` action.

- `.github/workflows/tfsec.yml`
  - Reduced SARIF upload step to one `uses:` action.

## Validation routine

When editing workflow YAML:

1. Ensure each workflow has exactly one top-level `on:` and one top-level `jobs:` block.
2. Ensure each step has at most one `uses:` key.
3. Ensure each mapping key appears only once (e.g., no duplicate `run:` keys).
4. Run YAML parser validation across `.github/workflows/*.yml`.
5. Run workflow linter checks and triage pre-existing non-YAML findings separately.
