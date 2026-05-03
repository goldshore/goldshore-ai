# Epic: Hero Mark Animation (Accessible, low CPU)

## Objectives
- Make the hero feel premium and "alive" without heavy JS or WebGL.
- Respect accessibility preferences.
- Keep performance predictable on mobile.

---

## Issue H-0 — Create HeroLogo component and inline SVG

**Targets**
- `apps/gs-web/src/components/hero/HeroLogo.astro`
- Replace usage in `apps/gs-web/src/pages/index.astro` (or hero component)

**Work**
- Inline the mark SVG (no text)
- Add class hooks:
  - `.gs-hero-logo`
  - `.gs-logo-stroke`
  - `.gs-logo-glow`

**Acceptance criteria**
- Hero uses the new component
- No layout shift

---

## Issue H-1 — Stroke-draw intro animation

**Work**
- Use `stroke-dasharray` + `stroke-dashoffset` to "draw" outline.
- Duration ~1.0–1.6s, ease-out.

**Acceptance criteria**
- Animation runs once on load
- Looks clean on dark backgrounds
- Does not rely on JS

---

## Issue H-2 — Idle glow pulse + reduced motion

**Work**
- Add subtle glow pulse (6–10s loop) using `filter: drop-shadow()` or gradient stop animation.
- Add reduced motion handling:
  - disable all animation for reduce-motion users

**Acceptance criteria**
- Idle pulse is subtle, not distracting
- Reduced motion turns off all animations

---

## Issue H-3 (Optional) — Pause when offscreen (micro JS)

**Work**
- Use `IntersectionObserver` to toggle an `.is-paused` class.
- When paused, disable animations.

**Acceptance criteria**
- Animation stops when hero is not visible
- No visual glitches when returning to view

---

## Implementation notes
- Keep PRs small and themed (one concept per PR).
