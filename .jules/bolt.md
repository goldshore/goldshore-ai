# Bolt's Journal

## 2024-05-22 - [Race Condition in Search]
**Learning:** `DocsSearch.astro` had a race condition where fast typing could lead to older search results overwriting newer ones because requests were not cancelled.
**Action:** Always use `AbortController` for search-as-you-type or debounced async work so the UI reflects the latest request.

## 2024-05-23 - [Input Performance]
**Learning:** Found un-debounced search input in `DocsSearch.astro` triggering API calls on every keystroke.
**Action:** Check input event listeners for missing debounce/throttle, especially when they trigger network requests.

## 2024-05-23 - [Image Optimization]
**Learning:** Found eager loading on below-the-fold images.
**Action:** Use `loading="lazy"` and `decoding="async"` for images outside the initial viewport.

## 2024-06-03 - [LCP & Dead Code]
**Learning:** Found duplicate/broken implementation in `TryItConsole.astro` and missing `fetchpriority="high"` on the LCP image.
**Action:** Check for duplicate implementations in components and prioritize LCP images.

## 2025-05-13 - [DOM Redundancy & Scroll Performance]
**Learning:** Found nested layouts in `index.astro` doubling page weight and synchronous scroll listeners causing jank.
**Action:** Verify layouts are not nested in page components. Use `requestAnimationFrame` plus a `ticking` flag for scroll listeners.

## 2026-01-09 - [Dead Code Removal]
**Learning:** Found dead code in `TryItConsole.astro` using server-side variables in invalid inline client handlers.
**Action:** Remove old implementation attempts to avoid shipping unnecessary bytes and confusing maintenance.

## 2026-01-09 - [Lockfile Hygiene]
**Learning:** `pnpm install` modified the lockfile in an unrequested way, causing review noise.
**Action:** Verify `git status` before committing and keep lockfile changes intentional.

## 2026-05-24 - [Duplicate Scroll Listeners]
**Learning:** Found redundant inline scroll listener in `index.astro` duplicating logic already provided by `parallax.ts`.
**Action:** Check if an imported utility is being ignored before re-implementing expensive scroll behavior inline.

## 2026-07-21 - [Claude Local Settings]
**Learning:** Recent Claude work added `.claude/settings.local.json` ignore hygiene to avoid leaking local credentials or tool settings.
**Action:** Keep Claude local settings ignored and do not add broad `.claude/**` ignores that hide reviewed documentation.

## 2026-07-21 - [Preview Workflow Sprawl]
**Learning:** Recent Claude preview DNS workflows were reverted because ad hoc deploy/setup workflows conflict with the two-app deployment contract.
**Action:** Keep active deploy workflows limited to `deploy-gs-web.yml` and `deploy-gs-api.yml`; keep preview workflows canonical and avoid setup-preview-dns sprawl.

## 2026-07-21 - [Cloudflare Routing Ownership]
**Learning:** Public DNS checks showed GitHub Pages custom-domain ownership can conflict with Cloudflare Pages ownership even when the site appears to load.
**Action:** Before changing domains, identify the owner for each hostname: Cloudflare Pages for web, Worker custom domain/routes for API, and no competing GitHub Pages custom domain.

## 2026-07-21 - [pnpm Lockfile Conflict Policy]
**Learning:** Deleting and regenerating `pnpm-lock.yaml` during ordinary PR conflict repair causes recurring high-conflict PRs.
**Action:** Keep main's lockfile when package manifests did not change. Regenerate only through `pnpm lockfile:regenerate` or the manual lockfile workflow.

## 2026-07-21 - [GoldShore Domain Portfolio]
**Learning:** GoldShore has multiple existing domains, Pages projects, Workers, and a HostGator VPS that should be repurposed deliberately instead of deleted or duplicated.
**Action:** Use `docs/cloudflare-routing-plan.md` as the routing source of truth. Keep one owner per hostname and route VPS-backed DB/email/server features through Cloudflare Access, Tunnel, or `gs-api`.
