# gs-api satellite and asynchronous-resource inventory

Inventory date: 2026-08-09. Scope: `apps/`, `.github/workflows/`, and `infra/`.
This snapshot intentionally excludes this inventory file from its own results.

## Static reference inventory

| Search term | Files containing the term before this consolidation |
|---|---|
| `gs-mail` | `apps/gs-api/README.md`; `apps/gs-api/wrangler.toml`; `apps/gs-mail/package.json`; `apps/gs-mail/src/index.ts`; `apps/gs-mail/wrangler.toml`; `apps/gs-platform/src/index.ts`; `apps/gs-web/src/components/InboxTable.astro`; `apps/gs-web/src/pages/index.astro`; `infra/AGENT_CANONICAL_STATE.json`; `infra/Cloudflare/AUDIT_2026-04-04.md`; `infra/Cloudflare/BINDINGS_MAP.md`; `infra/Cloudflare/GS-WEB-PROD-SOURCE-OF-TRUTH.md`; `infra/Cloudflare/README.md`; `infra/Cloudflare/WORKFLOWS_ROUTES_BINDINGS.md`; `infra/Cloudflare/config.yaml`; `infra/Cloudflare/gs-api.wrangler.toml`; `infra/Cloudflare/gs-platform.wrangler.toml`; `infra/Cloudflare/legacy-archive-resources.yaml`; `infra/Cloudflare/runbooks/MODULE_B2_RUNTIME_WIRING.md`; `infra/INFRASTRUCTURE.md` |
| `gs-signals` | `.github/workflows/cf-discover.yml`; `.github/workflows/setup-cf-agent-access.yml`; `apps/gs-api/wrangler.toml`; `apps/gs-platform/src/index.ts`; `infra/Cloudflare/BINDINGS_MAP.md`; `infra/Cloudflare/GS-WEB-PROD-SOURCE-OF-TRUTH.md`; `infra/Cloudflare/WORKFLOWS_ROUTES_BINDINGS.md`; `infra/Cloudflare/desired-state.yaml`; `infra/Cloudflare/gs-api.wrangler.toml`; `infra/Cloudflare/gs-platform.wrangler.toml`; `infra/INFRASTRUCTURE.md` |
| `signals-evaluator` | `apps/gs-api/src/index.ts`; `apps/gs-api/wrangler.toml`; `infra/Cloudflare/GS-WEB-PROD-SOURCE-OF-TRUTH.md`; `infra/Cloudflare/WORKFLOWS_ROUTES_BINDINGS.md`; `infra/Cloudflare/gs-api.wrangler.toml` |
| `goldshore-jobs` | `apps/gs-agent/wrangler.toml`; `apps/gs-api/wrangler.toml`; `infra/Cloudflare/GS-WEB-PROD-SOURCE-OF-TRUTH.md`; `infra/Cloudflare/WORKFLOWS_ROUTES_BINDINGS.md`; `infra/Cloudflare/gs-admin.wrangler.toml`; `infra/Cloudflare/gs-agent.wrangler.toml`; `infra/Cloudflare/gs-api.wrangler.toml`; `infra/Cloudflare/legacy/goldshore-admin.wrangler.toml` |
| `gs-events` | `apps/gs-api/wrangler.toml`; `infra/Cloudflare/GS-WEB-PROD-SOURCE-OF-TRUTH.md`; `infra/Cloudflare/WORKFLOWS_ROUTES_BINDINGS.md`; `infra/Cloudflare/gs-api.wrangler.toml` |
| `gs-mail-jobs` | `apps/gs-api/wrangler.toml`; `infra/Cloudflare/BINDINGS_MAP.md`; `infra/Cloudflare/GS-WEB-PROD-SOURCE-OF-TRUTH.md`; `infra/Cloudflare/WORKFLOWS_ROUTES_BINDINGS.md`; `infra/Cloudflare/gs-api.wrangler.toml` |
| `gs-mail-dead-letter` | `apps/gs-api/wrangler.toml`; `infra/Cloudflare/GS-WEB-PROD-SOURCE-OF-TRUTH.md`; `infra/Cloudflare/WORKFLOWS_ROUTES_BINDINGS.md`; `infra/Cloudflare/gs-api.wrangler.toml`; `infra/Cloudflare/legacy-archive-resources.yaml` |

