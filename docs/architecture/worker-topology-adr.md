# ADR: Worker Topology Consolidation Options

Status: Proposed

Merge Strategy: Squash

## Context

GoldShore currently deploys four Cloudflare Workers with multiple cross-worker integrations:

- `gs-api` serves `api.goldshore.ai` and `api-preview.goldshore.ai`.
- `gs-control` serves `ops.goldshore.ai` and `ops-preview.goldshore.ai`.
- `gs-gateway` serves `agent.goldshore.ai`, `gw.goldshore.ai`, `gateway.goldshore.ai`, and `gw-preview.goldshore.ai`.
- `gs-agent` consumes the `goldshore-jobs` queue and is invoked through `gs-gateway` for `agent.goldshore.ai` traffic.

The main coupling points today are:

- `CONTROL_SYNC_TOKEN` shared between `gs-control` and `gs-api`.
- `API` service bindings from `gs-control` and `gs-gateway` into `gs-api`.
- `GATEWAY` service binding from `gs-control` into `gs-gateway`.
- `AGENT` service binding from `gs-gateway` into `gs-agent`.
- `goldshore-jobs` queue producer in `gs-gateway` and consumer in `gs-agent`.

## Current inventory

### Routes by worker

| Worker | Environment | Routes |
| --- | --- | --- |
| `gs-api` | `prod` / `production` | `api.goldshore.ai/*` |
| `gs-api` | `preview` | `api-preview.goldshore.ai/*` |
| `gs-control` | top-level | `ops.goldshore.ai/*` |
| `gs-control` | `preview` | `ops-preview.goldshore.ai/*` |
| `gs-gateway` | top-level / `production` | `agent.goldshore.ai/*`, `gw.goldshore.ai/*`, `gateway.goldshore.ai/*` |
| `gs-gateway` | `preview` | `gw-preview.goldshore.ai/*` |
| `gs-agent` | all envs | no direct routes declared |

### Bindings and secrets by worker

| Worker | Binding / secret | Type | Environments |
| --- | --- | --- | --- |
| `gs-api` | `KV` | KV namespace | `prod`, `production`, `preview` |
| `gs-api` | `CONTROL_LOGS` | KV namespace | `prod`, `production`, `preview` |
| `gs-api` | `ASSETS` | R2 bucket | `prod`, `production`, `preview` |
| `gs-api` | `DB` | D1 database | `prod`, `production`, `preview` |
| `gs-api` | `AI` | AI binding | `prod`, `production`, `preview` |
| `gs-api` | `CLOUDFLARE_ACCESS_AUDIENCE` | secret/var | `prod`, `production`, `preview` |
| `gs-api` | `CLOUDFLARE_TEAM_DOMAIN` | var | `prod`, `production`, `preview` |
| `gs-api` | `CONTROL_SYNC_TOKEN` | secret/var | `prod`, `production`, `preview` |
| `gs-control` | `CONTROL_LOGS` | KV namespace | top-level, `preview` |
| `gs-control` | `GS_CONFIG` | KV namespace | top-level only |
| `gs-control` | `STATE` | R2 bucket | top-level only |
| `gs-control` | `API` | service binding to `gs-api` | top-level, `preview` |
| `gs-control` | `GATEWAY` | service binding to `gs-gateway` | top-level only |
| `gs-control` | `CONTROL_SYNC_TOKEN` | secret/var | top-level, `preview` |
| `gs-control` | `SYNC_TARGET_SUBDOMAIN` | var | top-level, `preview` |
| `gs-gateway` | `GATEWAY_KV` | KV namespace | `production`, `prod`, `preview` |
| `gs-gateway` | `JOB_QUEUE` | queue producer for `goldshore-jobs` | `production`, `prod` |
| `gs-gateway` | `API` | service binding to `gs-api` | `preview`, `prod` |
| `gs-gateway` | `AGENT` | service binding to `gs-agent` | `production` |
| `gs-gateway` | `AI` | AI binding | `preview`, `prod` |
| `gs-gateway` | `API_ORIGIN` | var | `production`, `prod`, `preview` |
| `gs-gateway` | `CLOUDFLARE_ACCESS_AUDIENCE` | secret/var | `production`, `prod`, `preview` |
| `gs-gateway` | `CLOUDFLARE_TEAM_DOMAIN` | var | `production`, `prod`, `preview` |
| `gs-agent` | `AGENT_KV` | KV namespace | top-level, `prod`, `production` |
| `gs-agent` | `goldshore-jobs` | queue consumer | top-level, `prod`, `production` |
| `gs-agent` | `AI` | AI binding | top-level, `prod`, `production` |
| `gs-agent` | `CLOUDFLARE_TEAM_DOMAIN` | var | top-level, `prod`, `production` |
| `gs-agent` | `CLOUDFLARE_ACCESS_AUDIENCE` | secret/var at runtime | top-level, `prod`, `production` |

