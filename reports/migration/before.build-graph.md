# Build Graph Snapshot (Before Migration)

## pnpm workspaces
- apps/*
- packages/*
- infra/*

## turbo tasks
- build (dependsOn: ^build; outputs: dist/**, .next/** excluding .next/cache/**)
- lint (dependsOn: ^build)
- dev (cache: false, persistent: true)
- test (dependsOn: ^build)

## Astro configs discovered
- /astro.config.mjs
- /apps/gs-admin/astro.config.mjs
- /apps/gs-admin/astro.config.legacy-20251128.mjs
- /apps/gs-web/astro.config.mjs
- /apps/gs-web/astro.config.legacy-20251128.mjs
- /astro-goldshore/apps/admin/astro.config.mjs
- /astro-goldshore/apps/web/astro.config.mjs