## Consumer trace and disposition

- `apps/gs-mail/src/index.ts` contains the legacy inbound-email and contact/checkout
  queue handlers. Equivalent inbound-email handling now lives in the `gs-api`
  module entry point, while the queue event adapters live in
  `apps/gs-api/src/workers/queue-consumer.ts`.
- Public form persistence and transactional notifications already run through
  `apps/gs-api/src/routes/forms.ts` and `apps/gs-api/src/lib/mail.ts`.
- The daily OAuth token-rotation implementation already existed in
  `apps/gs-api/src/workers/token-rotation.ts`; the module entry point now exposes
  the scheduled handler that the canonical cron invokes.
- `apps/gs-agent` contains the legacy `goldshore-jobs` consumer. The canonical
  `gs-api` queue entry point now handles its agent, signal, trading, and mail
  event shapes.
- `apps/gs-platform` and the infrastructure Wrangler copies contain historical
  service bindings to the satellite mail/signals Workers. They are outside the
  workspace and are retained as trace evidence until Cloudflare verification.
- The canonical `GS_SIGNALS` Workflow now targets the exported
  `SignalsEvaluator` class in `gs-api`. Production and preview use separate
  Workflow names.
- No runtime source consumed bindings named `WORKFLOWS` or `PIPELINES`. The admin
  resource table advertised both as if provisioned, so those claims were removed;
  it now displays only the implemented `GS_SIGNALS` Workflow.

## Queue ownership contract

| Environment | Producer bindings | Consumer owner | Dead-letter owner |
|---|---|---|---|
| Production | `gs-api`: `JOBS_QUEUE` → `goldshore-jobs`; `EVENTS_QUEUE` → `gs-events`; `MAIL_JOBS_QUEUE` → `gs-mail-jobs` | `gs-api` module `queue()` handler | `gs-mail-dead-letter`; operations owns inspection and explicit replay |
| Preview | `gs-api`: the same bindings target `goldshore-jobs-preview`, `gs-events-preview`, and `gs-mail-jobs-preview` | `gs-api-preview` module `queue()` handler | `gs-mail-dead-letter-preview`; preview operations owns inspection and explicit replay |

All three primary queues use batches of 10, a five-second batch timeout (30
seconds for mail), five retries, and a 60-second retry delay. Failed production
messages dead-letter only to the production DLQ; preview messages dead-letter
only to the preview DLQ. The DLQs have no automatic consumer, preventing poison
messages from entering an unbounded retry/redrive loop.

Queue processing uses `(queue name, Cloudflare message id)` as an idempotency key
in `KV`, retained for seven days. Queue message retention is a resource property,
not a Worker binding property: provision each primary queue and DLQ with the
Cloudflare maximum retention of 14 days. Operations owns any later redrive and
must preserve the original message id (or an explicit business idempotency key).

## Live verification and deletion gate

Static tracing is complete, but live dashboard/API verification could not be
performed because this environment has no authenticated Cloudflare session.
Therefore this change deliberately does **not** delete `apps/gs-mail`, any
satellite Wrangler manifest, legacy service binding, queue, route, Email Routing
rule, or Worker. An authenticated operator must verify Worker routes, Email
Routing destinations, service-binding callers, queue consumers, cron triggers,
Workflow ownership, and recent traffic before deletion. After deployment, the
operator must also provision the four preview queues, set 14-day retention on all
eight production/preview queue resources, move Email Routing to `gs-api-prod`,
and confirm each production queue has only the `gs-api-prod` push consumer.
