# Cloudflare Apps Runbook

The Infra Agent must follow this procedure when asked to manage
Cloudflare applications (Pages / Workers / KV / R2 / D1 / AI / Queues).

1. Always parse `infra/Cloudflare/desired-state.yaml`.
2. Identify which resource types the user is referring to:
   - "Create a new Pages project" → Pages
   - "Add a KV binding" → Workers + KV
   - "Add a new gateway route" → Worker routes

3. Show a PLAN:
   - List the resources to create/update/delete.
   - Indicate which entries come from desired-state and which are ad-hoc.

4. For creation:
   - Prefer using Cloudflare API endpoints.
   - If user says "show wrangler commands instead", output CLI commands only.

5. For bindings:
   - Create or confirm existence of:
     - KV namespaces
     - R2 buckets
     - D1 databases
   - Then add bindings into corresponding `wrangler.toml`.

6. For Pages projects:
   - Verify that project name matches:
     - `astro-gs-web`
     - `astro-gs-admin`
   - Confirm root directories and branches from desired-state.

7. For Workers:
   - Never overwrite an existing Worker with a different purpose.
   - If a service name conflict exists, STOP and ask for renaming.

8. For AI Gateway:
   - Never print API keys or secrets.
   - Only reference gateway IDs or names.

9. Always output final summary:
   - What changed
   - Any TODOs left for manual steps (e.g. Cloudflare UI-only flows)

10. Worker Builds token policy:

- For `gs-web`, `gs-admin`, and `gs-api`, use the `gs-control` build token in Cloudflare Worker Builds.
- Current repo wrangler files live at:
  - `infra/Cloudflare/gs-web.wrangler.toml`
  - `infra/Cloudflare/gs-admin.wrangler.toml`
  - `infra/Cloudflare/gs-api.wrangler.toml`

## 11. Shared runtime KV (`GS_CONFIG`) topology

Current bindings:

- `gs-control` owns write access to `GS_CONFIG` for system sync and shared runtime state.
- `gs-admin` has direct `GS_CONFIG` access for operator-managed reads/writes such as the hero variant control.
- `gs-web` does **not** have a direct `GS_CONFIG` binding in repo-managed Cloudflare config today. Treat web runtime config as indirect unless code in `apps/gs-web` proves otherwise.

Proposed binding policy for `gs-web`:

- Do not assume `gs-web` participates in the same KV topology as `gs-control` and `gs-admin`.
- Before adding `GS_CONFIG` to `infra/Cloudflare/gs-web.wrangler.toml`, confirm a concrete runtime consumer exists in `apps/gs-web` (for example, a Pages Function that must read live config at request time).
- If such a consumer is added, bind `GS_CONFIG` as read-only by convention: web code may `get` shared values, but writes remain owned by `gs-control` or other operator surfaces.
- If there is no concrete consumer, keep `gs-web` on indirect configuration paths such as API-backed fetches, generated content, or build/runtime env vars.

## 12. Service Token Sync for AI Agents (gs-global-protect)

When Cloudflare Access protects `gs-admin` and related operator endpoints:

1. In Zero Trust → Access → Service Auth, confirm service token `gs-ai-agent-token` exists.
2. In Access → Applications → `gs-global-protect` → Policies, verify a **Service Auth** policy includes that token.
3. Ensure CI secrets are set:
   - `CF_ACCESS_CLIENT_ID`
   - `CF_ACCESS_CLIENT_SECRET`
4. Validate with:

```bash
scripts/jules-sync.sh https://gs-admin.pages.dev/
```

The command must return an HTTP 2xx status to pass.
The script only sends service-token headers to trusted hosts (`gs-admin.pages.dev`, `admin.goldshore.ai`, `ops.goldshore.ai`).
