# Contributing

## Naming Quick Reference

For full standards see `docs/conventions/naming.md`.

### Good examples

- Branch: `feat/add-worker-health-endpoint`
- Package: `@goldshore/control-worker`
- Worker service (wrangler): `gs-control`
- Workflow file: `.github/workflows/deploy-gs-control.yml`
- Workflow job key: `deploy-control`

### Anti-patterns

- Branch: `Feature/AddWorkerHealth`
- Package: `gs-control`
- Worker service: `GS Control`
- Workflow file: `.github/workflows/Deploy Control Worker.yml`
- Job key: `deploy_control`

## Helper scripts

- `pnpm branch:bootstrap -- <type> <slug>`
- `pnpm scaffold:worker -- <worker-name>`

## CI enforcement

Naming checks run in `.github/workflows/naming-lint.yml` and via:

- `pnpm check:naming`

## Workspace dependency protocol

Internal workspace dependencies must use `workspace:^` consistently across the monorepo.

- Allowed: `"@goldshore/<pkg>": "workspace:^"`
- Disallowed: `workspace:*` (or any mixed protocol for internal packages)

Local and CI enforcement:

- `pnpm check:workspace-protocol`

