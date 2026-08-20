# Cherry-pick report (last 3 days)

- Source baseline requested: `origin/main`
- Environment note: no `origin` remote is configured in this checkout, so branch `clean/cherry-last3d` was created from the current commit SHA (`7baffec`) as the closest possible fallback.

## Candidate selection scope
Commits from the last 3 days touching:
- `apps/gs-api`
- `apps/gs-web`
- `apps/gs-admin`
- `packages/` (including theme/CSS files under `packages/theme`)

## Applied commits
1. `3aa9907a12d6041af6f9eabbc6af55bdd4647ea4` — Codex/fix critical and high priority bugs 2026 03 15 (#3873)

## Deferred commits
Deferred due to conflict noise / empty duplicate when applied to current baseline:

- `d9beb8d988fb0d985fccf53c619bb1871e792d1d` — conflict in `apps/gs-web/src/pages/index.astro`
- `accea537898c65ce35a59903b25b660e34ac395f` — empty cherry-pick
- `dc5212981f7111299038bab2d28607987f68657c` — conflict in `apps/gs-api/src/routes/media.ts`
- `88baa9d75d054249057b4aa9d5b7a1f4afe46a2e` — conflict in `apps/gs-api/src/aiClient.js`
- `334569033c63ffa06d8545b5d348e505f4d9577c` — conflict in `apps/gs-api/src/aiClient.js`
- `4638828da5093aaf47a7adee56f825bf81d6c73e` — conflict in `apps/gs-web/src/pages/index.astro`
- `dfa10e40083aeed8e8ed890b4c06b6e39f22d6b3` — multiple conflicts (`SiteNav`, hero files, root lock/package)
- `cbd175b8ee3e79e04d19c0773c299e3a22d3bb8b` — conflicts in `apps/gs-api/src/routes/media.ts`, `system.config.ts`
- `5d4d10181d339dfccdc1afbbd78a670d6cc771c7` — empty cherry-pick

## Notes
- `work` branch remains untouched and available for reference.
- CI should be used to validate this cleaned branch before replacing any existing integration branch.
