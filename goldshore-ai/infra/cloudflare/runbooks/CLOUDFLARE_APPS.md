# Cloudflare Apps Runbook

The Infra Agent must follow this procedure when asked to manage
Cloudflare applications (Pages / Workers / KV / R2 / D1 / AI / Queues).

1. Always parse `infra/cloudflare/desired-state.yaml`.
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
