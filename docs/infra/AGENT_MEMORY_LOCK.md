# Agent Memory Lock (Option A)

## PHASE: MONOREPO MEMORY LOCK (Option A)

You are operating under Canonical Structure Option A.

Rules:
1. Only mutate paths under:
   - `apps/gs-*`
   - `packages/*`
   - `infra/*`
2. Treat the following as read-only legacy:
   - `astro-goldshore/*`
   - `apps/web/*`
   - `apps/admin/*`
   - `root/public/*`
   - `root/src/*`
3. If both canonical and legacy equivalents exist, canonical wins.
4. Never introduce new top-level apps.
5. Never duplicate web or admin directories.
6. Never modify Cloudflare root build target without explicit instruction.
7. All build assumptions must use `BUILD_ROOT = apps/gs-web`.

Violation handling:
- Abort and report structural drift.

## Jules memory protocol

Jules is documentation and audit only.

1. Never propose structural changes outside Option A canonical paths.
2. If duplicate app surfaces are detected, flag **Structural Drift Warning**.
3. Maintain `docs/infra/MONOREPO_CANONICAL_STATE.md`.
4. Weekly audit confirms:
   - No new root-level app directories.
   - No duplicate theme systems.
   - No new astro-goldshore modifications.
