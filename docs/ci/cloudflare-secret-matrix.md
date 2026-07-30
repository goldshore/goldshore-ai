# Cloudflare CI Secret Matrix

This matrix standardizes Cloudflare GitHub Actions secrets across GoldShore repositories while preserving least privilege. Each repository should store only the canonical secret names below unless a platform/security owner explicitly approves an exception.

## Canonical secrets

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_BUILD_API_TOKEN` | Repository-scoped Cloudflare token with only the scopes listed for that repository. |
| `CLOUDFLARE_ACCOUNT_ID` | Target Cloudflare account ID for Wrangler, Pages, and Cloudflare API calls. |

Do not store a second copy of the same token as `CLOUDFLARE_API_TOKEN`. If a legacy workflow or CLI expects `CLOUDFLARE_API_TOKEN`, set the runtime environment variable from the canonical secret during workflow execution:

```yaml
env:
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_BUILD_API_TOKEN }}
```

## Repository scope matrix

| Repository | Workers Scripts Edit | Workers KV Storage Edit | Pages Edit | D1 Edit | R2 Edit | Zone Read | DNS Edit | Access Apps Edit | Notes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `goldshore-ai` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Platform monorepo deploys Workers, Pages, KV, D1, R2, DNS/routing, and Access policy automation. |
| `goldshore` | Yes | No | Yes | No | No | Yes | Yes | No | Public web/app repo needs Workers/Pages deploy plus zone/DNS changes for routes and custom domains. |
| `goldshore-gateway` | Yes | Yes | No | No | No | Yes | Yes | Yes | Gateway deploys Worker code, reads/writes gateway KV, manages route DNS, and may update Access app policies for protected gateway routes. |
| `goldshore-admin` | No | No | Yes | No | No | Yes | Yes | Yes | Admin is a Pages application protected by Cloudflare Access and may require DNS/custom-domain updates. |
| `banproof-me` | Yes | No | No | No | No | Yes | Yes | No | Standalone Worker deploy with route/custom-domain DNS management. |

## Least-privilege rules

- Create one Cloudflare API token per repository with only the scopes marked `Yes` above.
- Avoid a single account-wide super-token in every repository unless platform/security owners explicitly approve it and document the exception.
- Rotate repository tokens independently so a compromise in one repository does not grant broader Cloudflare access than needed.
- Keep `CLOUDFLARE_BUILD_API_TOKEN` owned by the service/platform owner responsible for Cloudflare builds; keep `CLOUDFLARE_ACCOUNT_ID` owned by Cloudflare account admins.
- When new Cloudflare capabilities are added, update this matrix before broadening any repository token.
