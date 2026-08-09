# @codex /plan

**Goal:** Execute a comprehensive system upgrade, feature completion, and stability audit.

## 5 Major Project Tasks

1.  **Unified SSO & Auth Pipeline**
    *   **Scope:** Implement centralized JWT signing/verification for Cloudflare, Google, ChatGPT, HubSpot, GoogleAds, Firebase, and Image Uploading using `@goldshore/auth`.
    *   **Impact:** Secure all services with a single identity provider and consistent token validation.
    *   **Assignee:** @codex

2.  **Risk Radar Development**
    *   **Scope:** Complete the styling and functionality for the Risk Radar app (`apps/gs-web/src/pages/apps/risk-radar.astro`), ensuring it integrates with the new auth pipeline and displays real-time risk metrics.
    *   **Impact:** Deliver a key product feature for risk assessment and monitoring.
    *   **Assignee:** @codex

3.  **Branch Detanglement & Pruning**
    *   **Scope:** Audit all open branches, resolve merge conflicts, cherry-pick valid features into `main`, and prune stale branches to ensure a coherent git history and workflow.
    *   **Impact:** Reduce technical debt and simplify development workflow.
    *   **Assignee:** @codex

4.  **System-Wide End-to-End Testing**
    *   **Scope:** Implement a comprehensive E2E test suite (Playwright) covering critical flows (Auth, Gateway Routing, Admin Dashboard, Risk Radar) across all apps.
    *   **Impact:** Prevent regressions and ensure system reliability.
    *   **Assignee:** @codex

5.  **Admin Dashboard Enhancement**
    *   **Scope:** Expand `apps/gs-admin` to include real-time metrics from `gs-gateway`, user management for SSO, and service health monitoring dashboards.
    *   **Impact:** Provide operational visibility and control.
    *   **Assignee:** @codex

## 10 Minor Project Tasks

1.  **Logo Polish**
    *   Refine the "glow pulse" animation on the logo to be smoother and ensure it looks good on both dark and light modes (if applicable).
2.  **Team Page Polish**
    *   Add social links (LinkedIn, GitHub) to the team members in `apps/gs-web/src/pages/team.astro`.
3.  **Missing Page Placeholders**
    *   Create a generic "Coming Soon" or 404 page for any future broken links.
4.  **Code Completion**
    *   Audit `apps/gs-web` for any `TODO` or `FIXME` comments and resolve them.
5.  **Type Safety**
    *   Ensure strict mode is enabled and passing for all workspaces (especially `apps/gs-web` and `packages/utils`).
6.  **Dependency Audit**
    *   Update dependencies in `package.json` and `pnpm-lock.yaml` to their latest stable versions.
7.  **Linting Rules**
    *   Standardize ESLint configuration across all workspaces to prevent future style divergence.
8.  **Documentation Update**
    *   Update `README.md` and `docs/` with the latest architecture changes (Auth, Gateway).
9.  **Performance Tuning**
    *   Optimize image loading (AVIF/WebP) and script execution in `apps/gs-web`.
10. **Security Headers**
    *   Verify and strengthen CSP and other security headers in `apps/gs-gateway` and `apps/gs-web`.
