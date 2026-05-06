# Naming Conventions

This project uses predictable kebab-case naming across branches, packages, workers/services, and CI workflows.

## Branch Names

Pattern:

- `<type>/<short-kebab-summary>`

Allowed `<type>` values:

- `feat`
- `fix`
- `chore`
- `docs`
- `refactor`

Examples:

- `feat/add-ai-audit-log-stream`
- `fix/control-worker-token-refresh`

Anti-patterns:

- `feature/AddThing`
- `jules temp branch`

## Package Names

Pattern:

- `@goldshore/<kebab-scope>`

Examples:

- `@goldshore/api-worker`
- `@goldshore/control-worker`
- `@goldshore/theme`

## Worker and Service Names

Pattern:

- Runtime service IDs in wrangler/workflow context: `<kebab-name>`
- Workspace package names: `@goldshore/<kebab-name>`

Examples:

- Worker service: `gs-api`
- Worker package: `@goldshore/api-worker`
- Gateway service: `gs-gateway`
- Gateway package: `@goldshore/gateway`

## Workflow and Job Names

Pattern:

- Workflow file names: `<kebab-name>.yml`
- Workflow `name`: `<kebab-name>`
- Job keys: `<kebab-name>`

Examples:

- `.github/workflows/deploy-api-worker.yml`
- workflow name: `deploy-api-worker`
- job key: `deploy`

## Incremental Migration Aliases

To avoid breaking active automation during migration, legacy names are tracked in `scripts/name-aliases.json`.

Current package aliases:

- `gs-api` -> `@goldshore/api-worker`
- `gs-mail` -> `@goldshore/mail-worker`
- `@goldshore/control` -> `@goldshore/control-worker`
