# .github Consolidation

## Compared sources
- Active: `.github/`
- Legacy: `astro-goldshore/.github/`

## Decisions
- Kept active workflows using `gs-*` naming and current workspace layout.
- Legacy deploy workflows from astro-goldshore were not promoted over existing active workflows because equivalent deployment pipelines already exist (`deploy-gs-admin.yml`, `deploy-gs-api.yml`, `deploy-gs-web.yml`, etc.).
- Added a guard workflow (`archive-path-guard.yml`) to prevent references to `astro-goldshore/` from re-entering active CI/build graph.
