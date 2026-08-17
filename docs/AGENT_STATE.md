# AGENT_STATE.md — Shared Synchronization State

> Current cross-agent work state for Codex and Claude.
> Updated: 2026-08-16
> Operating contract: `docs/AGENT_FLOW.md`

## Current work unit

```yaml
active_work_unit:
  id: "agent-flow-feature-resurrection"
  status: "ready"
  priority: "high"
  base: "main@9e25ebef5f65566951a71e3861928da373a6b156"
  implementing_agent: "codex"
  review_agent: "claude-or-codex-peer"
  objective: >
    Align agent workflow around current main and selectively resurrect
    stranded high-value features without replaying obsolete branches.
```

## Current repository interpretation

Recent history is an interleaved Codex/Claude lineage, not two independent products.

### Preserve as canonical operational behavior

- Current `main` and the two-app architecture (`gs-web` + `gs-api`).
- Codex operational admin controls for workflows/tunnels, managed sites/plugins, mailboxes/audiences, guarded HostGator SQL, ads/integrations, storage, and authenticated same-origin proxies.
- Existing mutation safeguards: RBAC/permissions, confirmations, checksums, redaction, audit trails, production approval gates, and fail-closed provider behavior.
- Current Cloudflare Access perimeter authentication.

### Claude capabilities worth adapting where absent or disconnected

- Admin manager UX and network/error handling patterns.
- MCP-facing admin/agent integration.
- Floating admin AI assistant concept.
- Entries/lead qualification and CRM-style workflows.
- Repo Health / findings / Merge Cockpit operator surfaces.
- Integration/platform metadata and data-sync concepts.
- Analytics, SEO, opportunity, subscription, and revenue concepts after schema-use verification.
- Risk Radar behavior/UX selectively, without restoring old topology or dead bindings.

## Resurrection queue

```yaml
resurrection_queue:
  - id: "admin-ai-copilot"
    priority: 1
    strategy: "PORT_BEHAVIOR"
    source_reference: "Claude PR #6561"
    target: "Current gs-web admin shell + gs-api/MCP operations"
    constraint: "Do not hard-code historical Claude model/provider path"

  - id: "lead-crm-convergence"
    priority: 2
    strategy: "MERGE_CONCEPT"
    target: "Entries/qualification UX over current submissions, audiences, and lead workflows"

  - id: "repo-health-merge-cockpit"
    priority: 3
    strategy: "WIRE_UP"
    target: "Complete operator pages over existing backend contracts"

  - id: "integration-platform-registry"
    priority: 4
    strategy: "MERGE_CONCEPT"
    target: "Unify metadata/status around existing ads/mail/sql/tunnel/site/storage implementations"

  - id: "analytics-monetization"
    priority: 5
    strategy: "MERGE_CONCEPT"
    constraint: "Verify current migrations and references before adding or changing schema"

  - id: "risk-radar"
    priority: 6
    strategy: "PORT_BEHAVIOR"
    constraint: "No wholesale historical branch merge; no dead binding restoration"
```

## Immediate next action

The next implementation PR should start with the highest-priority queue item that is not already present on current `main`.

Before coding, the implementing agent must:

1. inspect current files/routes/contracts for the target capability;
2. inspect the relevant historical PR/branch only as reference;
3. classify each historical piece using `KEEP_CURRENT`, `WIRE_UP`, `PORT_BEHAVIOR`, `MERGE_CONCEPT`, or `DROP`;
4. preserve current safety/auth contracts;
5. add regression coverage for the recovered behavior.

## Handoff to Claude

Copy or point Claude to the following:

```text
[agent:claude] [status:review]
Work unit: agent-flow-feature-resurrection
Base: main@9e25ebef5f65566951a71e3861928da373a6b156
Read first: docs/AGENT_FLOW.md and docs/AGENT_STATE.md
Canonical behavior preserved: current main, two-app architecture, Cloudflare Access, guarded Codex operational controls
Resurrection rule: historical branches are reference material; port behavior into current contracts instead of merging old topology
Priority queue: admin AI copilot -> lead/CRM -> repo health/merge cockpit -> integration registry -> analytics/monetization -> Risk Radar
Next action: review this flow and use the same classification protocol on any Claude-origin feature you propose to recover
```

## Removed stale assumptions

The previous state file is intentionally superseded. Do not rely on its expired assumptions that:

- Codex is offline;
- old file locks remain active;
- the admin repair is still blocked on JWT discovery;
- unused-looking `admin_*` tables should automatically be dropped;
- Claude must implement while Codex waits to review.

Current repository history after PRs through #6584 must be inspected before any destructive cleanup.

## PR state

```yaml
agent_flow_pr:
  branch: "codex/agent-flow-alignment"
  purpose: "Establish one shared collaboration and feature-resurrection protocol"
  status: "opening"
```
