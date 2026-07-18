# GoldShore Autonomous Workstream

Last updated: 2026-07-17

This plan converts the current open idea list into work that agents can execute without needing live dashboard access. It keeps the 2026 consolidation rule intact: frontend work goes in `apps/gs-web`, backend/API work goes in `apps/gs-api`, and workflow/secret changes must follow `infra/secrets/secret-sync.manifest.yaml`.

## Operating Rules

- Do not create new Cloudflare Workers or new deploy workflow files.
- Do not commit plaintext secrets, OAuth client secrets, service tokens, or API tokens.
- Treat Cloudflare, Google, GitHub, and email-provider dashboard changes as blocked until the account owner completes login or grants a scoped token through the approved local secret flow.
- Prefer static or local-first improvements when the owner is away: content pages, docs, accessibility, responsive fixes, broken-link checks, tests, and code cleanup.
- Keep admin-only experiments behind existing `gs-web` admin routes and `gs-api` routes.

## Phase 0: No-Intervention Cleanup

Owner input needed: none.

- Add stable public surfaces for blog, field notes, and operator updates.
- Wire the Penrose/GoldShore logo assets into favicon, manifest, and app icon metadata.
- Audit responsive CSS across mobile, tablet, laptop, desktop, and wide desktop viewports.
- Run broken-link checks against generated `gs-web` output.
- Improve page headings, landmarks, form labels, focus states, and color contrast.
- Fix template data mismatches such as stale property names in Astro pages.
- Reduce the existing `astro check` backlog before treating type checks as a deploy gate.
- Keep a visible changelog/backlog in docs so Claude, Codex, Jules, and future agents converge on the same priorities.

## Phase 1: Admin Dashboard Stabilization

Owner input needed: local app access only.

- Make `/admin` and related localhost pages readable without relying on Cloudflare Access during development.
- Add an admin backlog view that groups goals by status: ready, blocked, credential-needed, dashboard-needed, and archived.
- Keep secret sync controls pointed at the existing manifest and never display secret values.
- Add health panels for `gs-api`, contact submissions, queues, KV bindings, D1 bindings, and deployment source of truth.
- Document every preview/prod binding in `docs/ops/queue-contract-matrix.md` or a successor matrix.

## Phase 2: Forms, Email, And Lead Flow

Owner input needed: Cloudflare env confirmation and mail sender authorization.

- Confirm `TURNSTILE_SECRET`, MailChannels sender settings, and contact recipients are present in the target environment.
- Verify contact, subscribe, request briefing, marketing services, ecommerce services, integration services, DNS services, and website support forms all post to canonical `gs-api` or `gs-web` API handlers.
- Route each form into D1/KV storage with clear form slugs and log entries.
- Add email delivery diagnostics without logging message bodies or secrets.
- Add tests for successful submit, Turnstile failure, missing storage, duplicate submit, and email-sender misconfiguration.

## Phase 3: Cloudflare, GitHub, And Google Identity

Owner input needed: dashboard login or scoped local tokens.

- Audit Cloudflare Access applications and policies for `admin.goldshore.ai`, `dash.goldshore.ai`, `agent.goldshore.ai`, `api.goldshore.ai`, and `mcp.goldshore.ai`.
- Confirm Google and GitHub identity providers map to the intended accounts and groups.
- Standardize service tokens, GitHub App IDs, installation IDs, webhook secrets, and worker secrets through the manifest.
- Re-run `node scripts/sync-secrets.mjs check` and `node scripts/sync-secrets.mjs audit --strict` after every secret-name change.
- Keep OAuth apps and Zero Trust policy IDs out of public docs unless they are explicitly non-secret identifiers.

## Phase 4: Vintage Intelligence And Content Platform

Owner input needed: marketplace API terms, data-source choices, and publishing policy.

- Add an admin-only intake for item URLs, photos, purchase price, source store, and notes.
- Start with manual research fields before automated scraping: provenance, maker, era, comparable sales, condition, pricing range, risk, and story angle.
- Use approved APIs where possible for eBay and marketplace data; avoid scraping sites that prohibit it.
- Store observations in D1 with source URLs, timestamps, confidence levels, and evidence notes.
- Generate draft outputs: listing copy, short-form social posts, blog outline, appraisal memo, and trend tags.
- Publish selected stories to the public Field Notes page only after review.

## Phase 5: Personal Strategy And Goal System

Owner input needed: goal priorities and privacy boundary.

- Track projects, gigs, book-writing goals, skills, open opportunities, and next actions in the admin backend.
- Split private goal data from public content.
- Add weekly review views for finished work, blocked work, and next best actions.
- Let agents propose tasks, but require explicit approval before external posting, outreach, purchases, or credential changes.

## Current Blockers

- Cloudflare Zero Trust login prevents visual confirmation of protected apps.
- Cloudflare and Google admin changes require owner login or valid scoped tokens.
- Any provider-token rotation must use local secret storage and manifest sync, not chat-pasted values.
- Marketplace scraping needs terms review before automation.
