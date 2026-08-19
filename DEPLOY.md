# Production deployment

The only canonical deployable applications are `apps/gs-web` and `apps/gs-api`.

## Local validation

Run Wrangler only in dry-run mode, with the production environment selected explicitly:

```bash
cd apps/gs-web
pnpm exec wrangler deploy --env prod --dry-run

cd ../gs-api
pnpm exec wrangler deploy --env prod --dry-run
```

These commands validate and bundle locally; they do not mutate Cloudflare.

## Production

Use the canonical workflows:

- `.github/workflows/deploy-gs-web.yml`
- `.github/workflows/deploy-gs-api.yml`

Their production jobs require a human reviewer through the protected GitHub
`production` environment. Do not deploy a Worker directly from a workstation.

DNS, routes, bindings, Access policies, secret values, and other production
configuration remain human-operated in the Cloudflare dashboard. Do not create
or run repository scripts that write production secrets or make those mutations.
