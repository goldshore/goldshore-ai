# Cloudflare binding matrix

**Status:** normative desired state for the two-app architecture. `apps/gs-api/wrangler.toml` and `apps/gs-web/wrangler.toml` remain the deploy manifests. Resource identifiers must be reconciled with Cloudflare before deployment; the reserved `00000000-…` preview D1 identifiers deliberately fail closed until the named databases are provisioned and their real IDs are inserted.

## Control rules

- `gs-api` is the sole binding owner for transactional D1 and sensitive R2. `gs-web` has only static `ASSETS`, non-sensitive UI/session KV, Images, and public configuration; it calls authenticated API routes for contact, forms, CMS, media, and administration.
- Production and preview never share persistent resources. Preview data must be synthetic or redacted; copying production data requires a documented, approved export/scrub/import operation.
- “Delete” below means a two-person-approved Cloudflare dashboard/API operation after dependency checks, legal hold review, backup verification, and the stated quarantine period. Never delete a binding and assume that deletes its resource.
- Secret values are write-only. Operator UI/API responses may expose only **name, presence, environment, owner, and rotation status**. Rotation is performed by an approved operator in Cloudflare; no UI endpoint accepts, returns, logs, or tests a secret value.

## Data bindings

| Type / binding | Resource (production / preview) | Owner Worker | Environment | Classification | Producer | Consumer | Retention | Backup | Deletion policy |
|---|---|---|---|---|---|---|---|---|---|
| D1 `PLATFORM_DB` | `gs_platform_db` / `gs_platform_db_preview` | `gs-api` | prod / preview | Confidential: accounts, contacts, CMS, admin configuration | API form, CMS, account and admin routes | Authenticated API routes; approved jobs | Active account + 30 days; leads 365 days unless consent/legal policy requires less | D1 Time Travel plus encrypted monthly export; preview has no production backup | API/anonymization workflow; purge expired rows monthly; database deletion after 30-day quarantine |
| D1 `AUDIT_DB` | `gs_audit_db` / `gs_audit_db_preview` | `gs-api` | prod / preview | Restricted audit/security | API and control-plane audit writers | Security and approved admin readers | 400 days immutable | Time Travel and encrypted monthly export | Legal/security approval; database deletion after 90-day quarantine |
| D1 `SIGNALS_DB` | `gs_signals_db` / `gs_signals_db_preview` | `gs-api` | prod / preview | Internal market-derived data | signal ingestion and `GS_SIGNALS` Workflow | signal/risk API routes | 2 years aggregates; 90 days raw | Time Travel; monthly logical export | Scheduled partition purge; 30-day resource quarantine |
| D1 `RISK_RADAR_DB` | `gs_risk_radar_db` / `gs_risk_radar_db_preview` | `gs-api` | prod / preview | Internal/confidential derived risk data | risk ingestion/evaluator | risk API routes | 2 years aggregates; 90 days observations | Time Travel; monthly logical export | Scheduled purge; 30-day resource quarantine |
| D1 `JOBS_DB` | `gs_jobs_db` / `gs_jobs_db_preview` | `gs-api` | prod / preview | Internal operational metadata | API schedulers/queue handlers | API control and job routes | Completed jobs 30 days; failures 90 days | Time Travel only | Daily TTL purge; 14-day resource quarantine |
| D1 `PAPER_DB` | `goldshore-paper-trading` / `goldshore-paper-trading-preview` | `gs-api` | prod / preview | Confidential financial simulation | trading API and agents | authenticated trading API | 7 years for ledger; recommendations 2 years | Time Travel and encrypted monthly export | User deletion anonymizes identifiers; ledger deletion only per finance/legal approval |
| R2 `GS_ASSETS` | `gs-assets` / `gs-assets-preview` | `gs-api` | prod / preview | Mixed; private by default, may contain customer uploads | authenticated media/CMS API | signed API access; scanner | Published assets while referenced; uploads 365 days | Versioning where available; inventory + replicated/exported critical originals | Soft-delete tag 30 days, then lifecycle delete; legal hold overrides |
| R2 `TELEMETRY` | `gs-telemetry-storage` / `gs-telemetry-storage-preview` | `gs-api` | prod / preview | Restricted operational/security telemetry | API/email/queue handlers | security analytics and approved jobs | 90 days prod; 14 days preview | No routine backup; derived reports backed up | Lifecycle expiry; incident/legal hold overrides |
| R2 `RISK_RADAR_R2` | `gs-risk-radar-raw` / `gs-risk-radar-raw-preview` | `gs-api` | prod / preview | Internal raw source data | risk ingestion | scanner and risk processing | 90 days prod; 14 days preview | Re-creatable; inventory only | Lifecycle expiry; 7-day quarantine for manual deletion |
| KV `KV` | API KV IDs in manifest (distinct IDs) | `gs-api` | prod / preview | Confidential ephemeral API state | API routes | API routes/jobs | Per-key TTL; maximum 30 days unless catalogued | None; source data resides in D1 | TTL or explicit API delete; namespace 14-day quarantine |
| KV `CONTROL_LOGS` | control-log IDs in manifest (distinct IDs) | `gs-api` | prod / preview | Restricted audit/control | control routes | approved operators | 90 days | Export incident records only | TTL; namespace 30-day quarantine |
| KV `RISK_RADAR_CACHE` | risk cache IDs in manifest (distinct IDs) | `gs-api` | prod / preview | Internal cache | risk API | risk API | 24 hours | None | TTL; safe cache invalidation |
| KV `TRADING_KV` | trading KV IDs in manifest (distinct IDs) | `gs-api` | prod / preview | Restricted OAuth and orchestration state | trading OAuth/API | trading API/jobs | Tokens until rotation/revocation; state 30 days | No plaintext backup | Revoke upstream, delete key, audit event; namespace 30-day quarantine |
| KV `KV` | web KV IDs in manifest | `gs-web` | prod / preview | Internal non-transactional UI/cache only | web runtime | web runtime | 24 hours | None | TTL; never store contact/CMS/admin records |
| KV `SESSION` | web session IDs in manifest | `gs-web` | prod / preview | Confidential session metadata | authenticated web middleware | web middleware | Session lifetime, maximum 24 hours | None | Logout/TTL; namespace 14-day quarantine |

