# Cloudflare live-state handoff

**Overall handoff status: UNVERIFIED REPORT**

Generated from repository intent on 2026-08-13. No Cloudflare account query was
performed for this report. Consequently, **zero rows are live-verified**. The
canonical comparison inputs are `apps/gs-web/wrangler.toml` and
`apps/gs-api/wrangler.toml`; `infra/Cloudflare/desired-state.yaml` supplies only
the expected DNS and Access inventory and is not a deployment input or proof of
live state.

## Verification and mutation rules

1. An authorized operator must query Cloudflare using a read-only token or the
   dashboard while signed into the intended account. Public DNS, HTTP responses,
   old exports, screenshots, comments, and other reports are insufficient.
2. Export the account identifier, zone identifier/name, exact DNS names and
   values, exact Worker route patterns and script owners, Access applications and
   policies, and each Worker's bindings. Do not export secret values.
3. Record an ISO 8601 UTC timestamp and an exact method for every verified row,
   such as `Cloudflare API GET /zones/{zone_id}/workers/routes` or `Dashboard >
Workers & Pages > gs-api > Settings > Bindings`.
4. Compare the export with both canonical Wrangler manifests. Record `match`,
   `live-only`, `manifest-only`, or `value/owner mismatch` in the discrepancy
   column. Do **not** mutate Cloudflare, DNS, Access, bindings, or either manifest
   as part of verification.
5. Change only individually observed rows to `verified`. A wildcard route or
   Access application does not verify an inferred exact hostname, route, or
   policy. Historical dashboard observations remain `unverified report`.

Blank timestamps mean no authorized verification occurred. `Expected owner` and
`environment` below describe repository intent, not current Cloudflare state.

## DNS inventory (expected state only)

DNS is not declared by Wrangler. These rows come from the redacted desired-state
inventory and must be compared separately with the zone APIs.

| Zone            | Exact record name            | Expected owner / target class  | Environment | Status            | Verified at (UTC) | Verification method               | Discrepancy                    |
| --------------- | ---------------------------- | ------------------------------ | ----------- | ----------------- | ----------------- | --------------------------------- | ------------------------------ |
| `goldshore.ai`  | `goldshore.ai`               | `gs-web`                       | `prod`      | unverified report | —                 | pending authorized zone DNS query | not assessed                   |
| `goldshore.ai`  | `www.goldshore.ai`           | redirect / `gs-web` surface    | `prod`      | unverified report | —                 | pending authorized zone DNS query | not assessed                   |
| `goldshore.ai`  | `risk.goldshore.ai`          | `gs-web`                       | `prod`      | unverified report | —                 | pending authorized zone DNS query | not assessed                   |
| `goldshore.org` | `goldshore.org`              | `gs-web`                       | `prod`      | unverified report | —                 | pending authorized zone DNS query | not assessed                   |
| `goldshore.org` | `www.goldshore.org`          | redirect / `gs-web` surface    | `prod`      | unverified report | —                 | pending authorized zone DNS query | not assessed                   |
| `goldshore.ai`  | `admin.goldshore.ai`         | `gs-web`                       | `prod`      | unverified report | —                 | pending authorized zone DNS query | not assessed                   |
| `goldshore.org` | `admin.goldshore.org`        | `gs-web`                       | `prod`      | unverified report | —                 | pending authorized zone DNS query | not assessed                   |
| `goldshore.org` | `risk.goldshore.org`         | `gs-web`                       | `prod`      | unverified report | —                 | pending authorized zone DNS query | not assessed                   |
| `goldshore.ai`  | `api.goldshore.ai`           | `gs-api`                       | `prod`      | unverified report | —                 | pending authorized zone DNS query | not assessed                   |
| `goldshore.org` | `api.goldshore.org`          | `gs-api`                       | `prod`      | unverified report | —                 | pending authorized zone DNS query | not assessed                   |
| `goldshore.ai`  | `gw.goldshore.ai`            | `gs-api`                       | `prod`      | unverified report | —                 | pending authorized zone DNS query | not assessed                   |
| `goldshore.ai`  | `agent.goldshore.ai`         | `gs-api`                       | `prod`      | unverified report | —                 | pending authorized zone DNS query | not assessed                   |
| `goldshore.ai`  | `mail.goldshore.ai`          | `gs-api`                       | `prod`      | unverified report | —                 | pending authorized zone DNS query | not assessed                   |
| `goldshore.ai`  | `ops.goldshore.ai`           | `gs-api`                       | `prod`      | unverified report | —                 | pending authorized zone DNS query | not assessed                   |
| `goldshore.ai`  | `trading.goldshore.ai`       | `gs-api`                       | `prod`      | unverified report | —                 | pending authorized zone DNS query | not assessed                   |
| `goldshore.ai`  | `dashboard.goldshore.ai`     | `gs-api`                       | `prod`      | unverified report | —                 | pending authorized zone DNS query | not assessed                   |
| `goldshore.ai`  | `dash.goldshore.ai`          | `gs-api`                       | `prod`      | unverified report | —                 | pending authorized zone DNS query | not assessed                   |
| `goldshore.ai`  | `mcp.goldshore.ai`           | external/separately deployed   | unknown     | unverified report | —                 | pending authorized zone DNS query | outside Wrangler; not assessed |
| `goldshore.ai`  | `signals.goldshore.ai`       | historical satellite candidate | unknown     | unverified report | —                 | pending authorized zone DNS query | outside Wrangler; not assessed |
| `goldshore.ai`  | `em5094.goldshore.ai`        | email provider                 | `prod`      | unverified report | —                 | pending authorized zone DNS query | outside Wrangler; not assessed |
| `goldshore.ai`  | `s1._domainkey.goldshore.ai` | email provider                 | `prod`      | unverified report | —                 | pending authorized zone DNS query | outside Wrangler; not assessed |
| `goldshore.ai`  | `s2._domainkey.goldshore.ai` | email provider                 | `prod`      | unverified report | —                 | pending authorized zone DNS query | outside Wrangler; not assessed |
| `goldshore.ai`  | `_dmarc.goldshore.ai`        | DNS/email policy               | `prod`      | unverified report | —                 | pending authorized zone DNS query | outside Wrangler; not assessed |

