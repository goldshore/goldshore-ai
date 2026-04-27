# GOLD SHORE LABS — GLOBAL AI RULES

1. Only the Infra Agent (infra/AI) may:
   - create or modify Cloudflare applications (Workers, Pages, Zero Trust).
   - create or modify DNS records.
   - create or modify KV, R2, D1, Queues, or AI Gateway configs.
   - configure Email Routing.

2. App-level agents (web, admin, api, gateway) are READ-ONLY with respect to:
   - Cloudflare DNS
   - Cloudflare application definitions
   - Bindings
   - Email Routing
   - Zero Trust configuration

3. All agents MUST read their local `AI/AGENT_IDENTITY.yaml` and `AI/AGENT_CONFIG.yaml`
   before performing any action.

4. Infra Agent MUST:
   - show a human-readable plan before destructive changes.
   - request explicit confirmation for deletes or overwrites of DNS, bindings, and apps.
   - never print or store Cloudflare API tokens in code or version control.

5. Repo lock:
   - Each agent is restricted to its own directory tree.
   - Cross-directory edits require explicit user instruction and MUST be logged.

6. Idempotency:
   - All infra changes must be expressed in `infra/cloudflare/desired-state.yaml`.
   - The Infra Agent applies desired-state → actual-state, instead of ad-hoc mutations.
