# Production Deploy Checklist

**Target:** `goldshore.ai`
**Executor:** Jules / Codex

## Pre-Deployment
- [ ] **Build Success**: `pnpm --filter @goldshore/gs-web build` completes without error.
- [ ] **Dist Verified**: `dist/` directory contains `_astro/` folder.
- [ ] **CSS Present**: `dist/_astro/*.css` exists and is non-empty.
- [ ] **JS Present**: `dist/_astro/*.js` exists.
- [ ] **Assets**: `logo.svg` (or hashed variant) is present in build output.

## Post-Deployment (Staging/Production)
- [ ] **HTTP Status**: `curl -I https://goldshore.ai` returns `200 OK`.
- [ ] **No Cloudflare Challenge**: Response is NOT `403 Forbidden` or `503 Service Temporarily Unavailable` (WAF).
- [ ] **Asset Loading**: Browser console shows no 404s for `.css` or `.js` files.
- [ ] **Layout Integrity**:
    - [ ] Header is dark/translucent (not white).
    - [ ] Logo is visible.
    - [ ] Fonts are Inter/Sans-serif (not Serif).
- [ ] **Interactive Elements**:
    - [ ] Mobile menu toggles correctly (if testing on mobile/responsive view).