This table is not proof that the inventory is complete. Any records returned by
the live query but absent here must be appended as `live-only`; they must not be
silently deleted.

## Worker routes from the canonical manifests

| Zone            | Exact pattern              | Expected Worker owner | Environment | Status            | Verified at (UTC) | Verification method                     | Discrepancy  |
| --------------- | -------------------------- | --------------------- | ----------- | ----------------- | ----------------- | --------------------------------------- | ------------ |
| `goldshore.ai`  | `goldshore.ai/*`           | `gs-web`              | `prod`      | unverified report | —                 | pending authorized Workers Routes query | not assessed |
| `goldshore.org` | `goldshore.org/*`          | `gs-web`              | `prod`      | unverified report | —                 | pending authorized Workers Routes query | not assessed |
| `goldshore.ai`  | `www.goldshore.ai/*`       | `gs-web`              | `prod`      | unverified report | —                 | pending authorized Workers Routes query | not assessed |
| `goldshore.org` | `www.goldshore.org/*`      | `gs-web`              | `prod`      | unverified report | —                 | pending authorized Workers Routes query | not assessed |
| `goldshore.ai`  | `admin.goldshore.ai/*`     | `gs-web`              | `prod`      | unverified report | —                 | pending authorized Workers Routes query | not assessed |
| `goldshore.org` | `admin.goldshore.org/*`    | `gs-web`              | `prod`      | unverified report | —                 | pending authorized Workers Routes query | not assessed |
| `goldshore.ai`  | `risk.goldshore.ai/*`      | `gs-web`              | `prod`      | unverified report | —                 | pending authorized Workers Routes query | not assessed |
| `goldshore.org` | `risk.goldshore.org/*`     | `gs-web`              | `prod`      | unverified report | —                 | pending authorized Workers Routes query | not assessed |
| `goldshore.ai`  | `api.goldshore.ai/*`       | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Workers Routes query | not assessed |
| `goldshore.org` | `api.goldshore.org/*`      | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Workers Routes query | not assessed |
| `goldshore.ai`  | `agent.goldshore.ai/*`     | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Workers Routes query | not assessed |
| `goldshore.org` | `agent.goldshore.org/*`    | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Workers Routes query | not assessed |
| `goldshore.ai`  | `mail.goldshore.ai/*`      | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Workers Routes query | not assessed |
| `goldshore.org` | `mail.goldshore.org/*`     | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Workers Routes query | not assessed |
| `goldshore.ai`  | `ops.goldshore.ai/*`       | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Workers Routes query | not assessed |
| `goldshore.ai`  | `trading.goldshore.ai/*`   | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Workers Routes query | not assessed |
| `goldshore.org` | `trading.goldshore.org/*`  | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Workers Routes query | not assessed |
| `goldshore.ai`  | `dashboard.goldshore.ai/*` | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Workers Routes query | not assessed |
| `goldshore.ai`  | `dash.goldshore.ai/*`      | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Workers Routes query | not assessed |
| `goldshore.ai`  | `gw.goldshore.ai/*`        | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Workers Routes query | not assessed |

