# Jules Bot

Jules is the internal automation engineer for GoldShore.

## Responsibilities
*   **Hygiene:** Checks for missing documentation, stale TODOs, and unpinned actions.
*   **Review:** Analyzes PRs for common issues.
*   **Palette:** Improving UX micro-interactions.

## Usage
This bot is designed to run via GitHub Actions or as a standalone service.

### Commands
*   `/palette improve` - Triggers a UX improvement scan.
# apps/jules-bot

## Overview
A lightweight Node.js webhook server that listens for GitHub issue comment events and dispatches the `/palette` improvement workflow. It posts updates back to the PR via the GitHub API. This service remains separate from the `gs-agent` worker because it runs as a long-lived Node server rather than a queue-driven Worker.
# Jules Bot

Jules is the internal automation engineer for GoldShore.

## Responsibilities
*   **Hygiene:** Checks for missing documentation, stale TODOs, and unpinned actions.
*   **Review:** Analyzes PRs for common issues.
*   **Palette:** Improving UX micro-interactions.

## Usage
This bot is designed to run via GitHub Actions or as a standalone service.

### Commands
*   `/palette improve` - Triggers a UX improvement scan.
# apps/jules-bot

## Overview
A lightweight Node.js webhook server that listens for GitHub issue comment events and dispatches the `/palette` improvement workflow. It posts updates back to the PR via the GitHub API.

Required environment variables:
- `GITHUB_TOKEN`
- `GITHUB_ORG`
- `GITHUB_REPO`
- `PORT` (optional, defaults to `3000`)

## Routes/Endpoints
These are webhook API endpoints implemented in `src/index.mjs` (not HTML pages). Route handlers are defined in `src/index.mjs`.
- `POST /` for GitHub webhook payloads
  - Responds `200 OK` on success
  - Responds `413 Payload Too Large` when the body exceeds 1MB
- All other requests return `404 Not Found`

## Local Dev
```bash
pnpm install
pnpm --filter ./apps/jules-bot start
```

## Deploy
No deploy script is defined. Run as a Node.js service with the required environment variables configured.

<!-- // [AUTO-UPDATE] Updated by Jules AI on 2026-01-23 01:43 -->
