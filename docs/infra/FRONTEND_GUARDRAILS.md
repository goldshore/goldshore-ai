# gs-web Frontend Guardrails

## Must-hold invariants

1. **Pages configuration is fixed**
   - Root: `apps/gs-web`
   - Output: `dist`
2. **Layout integrity**
   - Pages in `apps/gs-web/src/pages/*` should render through `WebLayout` (or wrappers around it).
3. **Global style source of truth**
   - Global imports are enforced at layout level.
   - Avoid duplicate global style imports in page files.
4. **Asset strategy**
   - Use Astro-imported assets for local files not in `public/`.
   - Do not hardcode absolute `/assets/...` URLs unless those assets are actually in `public/assets`.
5. **CSP compatibility**
   - `script-src` and `style-src` must not block `/_astro/*` bundle execution/loading.
6. **Pre-deploy integrity check required**
   - `pnpm --filter @goldshore/gs-web build`
   - `node scripts/verify-web-dist.mjs`

## PR expectations for risky frontend changes

For PRs that modify `apps/gs-web/src/layouts/WebLayout.astro` or shared theme globals:

- Include dist verification output in the PR body.
- Include one screenshot from local dev or preview showing layout and nav render correctly.