No route above is verified merely because a broader wildcard route appears in a
historical export. Live-only routes and custom domains must be recorded as
separate exact rows.

## Access applications and policies (expected state only)

Wrangler contains audience/application variables but does not declare Access
applications or policies. The following desired-state entries are comparison
leads, not authoritative coverage.

| Zone/account scope       | Exact application or policy name | Expected Worker/surface owner  | Environment | Exact expected domains                                                                   | Status            | Verified at (UTC) | Verification method                               | Discrepancy                    |
| ------------------------ | -------------------------------- | ------------------------------ | ----------- | ---------------------------------------------------------------------------------------- | ----------------- | ----------------- | ------------------------------------------------- | ------------------------------ |
| account / `goldshore.ai` | `GoldShore-Dashboard`            | `gs-web`                       | `prod`      | `goldshore.ai` (`/app*`)                                                                 | unverified report | —                 | pending authorized Access apps and policies query | not assessed                   |
| account / both zones     | `GoldShore-Admin-ZT`             | `gs-web`                       | `prod`      | `admin.goldshore.ai`; `admin.goldshore.org`                                              | unverified report | —                 | pending authorized Access apps and policies query | not assessed                   |
| account / `goldshore.ai` | `Goldshore Ops`                  | `gs-api`                       | `prod`      | `ops.goldshore.ai`                                                                       | unverified report | —                 | pending authorized Access apps and policies query | not assessed                   |
| account / `goldshore.ai` | `GoldShore-Trading-ZT`           | `gs-api`                       | `prod`      | `trading.goldshore.ai`; `dashboard.goldshore.ai`; `dash.goldshore.ai`                    | unverified report | —                 | pending authorized Access apps and policies query | not assessed                   |
| account / `goldshore.ai` | `Goldshore Gateway`              | `gs-api`                       | `prod`      | `gw.goldshore.ai`; `agent.goldshore.ai`; `gs-agent.goldshore.workers.dev`                | unverified report | —                 | pending authorized Access apps and policies query | not assessed                   |
| account / `goldshore.ai` | `Goldshore API`                  | `gs-api`                       | `prod`      | `api.goldshore.ai`; `gs-api.goldshore.workers.dev`                                       | unverified report | —                 | pending authorized Access apps and policies query | not assessed                   |
| account / both zones     | `Signals`                        | historical satellite candidate | unknown     | `signals.goldshore.ai`; `signals.goldshore.org`; `gs-signals-prod.goldshore.workers.dev` | unverified report | —                 | pending authorized Access apps and policies query | outside Wrangler; not assessed |
| account / `goldshore.ai` | `GoldShore MCP`                  | external/separately deployed   | unknown     | `mcp.goldshore.ai`                                                                       | unverified report | —                 | pending authorized Access apps and policies query | outside Wrangler; not assessed |
| account / `goldshore.ai` | `Temp HP Laptop SSH`             | external tunnel                | unknown     | `ssh-laptop.goldshore.ai`                                                                | unverified report | —                 | pending authorized Access apps and policies query | outside Wrangler; not assessed |

