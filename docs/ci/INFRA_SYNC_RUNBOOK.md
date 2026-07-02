# Infra Sync Runbook

Use `.github/workflows/deploy-platform.yml` for Cloudflare app deploys and the Cloudflare helper scripts for targeted infrastructure reconciliation separate from app deploy pipelines.

For incident triage and guardrail verification, inspect and run `.github/workflows/infrastructure-guard.yml` (the canonical Cloudflare live-state guard workflow in this repo).

## Trigger model

- **Manual (`workflow_dispatch`):** the only trigger; recommended for urgent reconciliation, post-incident verification, or post-rotation validation.

## When to run manually

Run Cloudflare infrastructure reconciliation manually when:

- You rotate Cloudflare credentials or namespace bindings.
- You changed Cloudflare resources via dashboard/API and need repo-defined state re-applied.
- You need immediate drift correction before the next scheduled run.

## Required GitHub Secrets

Set these repository secrets before enabling the workflow:

- `CLOUDFLARE_BUILD_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_KV_NAMESPACE_API_ID`
- `CLOUDFLARE_KV_NAMESPACE_GATEWAY_ID`

Workflow-level compatibility mapping:

- `CF_API_TOKEN` is a local/runtime alias for `CLOUDFLARE_BUILD_API_TOKEN`.
- `CF_ACCOUNT_ID` is a local/runtime alias for `CLOUDFLARE_ACCOUNT_ID`.
- `CF_ZONE_ID` is a local/runtime alias for `CLOUDFLARE_ZONE_ID`.
- Workflows that call helper scripts should pass both the canonical names and aliases by mapping aliases from the canonical GitHub secrets. Do not create separate GitHub secrets for the aliases.

Do not store Cloudflare credentials or namespace IDs in tracked workflow files or scripts.

## gs-control token rotation checklist

Use this checklist when Cloudflare Worker Builds reports that the selected build token was deleted/rolled, or when Ops intentionally rotates the Worker Builds credentials for `gs-api`, `gs-gateway`, and `gs-control`.

### 1. Rotate the Worker Builds token in Cloudflare

For each Worker/Pages project involved in the deploy chain:

1. Open **Cloudflare Dashboard** → **Workers & Pages**.
2. Open the project/service (`gs-api`, `gs-gateway`, `gs-control`; include `gs-agent` too if its preview workflow is being retried in the same window).
3. Go to **Settings** → **Builds & deployments** → **Build watch paths / Worker Builds token**.
4. Generate or select the replacement build token.
5. Save the change and verify the project is now pointing at the intended active token.

> Repository policy: all API services and workers should use the `gs-control` build token for Cloudflare Worker Builds so the dashboard state stays aligned across the fleet.

### 2. Update GitHub repository secrets before rerunning workflows

Rotate the GitHub Actions secrets in the same maintenance window so preview and production jobs consume the same credential set:

- Update `CLOUDFLARE_BUILD_API_TOKEN` when the `gs-control` build token changes.
- Confirm `CLOUDFLARE_ACCOUNT_ID` is still the correct target account.
- Confirm `CLOUDFLARE_ZONE_ID` is still the correct target zone.

#### Workflow-to-secret map

| Workflow                                     | Purpose                                     | Secrets consumed in repo                                                                                                                                                             | Rotation note                                                                           |
| -------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `.github/workflows/deploy-platform.yml`      | `main`/manual deploys for Pages and Workers | Canonical: `CLOUDFLARE_BUILD_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID`; aliases mapped in env: `CLOUDFLARE_API_TOKEN`, `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_ZONE_ID` | Keep aliases mapped from canonical secrets only; do not add fallback token expressions. |
| `.github/workflows/preview-gs-api.yml`       | PR preview deploy for `gs-api`              | `CLOUDFLARE_BUILD_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`                                                                                                                                | Uses the canonical build token.                                                         |
| `.github/workflows/setup-preview-dns.yml`    | Preview DNS setup                           | `CLOUDFLARE_BUILD_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID`                                                                                                          | Ensure zone/account IDs match before preview DNS changes.                               |
| `.github/workflows/infrastructure-guard.yml` | Cloudflare live-state guard checks          | `CLOUDFLARE_BUILD_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`                                                                                                                                | Use after rotations to confirm API access.                                              |

### 3. Reconcile preview worker environments and service names in Cloudflare

Before rerunning failed jobs, verify that the preview environment names documented in the repo still exist in Cloudflare and point to the correct services/projects:

- `infra/Cloudflare/gs-api.wrangler.toml` defines the preview worker environment name `gs-api-preview` for `api-preview.goldshore.ai`.
- `infra/Cloudflare/gs-agent.wrangler.toml` defines the preview worker environment name `gs-agent-preview`.
- Preview hostnames already referenced elsewhere in the repo include `api-preview.goldshore.ai`, `gw-preview.goldshore.ai`, and `ops-preview.goldshore.ai`.

If the Cloudflare dashboard still uses older service names such as `astro-gs-api`, `astro-gs-gateway`, or `goldshore-control-worker`, reconcile them with the canonical `gs-*` names before retrying preview/prod jobs. This avoids build-token rotation succeeding while the deploy still targets the wrong worker/service.

### 4. Confirm preview DNS/routes for the `*-preview.goldshore.ai` hosts

Check that the expected preview DNS/custom-domain routing exists for the preview hosts referenced in repository config and docs:

- `api-preview.goldshore.ai`
- `gw-preview.goldshore.ai`
- `ops-preview.goldshore.ai`
- `admin-preview.goldshore.ai`
- `preview.goldshore.ai`

If a workflow rerun still fails after token rotation, verify both the Cloudflare custom-domain attachment and the DNS record for the matching `*-preview.goldshore.ai` hostname.

### 5. Rerun the affected GitHub workflows

After Cloudflare and GitHub secrets are updated:

1. Rerun the failed preview jobs first so branch environments recover quickly.
2. Rerun the related production deploy jobs if they were blocked by the same token issue.
3. Manually run `.github/workflows/infrastructure-guard.yml` to confirm the new secret set can still inspect Cloudflare state.
4. Record that `CLOUDFLARE_BUILD_API_TOKEN` was used and that any `CF_*` variables were workflow-local aliases mapped from canonical secrets.
