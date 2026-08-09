# Platform integration standards

Reviewed 2026-08-09 against current first-party documentation.

## Cloudflare

- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
  recommends a checked-in configuration file as the Worker source of truth.
  GoldShore therefore keeps exactly two visible app-local manifests so Workers
  Builds cannot silently strip bindings. Dashboard-only values and policy state
  are never duplicated in hidden files.
- [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
  defines the Git-connected build/deploy flow and dashboard build settings.
  GoldShore uses it as the sole deploy authority with separate preview versions.
- [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
  requires secrets to stay out of source/config and recommends isolated
  environments. The binding map and secret-name contract apply those rules.
- [Astro on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/)
  is the runtime pattern for the single `gs-web` SSR Worker-with-Assets. A Pages
  project must not compete for the same hosts.

## Google Business Profile

- [Business Profile OAuth](https://developers.google.com/my-business/content/implement-oauth)
  requires OAuth 2.0 for every request and explicit business-owner consent.
  GoldShore uses authorization code plus PKCE, exact redirect URIs, encrypted
  refresh tokens, the current `business.manage` scope, and server-side exchange.
- [Business Profile quotas](https://developers.google.com/my-business/content/limits)
  recommends evenly paced traffic, caching stable data, notifications instead
  of polling, pagination, and exponential backoff with jitter for 429 responses.
  Provider work is queued in `gs-api` and writes remain approval-gated.
- [Business Profile REST reference](https://developers.google.com/my-business/reference/rest)
  is authoritative for current services, discovery documents, resources, and
  method contracts. Generated or hand-written clients must pin the service and
  validate responses rather than relying on legacy Google My Business shapes.

## OpenAI

- [Current model guidance](https://developers.openai.com/api/docs/guides/latest-model)
  recommends the Responses API for reasoning, tools, and multi-turn workloads.
  GoldShore uses structured inputs/outputs, explicit reasoning settings, bounded
  tool allowlists, approval gates, stable end-user safety identifiers, request
  correlation, evaluation fixtures, and provider telemetry.
- [Data controls](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint)
  govern retention choices. Workloads handling customer or admin data must set
  storage behavior deliberately and document any MCP third-party retention.

## Anthropic Claude

- [Messages API](https://platform.claude.com/docs/en/api/messages/create) is the
  canonical request interface used by the provider adapter.
- [Tool use overview](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
  defines schema-based client/server tools and the `tool_use`/`tool_result`
  lifecycle. GoldShore validates every tool input and executes only curated
  connectors in `gs-api`.
- [Tool reference](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-reference)
  supports strict schemas and caller restrictions. Mutating tools additionally
  require RBAC, recent MFA, and a second-person approval record.

## Shared middleware rules

All provider and third-party middleware must have an explicit owner, stable
schema, allowlisted host and methods, per-environment credentials, least-privilege
OAuth scopes, request timeouts, bounded retries with jitter, circuit breaking,
idempotency keys, correlation IDs, redacted structured logging, quota/rate-limit
handling, typed errors, and a tested disabled state. Arbitrary URL fetches,
credential-shaped model arguments, browser-exposed provider keys, and model-led
side effects without deterministic authorization are prohibited.