`ASSETS` (Worker static assets), `IMAGES`, and Workers AI `AI` are platform capabilities rather than customer data stores. `gs-web` produces/consumes build assets; `gs-api` consumes Images/AI results. Build assets follow release retention (current + two prior releases); AI request/response persistence is prohibited unless routed to a classified store above.

## Messaging, orchestration, pipeline, and service bindings

| Type / binding | Resource (production / preview) | Owner Worker | Environment | Classification | Producer | Consumer | Retention | Backup | Deletion policy |
|---|---|---|---|---|---|---|---|---|---|
| Queue `JOBS_QUEUE` | `goldshore-jobs` / `goldshore-jobs-preview` | `gs-api` | prod / preview | Confidential job payload | API schedulers/routes | registered API queue handler | Ack immediately; max retry/queue retention 4 days | D1 system of record | Drain, verify DLQ, disable producer, delete after 7 days |
| Queue `EVENTS_QUEUE` | `gs-events` / `gs-events-preview` | `gs-api` | prod / preview | Confidential event metadata | API routes | `gs-api` queue handler | Ack immediately; max 4 days | Audit DB for required events | Same drain procedure |
| Queue `MAIL_JOBS_QUEUE` | `gs-mail-jobs` / `gs-mail-jobs-preview` | `gs-api` | prod / preview | Restricted contact/message metadata | form/mail routes | approved pull/API mail processor | Ack immediately; max 4 days | Submission record in D1, never mail body backup | Same drain procedure; redact logs |
| Queue `DEAD_LETTER_QUEUE` | `gs-mail-dead-letter` / `gs-mail-dead-letter-preview` | `gs-api` | prod / preview | Restricted failed message metadata | queue failure handling | approved operator replay tooling | 14 days prod; 3 days preview | None | Resolve/replay then delete; incident hold overrides |
| Workflow `GS_SIGNALS` | `signals-evaluator` / `signals-evaluator-preview` | `gs-api` | prod / preview | Internal derived signal state | schedules/events | `SignalsEvaluator` in `gs-api` | Platform execution history 30 days | Results in D1 | Disable triggers, wait for runs, retain audit, delete after 7 days |
| Pipeline | **None declared** | `gs-api` | all | N/A | N/A | N/A | N/A | N/A | A new pipeline requires this matrix and manifest to be updated first |
| Service binding | **None declared in canonical two-app manifests** | N/A | all | N/A | N/A | N/A | N/A | N/A | Do not restore satellite Worker bindings; use in-process `gs-api` routes |

