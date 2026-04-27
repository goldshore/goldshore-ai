# STYLE_GUARDRAILS

This document defines the approved design guardrails for `apps/gs-web`, based on existing shared theme tokens from `packages/theme` and shared component APIs from `@goldshore/ui`.

## Source of truth

- Theme tokens and scales: `packages/theme/src/styles/tokens.css`
- Shared structural/component classes: `packages/theme/src/styles/components.css`
- Shared layout classes: `packages/theme/src/styles/layout.css`
- UI button API: `packages/ui/GSButton.astro` and `packages/ui/components/Button.astro`
- App-level token aliases/overrides: `apps/gs-web/src/styles/global.css`

## 1) Approved color tokens

Use CSS variables only (no hardcoded hex/RGBA in page-level styles unless no token exists).

### Background / surface

- `--gs-bg`, `--gs-color-bg`
- `--gs-surface`, `--gs-surface-strong`
- `--gs-color-surface`, `--gs-color-muted-surface`
- `--gs-bg-primary`, `--gs-bg-secondary`, `--gs-bg-surface`

### Text

- `--gs-text`, `--gs-color-text`, `--gs-text-primary`
- `--gs-text-dim`, `--gs-color-subtle`, `--gs-text-muted`
- `--gs-color-faint`

### Accent / interactive

- `--gs-primary`, `--gs-color-primary`
- `--gs-primary-soft`, `--gs-accent-soft`
- `--gs-accent`, `--gs-accent-strong`
- `--gs-accent-blue`, `--gs-accent-cyan`, `--gs-accent-gold`

### Status

- `--gs-success`
- `--gs-warning`
- `--gs-danger`
- `--gs-info`

### Borders / effects

- `--gs-border`, `--gs-color-border`, `--gs-color-border-strong`
- `--gs-border-subtle`, `--gs-panel-border-subtle`
- `--gs-shadow`, `--gs-shadow-soft`, `--gs-shadow-hard`

---

## 2) Approved spacing scale

Prefer theme spacing tokens over literal `rem/px` values:

- `--gs-space-0`: 0
- `--gs-space-1`: 4px
- `--gs-space-2`: 8px
- `--gs-space-3`: 12px
- `--gs-space-4`: 16px
- `--gs-space-5`: 20px
- `--gs-space-6`: 24px
- `--gs-space-7`: 32px
- `--gs-space-8`: 40px
- `--gs-space-9`: 48px
- `--gs-space-10`: 64px

### Practical guidance

- Section vertical rhythm: `--gs-space-8` to `--gs-space-10`
- Card padding: `--gs-space-6`
- Grid gaps: `--gs-space-4` to `--gs-space-6`
- Small control spacing: `--gs-space-1` to `--gs-space-3`

---

## 3) Approved typography scale

Use shared typography tokens and `clamp()` values already established in theme:

- Body
  - `--gs-font-body`
  - `--gs-font-size-body` (1rem)
  - `--gs-line-height` (1.6)
- Display / heading
  - `--gs-font-display`
  - `--gs-font-heading`
  - `--gs-font-size-h1`: `clamp(2rem, 3.6vw, 3.6rem)`
  - `--gs-font-size-h2`: `clamp(1.5rem, 2.5vw, 2.25rem)`
  - `--gs-font-size-h3`: 1.5rem
  - `--gs-font-size-h4`: 1.25rem
  - `--gs-font-size-h5`: 1rem
  - `--gs-font-size-h6`: 0.875rem

### Practical guidance

- Page hero `h1` can use stronger local `clamp()` sizing, but color and spacing should still align with shared tokens.
- Supporting paragraph copy should use text tokens (`--gs-text-dim`, `--gs-color-subtle`) and line-height ~1.6–1.75.

---

## 4) Approved component variants

## Hero

- Preferred container: `FlowSection variant="hero"` (uses `.gs-hero`).
- For custom hero implementations, keep visual language aligned to:
  - shared accent tokens (`--gs-primary`, `--gs-accent-*`)
  - shared surface/border tokens
  - shared spacing scale

## Section card

- Preferred class: `.gs-card` (from theme components).
- Card visuals should use shared tokens:
  - background: surface tokens
  - border: border tokens
  - radius: `--gs-radius-md` / `--gs-radius-lg`
  - shadow: shared shadow tokens

## CTA button

Use `GSButton` / `Button` from `@goldshore/ui`.

Approved variants:

- `primary` (default)
- `secondary`
- `destructive`
- `ghost`

Approved size modifiers:

- default
- `.gs-button--small`
- `.gs-button--large`

## Form controls

- Group controls with `.gs-input-group`.
- Inputs/selects/textarea should inherit theme `field.css` styles and use tokenized text/surface/border colors.
- Validation/progress messaging should use status tokens (`--gs-success`, `--gs-danger`, `--gs-info`) rather than hardcoded colors.

---

## 5) Enforcement rules for page-level styles

When writing `<style>` blocks in pages:

1. Prefer shared class utilities (`.gs-card`, `.gs-grid`, `.gs-hero`, `.gs-section`) before creating one-off styling.
2. Prefer token variables for:
   - color
   - spacing
   - radius
   - shadows
3. Avoid introducing raw color literals for new styles.
4. If a new semantic style is needed repeatedly, promote it into shared theme styles instead of duplicating page-level CSS.
