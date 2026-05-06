# Codex Phase 4 Execution Directive

**Agent:** Codex
**Phase:** 4 - Frontend Stabilization
**Target:** `apps/gs-web` (goldshore.ai)

## Context
You are tasked with stabilizing the frontend rendering pipeline. The site has suffered from "CSS broken" regressions due to layout bypasses and partial theme imports. Your goal is to map the current state and ensure no further regressions.

## Directives

### 1. Validation Protocol
Run the following checks on `apps/gs-web`:

*   **Theme Import:** Confirm `src/layouts/WebLayout.astro` imports `@goldshore/theme/styles/global.css` as the *first* style import.
*   **Logo Asset:** Confirm `src/layouts/WebLayout.astro` uses Astro's optimized image handling (`import logo from '../assets/logo.svg'`) and not a hardcoded string path.
*   **Hero Component:** Verify `src/pages/index.astro` mounts the Hero component correctly.
*   **No Duplicate CSS:** Scan `src/pages/index.astro` to ensure it does NOT import `global.css` again.

### 2. Configuration Confirmation
*   **Home Styles:** Ensure `home.css` is *only* imported in `src/pages/index.astro` (or the relevant home component), not globally.
*   **Global Overrides:** Ensure `src/styles/global.css` contains *only* necessary overrides and does not duplicate the theme.
*   **CSP Check:** Verify `astro.config.mjs` or `WebLayout.astro` headers do not block `/_astro/` assets (check for `style-src` allowing `self`).

### 3. Deliverable Generation
Produce the file `docs/infra/FRONTEND_ARCHITECTURE_MAP.md` containing:

*   **CSS Load Order:** A list showing the sequence of CSS application (Theme -> Global Overrides -> Component Scoped).
*   **Layout Chain:** A diagram or list showing how pages are wrapped (Page -> WebLayout -> BaseLayout/HTML).
*   **Asset Bundling:** Description of where assets are output (`dist/_astro/`).
*   **Hero Mount:** A brief description of how the Hero interaction scripts are loaded.

## Execution Constraints
*   **NO Redesign:** Do not change colors, fonts, or layout structure.
*   **NO Infrastructure Creep:** Do not add new build tools or services.
*   **Report Only:** If you find violations (other than the critical fix you are applying), document them first.

## Completion
Once these tasks are done, update `docs/infra/WORKFLOW_MAP.md` to reflect the stable state of the frontend build.
