# GoldShore Brand Asset Plan (Planning Only)

This document captures the approved planning guidance for brand asset handling and domain routing.
It does not implement any changes.

## Canonical Brand Asset Location

- **Source of truth:** `packages/theme/assets` (Penrose logo assets).
- Apps should consume the logo from the theme package rather than app-local `/public` paths.

## SVG Consumption Strategy (Clarification)

To avoid ambiguity in implementation, choose explicit consumption modes per surface:

- **Admin:** Inline SVG (preferred for precise styling control).
  - Inline rendering allows CSS targeting on SVG internals (e.g., `.gs-logo svg path { ... }`).
- **Web:** URL reference (preferred for simplicity and performance).
  - Use `<img src={logoUrl} />` or equivalent with the asset emitted by the build.

## App-Level `/assets/logo.svg` (Compatibility)

- **Temporary alias:** Keep existing `/assets/logo.svg` during migration.
- **Follow-up:** Add a TODO to remove once all imports are consolidated to the theme package.

## Domain/Subdomain Mapping (Canonical)

- `goldshore.ai` → Web (Cloudflare Pages)
- `admin.goldshore.ai` → Admin (Cloudflare Pages + Access)
- `api.goldshore.ai` → API Worker
- `gw.goldshore.ai` → Gateway Worker (**canonical; not** `gateway.goldshore.ai`)
- `ops.goldshore.ai` → Control Worker

## Deployment Dependency Order (Planning Only)

1. Storage bindings (KV/R2/D1/AI).
2. API worker.
3. Gateway worker.
4. Control worker.
5. Web/Admin Pages.