### Cross-worker and cross-boundary code paths

1. **`gs-control` → `gs-api` via `API` service binding**
   - `syncDNS()` uses `env.API.fetch(target.checkUrl)` to probe the API worker and compare the resolved host and worker hint headers.
2. **`gs-gateway` → `gs-api` via `API` service binding or external origin fallback**
   - `/api/*` forwards to `c.env.API.fetch(...)` when the service binding exists, else falls back to `fetch(API_ORIGIN)`.
3. **`gs-gateway` → `gs-agent` via `AGENT` service binding**
   - Requests for `agent.goldshore.ai` are forwarded with a correlation ID to `c.env.AGENT.fetch(...)`.
4. **`gs-gateway` → `goldshore-jobs` queue → `gs-agent` consumer**
   - Wrangler declares the queue producer on `gs-gateway` and the consumer on `gs-agent`; this is the only explicit async worker-to-worker boundary in the four target workers, although no in-repo `JOB_QUEUE.send()` call was found yet.
5. **`gs-control` ↔ `gs-api` shared trust secret `CONTROL_SYNC_TOKEN`**
   - `gs-api` uses `x-control-sync-token` on `POST /internal/sync-runs` as an auth bypass for control-plane synchronization, while both workers declare the shared secret in Wrangler; no matching sender implementation was found in `gs-control` yet.
6. **Declared but currently unreferenced service binding**
   - `gs-control` declares a `GATEWAY` service binding, but no current runtime code path in `apps/gs-control/src` calls `env.GATEWAY.fetch(...)`.
7. **Shared-state boundary rather than direct fetch**
   - `gs-control` writes `SERVICE_STATUS` and `ROUTING_TABLE` to `GS_CONFIG`, while `gs-api` reads status/config from `KV` and `CONTROL_LOGS`; this means operational sync also spans workers through storage and operator procedures, not just service bindings.

## Options

### Option 1: Keep topology as-is

**Pros**

- Lowest deployment risk.
- Preserves current route ownership and blast-radius isolation.
- No migration work for Access, queues, or worker-specific build pipelines.

**Cons**

- Keeps all current cross-worker trust and forwarding paths.
- Leaves inconsistent environment wiring in place (`prod` vs `production`, `AGENT` only in one gateway environment, `GATEWAY` only in one control environment).
- Requires continued coordination for `CONTROL_SYNC_TOKEN`, service bindings, and queue contracts.

### Option 2: Increase service-binding usage while keeping workers separate

**Pros**

- Reduces public-origin fallback behavior and makes inter-worker calls explicit.
- Lets the team standardize preview/prod wiring without merging codebases.
- Improves observability and dependency mapping incrementally.

**Cons**

- Does not remove the main topology complexity; it formalizes it.
- `goldshore-jobs` and `CONTROL_SYNC_TOKEN` still remain cross-worker boundaries.
- Still requires per-worker deploy ordering and compatibility validation.

### Option 3: Merge a tightly coupled worker pair

**Pros**

- Eliminates one or more service bindings entirely.
- Simplifies route ownership and environment promotion for the merged pair.
- Can reduce latency and trace fragmentation on internal hops.

**Cons**

- Highest migration complexity.
- Requires careful route, Access, queue, and secret compatibility planning.
- Increases blast radius for the merged worker.

## Recommendation

**Recommended candidate pair: merge `gs-gateway` and `gs-agent`.**

Why this pair is the best first consolidation target:

- `gs-gateway` already owns the public `agent.goldshore.ai` route and simply forwards those requests to `gs-agent`, so the `AGENT` service binding appears to be an avoidable internal hop.
- `gs-agent` is operationally small today: a few fetch endpoints plus the `goldshore-jobs` queue consumer.
- Merging them removes the `AGENT` service binding entirely while keeping `gs-api` isolated as the main data/API boundary and keeping `gs-control` isolated as the admin/operations boundary.
- This option preserves the existing queue-based background model while allowing the same worker to expose the agent HTTP endpoints and consume the agent jobs.

## Decision

No implementation decision is approved yet.

If the team approves this ADR, the next step should be:

1. Draft a merged `gs-gateway` + `gs-agent` Wrangler configuration for both preview and production.
2. Define the route map that keeps `gw*` and `agent*` hostnames stable.
3. Produce a staged migration and rollback plan that validates Access, KV, AI, and queue compatibility before cutover.
