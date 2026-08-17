# AGENT_FLOW.md — Shared Codex / Claude Operating Contract

> Canonical collaboration rules for GoldShore repository agents.
> Updated: 2026-08-16

## Purpose

Codex and Claude are peers operating against the same repository history. Neither agent owns an implementation simply because it originated on that agent's branch. Current `main` is authoritative.

The goal is controlled convergence: preserve working operational behavior, recover stranded high-value features, and avoid replaying obsolete branch architecture.

## Canonical architecture

1. `apps/gs-web` owns public and authenticated admin UI, same-origin API proxies, and operator experience.
2. `apps/gs-api` owns operational APIs, permissions, D1/Queues/R2/KV integrations, provider mutations, and MCP-facing business operations.
3. Cloudflare Access remains the perimeter authentication authority. UI helpers such as `AuthGuard`, bearer-token propagation, and session utilities may complement Access but must not silently replace it.
4. Existing guarded operational implementations on `main` are preferred over older prototypes.
5. A resurrected feature must attach to the current two-app architecture rather than restore a superseded Worker/app split.

## Agent roles

Roles are task-scoped, not permanent.

- **Implementing agent**: owns the active branch and makes the smallest coherent change.
- **Review agent**: compares the change against current `main`, recent PR lineage, contracts, tests, and deployment safety.
- Either Codex or Claude may implement or review.
- Do not block work merely because the other agent is unavailable. Record assumptions and leave a review-ready handoff.

## Mandatory startup sequence

Before changing code:

1. Fetch current `main` and identify the latest relevant merged PRs.
2. Read `docs/AGENT_FLOW.md` and `docs/AGENT_STATE.md`.
3. Search current code before consulting historical branches.
4. Determine whether the desired capability is:
   - present and working,
   - present but disconnected,
   - partially superseded,
   - absent but recoverable,
   - obsolete.
5. Prefer adaptation over cherry-picking when historical code predates current contracts.

## Feature resurrection protocol

Historical Claude/Codex branches are reference material, not merge targets.

For every resurrection candidate:

1. **Identify user-visible capability** — describe behavior, not old filenames.
2. **Locate current equivalent** — API, schema, UI, queue, integration, permission, test.
3. **Classify overlap**:
   - `KEEP_CURRENT`: current implementation already supersedes history.
   - `WIRE_UP`: backend/frontend exists but is disconnected.
   - `PORT_BEHAVIOR`: behavior is valuable but must be rewritten against current contracts.
   - `MERGE_CONCEPT`: data/UX concept complements current implementation.
   - `DROP`: obsolete, unsafe, duplicated, or incompatible.
4. **Preserve safety gates** — permissions, confirmations, checksums, redaction, audit logging, protected production environments, and provider mutation restrictions must not regress.
5. **Add regression coverage** for every resurrected route or user-visible control.

## Current convergence priorities

Unless a newer `AGENT_STATE.md` overrides these priorities:

1. Admin AI Copilot: recover the floating assistant UX and connect it to current gs-api/MCP operations rather than a hard-coded historical model path.
2. Lead/CRM convergence: align Entries/qualification UX with current contact submissions, audiences, and durable lead-generation workflows.
3. Repo Health + Merge Cockpit: complete operator-facing findings/coordination surfaces over existing backend contracts.
4. Integration/platform registry: unify ads, mail, HostGator/Hyperdrive, tunnels, sites/plugins, storage, and sync metadata without duplicating provider implementations.
5. Analytics/monetization: selectively recover events, rollups, SEO, opportunity, subscription, and revenue concepts after schema-usage verification.
6. Risk Radar: mine historical branches for behavior and UX only; do not restore old deployment topology or dead bindings.

## Ownership precedence

When Claude and Codex implementations overlap, use this order:

1. Production behavior currently verified on `main`.
2. Security and mutation safeguards already merged.
3. Current API/schema contracts and tests.
4. Newer working implementation.
5. Historical feature richness.

This generally means Codex's recent guarded operational controls remain canonical while Claude's later manager UX, MCP integration, repo coordination, and business-schema concepts are adapted around them where useful.

## Branch and PR rules

- Branch from current `main` unless intentionally stacking on an open PR.
- One coherent work unit per PR.
- PR title should describe capability, not agent/session name.
- PR body must include:
  - what capability is added/restored,
  - what existing implementation remains canonical,
  - historical source/reference PRs if used,
  - safety boundaries,
  - validation performed,
  - explicit follow-up boundary.
- Never create a PR whose primary strategy is "merge old Claude/Codex branch".

## Shared handoff format

Use this compact block in PR/issue comments when handing work between agents:

```text
[agent:<codex|claude>] [status:<implementing|review|blocked|ready>]
Work unit: <id>
Base: <main SHA or PR>
Canonical behavior preserved: <short list>
Resurrected/changed: <short list>
Do not regress: <permissions/auth/safety contracts>
Next action: <single concrete action>
```

## Conflict handling

When two approaches disagree:

- Do not resolve based on agent identity.
- Compare against current runtime behavior and repository contracts.
- Preserve data compatibility unless a migration is explicitly justified.
- Never drop apparently unused tables/bindings/routes solely from static inspection when recent features may depend on them; verify repository references, migrations, and relevant PR lineage first.
- Prefer a compatibility adapter when it enables staged convergence without destructive migration.

## Definition of done

A work unit is complete when:

- current builds/tests relevant to the touched surfaces pass,
- auth and permission behavior is unchanged or intentionally strengthened,
- no previously working admin destination is silently removed,
- operational mutations remain guarded/audited,
- `AGENT_STATE.md` reflects the next actionable state,
- the PR is understandable by either agent without private session context.
