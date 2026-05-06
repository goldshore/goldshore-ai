# Migration Integrity Checks

## Required Scan Targets and Checks

### Exact scan targets

- Source globs:
  - `apps/**`
  - `packages/**`
  - `infra/**`
  - `.github/workflows/**`
  - `docs/**`
- Exclusions:
  - `legacy/**`
  - `node_modules/**`
  - build outputs

### Required string checks

- Forbid `astro-goldshore/` outside `legacy/`.
- Forbid import specifiers resolving into `legacy/astro-goldshore`.

### Required path checks

- Validate asset references under `public/assets/**`.
- Ensure no duplicate workflow filenames exist in `.github/workflows/`.
- Verify relative imports for moved files using static path existence checks.
