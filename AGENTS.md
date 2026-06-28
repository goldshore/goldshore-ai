# Agent Instructions

This file contains instructions for AI agents working in this repository.

## 🚨 CRITICAL ARCHITECTURE RULE (For Jules, Claude, Codex, etc.)

**THE GREAT CONSOLIDATION (2026-03-29) HAS OCCURRED.**
This repository is strictly a **TWO-APP MONOREPO**:
1. `apps/gs-web` (Astro Frontend)
2. `apps/gs-api` (Unified API Worker)

**DO NOT** create any new Cloudflare workers inside `apps/`.
**DO NOT** create any new `deploy-*.yml` workflow files in `.github/workflows`.
All routing, cron jobs, DB operations, AI logic, and queues MUST be piped into the singular `gs-api` flow. All frontend pages MUST be placed in `gs-web`. Any pull request attempting to re-introduce `gs-agent`, `gs-gateway`, `gs-mail`, `gs-control`, etc., will be rejected.

### Rules
1. **Frontend Only in gs-web**: All visual components, pages, Astro routes, and client-side logic must reside inside `apps/gs-web`. No separate admin or documentation frontend apps are permitted. Use sub-routes (e.g., `/admin`, `/docs`).
2. **Backend Only in gs-api**: All server-side logic, scheduled crons, email receivers, queues, auth middleware, and proxy code must be inside `apps/gs-api`. Do not construct satellite workers.
3. **No Deploy Sprawl**: The `.github/workflows` folder is locked to two production deploy files: `deploy-gs-web.yml` and `deploy-gs-api.yml`.

### Edge Cases
1. **Third-party integrations requiring unique entry points (e.g., Mail Webhooks):** Handle these via dedicated sub-routers under `apps/gs-api/src/routes/` and export specific event handlers (like Cloudflare `email()` bounds) directly from `gs-api/src/index.ts`. Do not spin up a separate "mail worker".
2. **Heavy AI workloads exceeding Cloudflare Worker time limits:** Implement Cloudflare Queues connected to `gs-api`, where the `queue()` handler in `gs-api/src/index.ts` processes payloads asynchronously. Do not start a "long-running instance worker".

### Guards
1. **Workspace Guard:** `pnpm-workspace.yaml` only identifies `apps/gs-web` and `apps/gs-api`. If you attempt to use any other `apps/` directory, Turborepo will ignore it.
2. **Workflow Guard:** If you create a `.github/workflows/deploy-XYZ.yml` file, the CI platform checks will aggressively fail the PR. You are strongly guarded against deployment fragmentation.

## Commit / PR Description Requirement

At the top of every commit description (and corresponding PR description), include a short line that explicitly states whether the PR branch should be **merged** or **squashed**.

Example format:

* `Merge strategy: merge`
* `Merge strategy: squash`

## Build Configuration

All API services and workers must use the `gs-control` build token for Cloudflare Worker Builds. When updating build settings in the Cloudflare Dashboard, ensure that the token used corresponds to the `gs-control` service.

## Tagging for Review

To request a review of an error or issue, please use the following tags in your comments or pull request descriptions:

*   **@Jules-Bot `[review-request]`**: For a general code review.
*   **@Jules-Bot `[error-analysis]`**: For help in diagnosing and fixing a specific error.
*   **@Jules-Bot `[issue-repro]`**: For assistance in reproducing a reported issue.

Please provide as much context as possible when using these tags, including:

*   A clear description of the issue or the code to be reviewed.
*   Steps to reproduce the error or issue.
*   Any relevant logs or error messages.
*   The expected outcome.

## Commit / PR Description Header

At the top of every commit description or PR description, include a one-line merge strategy note that clearly states whether the branch should be merged with a standard merge commit or squashed.

Example:

*   `Merge Strategy: Squash`
*   `Merge Strategy: Merge Commit`
