# Token Rotation Checklist for gs-control

This checklist ensures a secure and consistent rotation of build tokens and service secrets across Cloudflare and GitHub.

## 1. Cloudflare Build Token Rotation

The `gs-control` build token is the canonical token used for Cloudflare Worker builds across all services.

- [ ] Navigate to **Cloudflare Dashboard** > **User Profile** > **API Tokens**.
- [ ] Create new tokens for each service group:
    - **gs-api-build-token**: Permissions for Workers deployment.
    - **gs-gateway-build-token**: Permissions for Workers deployment.
    - **gs-control-build-token**: Permissions for Workers deployment.
- [ ] Restrict the tokens to the `goldshore-account` and relevant Workers/Pages resources.
- [ ] Update the following **GitHub Secrets** with the new token values:
    - `CLOUDFLARE_API_TOKEN`: Primary deployment token.
    - `CLOUDFLARE_ACCOUNT_ID`: Ensure this is correct.
- [ ] Record the new token IDs/Names for future reference.

## 2. CONTROL_SYNC_TOKEN Rotation

The `CONTROL_SYNC_TOKEN` is used for secure service-to-service communication between `gs-control` and `gs-api`.

- [ ] Generate a new cryptographically secure secret (e.g., `openssl rand -hex 32`).
- [ ] Update the secret in **Cloudflare Workers** settings for both services:
    - **gs-api**: Update `CONTROL_SYNC_TOKEN` secret.
    - **gs-control**: Update `CONTROL_SYNC_TOKEN` secret.
- [ ] Verify that `wrangler.toml` files for both services use `CONTROL_SYNC_TOKEN = "SECRET_MANAGED"` to indicate dashboard/CLI management.

## 3. Workflow Reconciliation

- [ ] Rerun any failed or cancelled workflows in GitHub Actions:
    - `Deploy GS API Worker`
    - `Deploy GS Gateway Worker` (if enabled)
    - `Deploy GS Control Worker` (if enabled)
- [ ] Confirm that `preview-gs-*` workflows are consuming the new `CLOUDFLARE_API_TOKEN`.

## 4. Environment & DNS Verification

- [ ] Ensure the following `*-preview.goldshore.ai` DNS records exist or are dynamically managed by `gs-control`:
    - `api-preview.goldshore.ai` (for `gs-api`)
    - `gw-preview.goldshore.ai` (for `gs-gateway`)
    - `ops-preview.goldshore.ai` (for `gs-control`)
    - `preview.admin.goldshore.ai` (for `gs-admin`)
- [ ] Reconcile service names in the Cloudflare Dashboard with the `[env.preview]` and `[env.prod]` definitions introduced in `wrangler.toml` files.
- [ ] Verify that preview environment service names follow the pattern `<service>-preview` in Cloudflare if required.

---
*Maintained by Codex/Jules Ops*
