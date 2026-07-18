# GoldClaw KV secrets → Secrets Store migration

Coordination doc for Claude Code and Codex — both agents work from this repo,
so this is the shared source of truth instead of relaying instructions
through chat. Update this file in place as steps complete; don't create a
second copy.

## Background

A KV entry named `CLOUDFLARE_BUILD_TOKEN` was added under the GoldClaw KV
namespace (key prefix `goldclaw:`) as a single JSON blob bundling multiple
credentials together: Cloudflare account ID, Cloudflare API token, R2 access
key ID, R2 secret access key, and the R2 S3-compatible endpoint.

Problem: any worker bound to that KV namespace — or any caller with KV read
access — gets every field in the bundle at once, even if it only needs one.
This is the same exposure shape as the plaintext `CLOUDFLARE_BUILD_TOKEN`
Worker binding found earlier and already rotated. Confirmed with the user
(2026-07-18): the current KV value is a fresh, already-rotated value, not
the previously-exposed one — but the bundling problem still applies to it.

Decision: split into individual Cloudflare Secrets Store secrets (for the
genuinely sensitive fields) and plain `vars` (for the two that aren't
secret), matching the pattern `apps/gs-api/wrangler.toml` already uses for
`INTEGRATION_MASTER_KEY`. Each consuming worker binds only the specific
field it needs, instead of the whole bundle.

## Field mapping

| KV blob field | New name | Type | Notes |
|---|---|---|---|
| `account_id` | `CLOUDFLARE_ACCOUNT_ID` | `vars` (plain, not secret) | Already public — documented in `CLAUDE.md` (Gold Shore Labs: `f77de112d2019e5456a3198a8bb50bd2`). Already declared in `apps/gs-api/src/types.ts` but never wired in `wrangler.toml`. |
| `api_token` | `CLOUDFLARE_API_TOKEN` | Secrets Store secret | Already declared in `apps/gs-api/src/types.ts`, documented as a required secret in `docs/GOLDCLAW_INTEGRATIONS.md`, but never wired as a Secrets Store binding — currently expected via ad-hoc `wrangler secret put`. |
| `r2_access_key_id` | `R2_ACCESS_KEY_ID` | Secrets Store secret | New — no existing field or code path. |
| `r2_secret_access_key` | `R2_SECRET_ACCESS_KEY` | Secrets Store secret | New — no existing field or code path. |
| `s3_endpoint` | `S3_ENDPOINT` | `vars` (plain, not secret) | Derivable from account ID: `https://<account_id>.r2.cloudflarestorage.com`. New — no existing field or code path. |

Confirmed with the user: the R2/S3 credentials are **not** tied to a
specific GoldClaw feature — general infra credential that happened to be
stored under the `goldclaw:` KV prefix. Don't build GoldClaw-specific
plumbing around them.

Resolved (2026-07-18): `apps/gs-api` in this monorepo is the only consumer.
No second repo needed — per the user, the standalone Workers in
`marzton/goldshore-gateway`/`marzton/goldshore-core`/etc. are on a path to
becoming redundant now that a single repo can run multiple Workers, per
`CLAUDE.md`'s existing "strict two-app monorepo" policy and repo migration
plan. Don't wire bindings into those repos.

## Task split

### Codex — wrangler config (per `CLAUDE.md`'s agent-role table)

- [ ] `apps/gs-api/wrangler.toml`: add `secrets_store_secrets` bindings for
      `CLOUDFLARE_API_TOKEN`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
      matching the exact shape of the existing `INTEGRATION_MASTER_KEY`
      block (same `store_id = "b9824d3280c54573a24137c7e7143b33"`, unless a
      dedicated store is preferred — flag if so, don't switch silently).
- [ ] `apps/gs-api/wrangler.toml`: add `CLOUDFLARE_ACCOUNT_ID` and
      `S3_ENDPOINT` as plain `[vars]` (prod and preview environments).
- [ ] Create the actual secret values in the Secrets Store (dashboard or
      `wrangler secrets-store secret create`) using the already-rotated
      values. Real secret values should only ever be entered by a human or
      by Codex directly — never pasted into a Claude Code chat session.

### Claude Code — application code

- [ ] Confirm `apps/gs-api/src/types.ts`'s `Env` interface has
      `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `S3_ENDPOINT` added
      (currently only `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` exist,
      and are duplicated at two different line ranges in that file — worth
      cleaning up while touching this).
- [ ] Update whatever code ends up consuming these (none currently does —
      confirm before adding unused plumbing).
- [ ] Once the Secrets Store values are live and confirmed working, delete
      the `CLOUDFLARE_BUILD_TOKEN` KV entry so the bundled version stops
      existing as a standing exposure.

## Status

Not started — this doc reflects the plan as of 2026-07-18. Scope is
confirmed (single repo, `apps/gs-api` only); pending Codex completing the
`wrangler.toml` bindings above.
