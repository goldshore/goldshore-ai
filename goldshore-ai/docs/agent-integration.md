# Agent Integration Policy

## When to use Jules/Agent

Use Jules/Agent for **automation tasks and operational workflows** that benefit from repeatable execution and audit trails, such as:

- Routine content formatting and publishing steps.
- Data syncing, report generation, and batch updates.
- Internal documentation updates and maintenance tasks.

Do **not** use Jules/Agent for **SEO strategy or insight work** that requires human judgment, including:

- Keyword strategy and prioritization.
- Competitive positioning or market research.
- Editorial direction and topic selection.

## Required approvals (HITL checkpoints)

- **Pre-run approval:** A human owner must approve any new automation workflow before first use.
- **High-impact changes:** Any action that touches production data, public content, or user access requires a named approver.
- **Publishing changes:** Automated publishing or distribution steps must be reviewed by a content owner before release.

## Logging expectations

All automated actions must leave an audit trail that includes:

- **Who** triggered the automation (user or system identity).
- **What** was changed (resources, files, records, or endpoints).
- **When** the action occurred (timestamp in UTC).
- **Outcome** (success/failure) with links to relevant logs or artifacts.

Logs should be retained according to standard operational retention policies and be accessible to admins through the operational console.
