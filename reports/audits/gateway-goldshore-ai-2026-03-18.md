# gateway.goldshore.ai audit — 2026-03-18

## Scope

Audit the repository state related to the legacy `gateway.goldshore.ai` hostname and verify whether it aligns with the documented canonical gateway domain.

## Findings

1. `docs/domains-and-auth.md` and `docs/brand-asset-plan.md` define `gw.goldshore.ai` as the canonical gateway hostname and explicitly say not to use `gateway.goldshore.ai`.
2. `apps/gs-gateway/wrangler.toml` had duplicate production blocks and still declared `gateway.goldshore.ai/*`, which made the route-collision audit fail.
3. `apps/gs-web/src/content/docs/gateway/routing.mdx` still documented `gateway.goldshore.ai` as an active hostname.
4. `scripts/sync-gateway.ts` still published `gateway.goldshore.ai` into the routing table, which could reintroduce the legacy hostname during KV sync.
5. `scripts/validate-worker-names.ts` still treated `gateway.goldshore.ai` as an expected worker-owned hostname, which weakened the canonical-host enforcement.

## Remediation applied

- Rewrote `apps/gs-gateway/wrangler.toml` into a single clean configuration with only `gw.goldshore.ai` and `agent.goldshore.ai` production routes.
- Updated the gateway routing documentation to keep only the canonical public hostname.
- Updated the worker-name validation and KV sync configuration to reference `gw.goldshore.ai` instead of `gateway.goldshore.ai`.

## Validation

- `node scripts/check-route-collisions.mjs`
- `pnpm -s tsx scripts/validate-worker-names.ts`
