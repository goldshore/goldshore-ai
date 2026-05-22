# Monorepo Canonical State (Option A)

## Canonical structure lock

Gold Shore agents are locked to **Option A canonicalization**.

### Mutable production surfaces

- `apps/gs-web`
- `apps/gs-admin`
- `apps/gs-api`
- `apps/gs-gateway`
- `apps/gs-control`
- `packages/*`
- `infra/*`

### Read-only legacy surfaces

The following surfaces are considered legacy/read-only for agent operations:

- `astro-goldshore/*`
- `apps/web/*`
- `apps/admin/*`
- `public/*` (repo root)
- `src/*` (repo root)

## Single Canonical Surface Rule (SCSR)

Before mutating a file, agents must verify the target path is canonical.

```txt
if path not in CANONICAL_PATHS:
    abort("Mutation outside canonical scope")
```

## Cross-tree collision guard

Agents must abort when a change set contains both canonical and legacy twins.

Examples:

- `apps/gs-web/**` and `apps/web/**`
- `apps/gs-admin/**` and `apps/admin/**`

## Build-root memory lock

All web build assumptions must use:

- `BUILD_ROOT = apps/gs-web`

## Weekly audit checklist (Jules governance)

- No new root-level app directories.
- No duplicate theme systems.
- No new modifications under `astro-goldshore`.

## Memory anchor

The machine-readable source of truth is:

- `infra/AGENT_CANONICAL_STATE.json`