The operator must record each exact application and each attached policy returned
by Cloudflare. Similar names, an audience value in Wrangler, or an inferred
wildcard application are not verification.

## Dashboard binding comparison baseline

These are the non-secret binding contracts parsed from the canonical production
environments. Resource identifiers are intentionally omitted from this handoff;
compare their exact values directly with the manifests. Variables are checked-in
configuration, not dashboard-only binding evidence. Secret names and values must
be inspected without exporting values and added as separate redacted rows.

| Zone/scope | Exact binding      | Type / expected resource                                            | Expected Worker owner | Environment | Status            | Verified at (UTC) | Verification method                      | Discrepancy  |
| ---------- | ------------------ | ------------------------------------------------------------------- | --------------------- | ----------- | ----------------- | ----------------- | ---------------------------------------- | ------------ |
| account    | `ASSETS`           | Workers Assets (`./dist`)                                           | `gs-web`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `IMAGES`           | Images                                                              | `gs-web`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `SESSION`          | KV (`goldshore-ai-session` by manifest comment; compare ID exactly) | `gs-web`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `KV`               | KV                                                                  | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `CONTROL_LOGS`     | KV                                                                  | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `RISK_RADAR_CACHE` | KV                                                                  | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `TRADING_KV`       | KV                                                                  | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `GS_ASSETS`        | R2 `gs-assets`                                                      | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `MAIL_ARCHIVE`     | R2 `gs-assets`                                                      | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `TELEMETRY`        | R2 `gs-telemetry-storage`                                           | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `RISK_RADAR_R2`    | R2 `gs-risk-radar-raw`                                              | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `PLATFORM_DB`      | D1 `gs_platform_db`                                                 | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `AUDIT_DB`         | D1 `gs_audit_db`                                                    | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `SIGNALS_DB`       | D1 `gs_signals_db`                                                  | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `RISK_RADAR_DB`    | D1 `risk-radar-db`                                                  | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `JOBS_DB`          | D1 `gs_jobs_db`                                                     | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `PAPER_DB`         | D1 `goldshore-paper-trading`                                        | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `AI`               | Workers AI                                                          | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `EMAIL`            | Email Sending (three allowed sender addresses in manifest)          | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `JOBS_QUEUE`       | queue producer `goldshore-jobs`                                     | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `EVENTS_QUEUE`     | queue producer `gs-events`                                          | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `MAIL_JOBS_QUEUE`  | queue producer `gs-mail-jobs`                                       | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `goldshore-jobs`   | queue consumer                                                      | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker triggers query | not assessed |
| account    | `gs-events`        | queue consumer                                                      | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker triggers query | not assessed |
| account    | `gs-mail-jobs`     | queue consumer                                                      | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker triggers query | not assessed |
| account    | `GS_SIGNALS`       | Workflow `gs-signals-evaluator` / `SignalsEvaluator`                | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker bindings query | not assessed |
| account    | `0 2 * * *`        | cron trigger                                                        | `gs-api`              | `prod`      | unverified report | —                 | pending authorized Worker triggers query | not assessed |

## Discrepancy log

No live comparison has occurred, so there are no asserted discrepancies yet.
The authorized operator must append findings here without applying a fix.

| Observed at (UTC) | Scope/zone | Exact item | Classification | Manifest/expected value | Live value (redacted if needed) | Verification method     | Follow-up owner                |
| ----------------- | ---------- | ---------- | -------------- | ----------------------- | ------------------------------- | ----------------------- | ------------------------------ |
| —                 | —          | —          | not assessed   | —                       | —                               | no authorized query yet | authorized Cloudflare operator |

## Handoff

- **Branch:** record at handoff time with `git branch --show-current`.
- **Commit:** record after this report is committed with `git rev-parse HEAD`.
- **Deployment/preview URL:** none; documentation-only change.
- **Blocker:** an authorized Cloudflare operator must perform the read-only live
  queries. No agent should infer current state or perform reconciliation.
- **Next action:** query, timestamp, compare, and document discrepancies; open a
  separate reviewed change for any proposed manifest or dashboard mutation.
