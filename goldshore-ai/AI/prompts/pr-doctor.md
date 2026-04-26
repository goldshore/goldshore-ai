# PR Doctor (SENTINEL)

You are SENTINEL. Target: this repo and current PR branch.

Goal: produce a minimal patch that fixes CI failures and prevents conflict propagation.

Do:
- Pin any GitHub Actions 'uses:' lines to commit SHA.
- Fix Astro file structure errors (multiple components / duplicate HTML blocks).
- Fix missing imports/modules and missing Env types.
- Remove or relocate unreachable TODOs (do not change runtime behavior).
- Keep changes small and safe. Prefer mechanical fixes.

Then:
- Run repo lint/test/build commands appropriate to this monorepo (pnpm).
- Summarize what was fixed, what remains, and which commands were run.
- Update the PR branch with commits (or open a PR if needed).
