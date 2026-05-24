## 2024-05-23 - [Input Performance]
**Learning:** Found un-debounced search input in `DocsSearch.astro` triggering API calls on every keystroke.
**Action:** Always check input event listeners for missing debounce/throttle, especially when they trigger network requests.

## 2024-05-23 - [Image Optimization]
**Learning:** Found eager loading on below-the-fold images (footer logo).
**Action:** Always apply `loading="lazy"` and `decoding="async"` to images that are not in the initial viewport to prioritize LCP resources.

## 2026-01-09 - [Dead Code Removal]
**Learning:** Found dead code in `TryItConsole.astro` using server-side variables in invalid inline client handlers, mixed with a newer implementation.
**Action:** Always clean up old implementation attempts to avoid shipping unnecessary bytes and confusing maintenance.

## 2026-01-09 - [Lockfile Hygiene]
**Learning:** `pnpm install` modified the lockfile in an unrequested way, causing the PR to be flagged.
**Action:** Always verify `git status` before committing and ensure lockfile changes are intentional and requested. Revert unexpected lockfile changes immediately.
## 2024-06-03 - [LCP & Dead Code]
**Learning:** Found duplicate/broken implementation in `TryItConsole.astro` and missing `fetchpriority="high"` on LCP image.
**Action:** Always check for duplicate implementations in components and ensure LCP images are prioritized.

## 2025-05-13 - [DOM Redundancy & Scroll Performance]
**Learning:** Found critical DOM duplication (nested Layouts) in `index.astro` doubling page weight. Also identified scroll jank due to synchronous listeners.
**Action:** Verify Layouts are not nested in Page components. Use `requestAnimationFrame` + `ticking` flag for all scroll listeners.

## 2026-05-24 - [Duplicate Scroll Listeners]
**Learning:** Found redundant inline scroll listener in `index.astro` duplicating logic already provided by `parallax.ts` (IntersectionObserver + RAF).
**Action:** Always check if an imported utility function is being ignored before re-implementing logic inline, especially for expensive operations like scroll.
