# Epic: UX & Accessibility Stabilization (Gold Shore Web)

## Goals
- Improve accessibility (WCAG-aligned patterns) and UX clarity without large rewrites.
- Establish a predictable "source of truth" for theme styles and component behavior.
- Convert "placeholder surfaces" (Risk Radar, Developer) into credible interactive demos.

## Definition of Done (Epic)
- Keyboard-only navigation works across primary flows (nav, modal, forms).
- Screen readers correctly announce nav landmarks, dialogs, form fields, errors, and states.
- Visual focus is visible and consistent.
- `prefers-reduced-motion` is respected for animated surfaces.
- Risk Radar is a working interactive demo with sample data.
- Hero logo animation is implemented safely (low CPU, accessible).

---

## Wave 0 — Foundation (2–4 PRs)

### Issue 0.1 — Theme CSS "source of truth" and exports alignment

**Problem**
Edits to `packages/theme/styles/...` may not ship; some apps import CSS via deep paths that require package exports.

**Targets**
- `packages/theme/package.json` (exports)
- `packages/theme/src/styles/*` (canonical)
- Apps that import theme CSS: `apps/gs-web`, `apps/gs-admin`

**Acceptance criteria**
- There is exactly one canonical location to edit theme CSS (`src/styles/`).
- Any CSS imported by apps is exported via `@goldshore/theme` exports.
- CI build does not fail due to missing deep import specifiers (e.g., `./styles/global.css`).
- Documented rule: "Do not edit `packages/theme/styles/*` directly" (if that folder remains as built output).

**Suggested PR sizing**
- PR1: exports + path corrections (small)
- PR2: doc note + cleanup (optional)

---

### Issue 0.2 — Global focus ring + `:focus-visible` policy

**Targets**
- `packages/theme/src/styles/*` (global or components file)

**Acceptance criteria**
- All interactive elements have visible focus style: `a`, `button`, `input`, `select`, `textarea`, custom clickable elements.
- Focus styling uses `:focus-visible` (not `:focus`) to avoid noise for mouse users.
- Contrast of focus ring is readable on dark backgrounds.

---

### Issue 0.3 — Reduced motion baseline

**Targets**
- `packages/theme/src/styles/*`
- Hero animation styles (once added)
- Any transition-heavy components

**Acceptance criteria**
- `@media (prefers-reduced-motion: reduce)` disables animations and smooth scrolling.
- No "essential information" is conveyed solely through animation.

---

## Wave 1 — Navigation + Modals (3–5 PRs)

### Issue 1.1 — Mobile navigation semantics + landmarks

**Problem**
Mobile menu includes modal triggers implemented as anchors and missing a labeled nav landmark.

**Targets**
- `apps/gs-web/src/components/SiteNav.astro` (and any shared nav component in theme if used)

**Work**
- Wrap mobile panel links in `<nav aria-label="Mobile Primary">`.
- Convert modal triggers from `<a href="#">` to `<button type="button">`.
- Add `aria-haspopup="dialog"` for modal triggers.
- Ensure nav toggle has:
  - `aria-controls="mobile-menu-id"`
  - `aria-expanded` toggled true/false
  - an actual DOM child (sr-only or SVG icon), not empty

**Acceptance criteria**
- No click triggers scroll-to-top (no `href="#"`).
- Screen readers announce modal triggers as buttons.
- Keyboard: Tab order is logical; toggle opens/closes; Escape closes if implemented.
- Toggle updates `aria-expanded` correctly.

---

### Issue 1.2 — GlobalModal accessibility compliance (dialog semantics + focus)

**Problem**
Modals must behave like dialogs for keyboard and screen readers.

**Targets**
- `packages/theme/src/components/GlobalModal.astro`
- `@goldshore/theme/runtime` (only if required; prefer not)

**Work**
- Ensure modal root has:
  - `role="dialog"`
  - `aria-modal="true"`
  - `tabindex="-1"`
  - `aria-labelledby` and `aria-describedby` pointing to real elements
- Implement focus behavior:
  - store opener element on open
  - focus modal container or first focusable element on open
  - trap focus within modal while open
  - return focus to opener on close
- Implement Escape-to-close (using existing close hook)

**Acceptance criteria**
- Screen reader announces: "dialog" + title.
- Focus moves inside modal on open.
- Focus cannot escape modal via Tab/Shift+Tab.
- Escape closes modal.
- Focus returns to trigger button/link on close.

**Notes**
- Keep runtime wiring (open/close) separate from rendering.
- Avoid injecting UI logic into `packages/theme/index.ts`.

---

## Wave 2 — Forms & Conversion UX (3–6 PRs)

### Issue 2.1 — Contact form: required fields + validation feedback

**Targets**
- `apps/gs-web/src/pages/contact.astro`

**Work**
- Add `required`, `aria-required="true"` where needed.
- Add explicit `<label>` for each field.
- Add inline help text for project brief (what to include).
- Add submit feedback:
  - disabled state while sending
  - success/failure message area with `aria-live="polite"`

**Acceptance criteria**
- Screen reader announces labels and required state.
- User receives visible confirmation on submit.
- Fields have meaningful autocomplete attributes (e.g., `autocomplete="email"`).

---

### Issue 2.2 — Onboarding intake wizard v1 (optional, after baseline)

**Targets**
- new page: `apps/gs-web/src/pages/intake.astro`
- new component(s): `apps/gs-web/src/components/intake/*`

**Work**
- Multi-step form:
  - industry
  - goals / pain points
  - services interested
  - timeline
- Generates summary at end + sends to contact endpoint (or mail worker)

**Acceptance criteria**
- Progress indicator
- Back/Next controls
- Summary can be copied
- Works keyboard-only

---

## Wave 3 — Content depth + credibility (4–10 PRs)

### Issue 3.1 — Services page expansion (cards + detail routes)

**Targets**
- `apps/gs-web/src/pages/services.astro`
- New pages: `apps/gs-web/src/pages/services/*`

**Work**
- Each service has:
  - overview
  - capability list
  - tech stack
  - example outcomes
  - diagram (SVG)

**Acceptance criteria**
- No "thin page" bullet-only content.
- Each service page has proper metadata (title, description, OG tags).

---

### Issue 3.2 — Case studies section (anonymized)

**Targets**
- `apps/gs-web/src/pages/case-studies.astro`
- `src/content/case-studies/*` (if using Astro Content Collections)

**Acceptance criteria**
- At least 2 case studies with measurable outcomes.
- SEO: structured headings + meta descriptions.