## Secret-name inventory (values prohibited)

All names below are owned by `gs-api` in **separate prod and preview secret scopes**. Producer is an approved Cloudflare dashboard operation or CI secret sync; consumer is the named `gs-api` integration. Retention is until rotated/revoked, no value backups are permitted outside approved provider/secret managers, and deletion requires disabling the consumer, revoking upstream credentials, deleting in Cloudflare, and recording an audit event.

| Secret names | Classification | Consumer / rotation policy |
|---|---|---|
| `JWT_SECRET`, `ACCESS_CLIENT_SECRET`, `CONTROL_SYNC_TOKEN`, `INTEGRATION_MASTER_KEY`, `OAUTH_TOKEN_ENCRYPTION_KEY` | Restricted cryptographic/auth | Core auth/control/encryption; rotate at least every 90 days and immediately on suspected exposure |
| `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `LLM_API_KEY`, `OPENCLAW_API_KEY`, `LOCAL_LLM_API_KEY` | Restricted provider credential | AI providers; rotate every 90 days or provider recommendation |
| `GITHUB_TOKEN`, `GITHUB_API_TOKEN`, `GH_TOKEN`, `GITHUB_CLIENT_SECRET` | Restricted provider/OAuth | Deployment assistant and OAuth; rotate every 90 days |
| `TURNSTILE_SECRET_KEY`, `MAILCHANNELS_SENDER_EMAIL`, `SENDGRID_API_KEY` | Restricted anti-abuse/mail | Forms and mail; rotate credential secrets every 90 days; sender identity presence reviewed quarterly |
| `STRIPE_API_KEY` | Restricted financial provider | Billing; rotate under Stripe dual-key procedure every 90 days |
| `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `META_APP_SECRET`, `X_CLIENT_SECRET` | Restricted OAuth/provider | Integrations; rotate at least every 90 days and revoke old credentials |
| `GOLDCLAW_SANDBOX_API_TOKEN` | Restricted integration token | Sandbox bridge; rotate every 30 days |
| `CLOUDFLARE_API_TOKEN` | Restricted infrastructure | Admin/control API only; least privilege and rotate every 90 days |

Non-secret identifiers (client IDs, account IDs, audience, team domain, site keys, URLs) stay in `vars`; they must not be mislabeled as secrets. `gs-web` owns **no Worker secrets**. Presence/rotation metadata must be obtained from Cloudflare metadata APIs without any endpoint capable of returning secret material.

## Provisioning and verification gates

1. Provision every `*-preview` resource in Cloudflare and replace reserved preview D1 IDs in `apps/gs-api/wrangler.toml`; never substitute a production ID.
2. Apply D1 migrations using `apps/gs-api/db/migrations/TEMPLATE.md`, then run each migration's verification query.
3. Apply `infra/Cloudflare/R2_POLICY.md` to all six buckets before enabling upload routes.
4. Verify `gs-web` deployment metadata contains no `PLATFORM_DB`, `GS_ASSETS`, provider secret, or transactional KV use.
5. Deploy preview, run authenticated form/CMS/admin/media smoke tests, verify production row/object counts did not change, then deploy production.
