# gs-web Launch Checklist

Use this checklist before promoting `apps/gs-web` to production.

## Release Readiness

- [ ] Confirm release scope, owner, and rollback contact are documented in the PR.
- [ ] Confirm runtime metadata is set for the build (`PUBLIC_BUILD_TIMESTAMP`, `PUBLIC_COMMIT_HASH`, optional `PUBLIC_RELEASE_LABEL`).
- [ ] Verify no unresolved critical defects are open for the release branch.

## Automated CI Quality Gates (Required)

- [ ] **Page metadata completeness** passes for all built HTML pages:
  - `<title>` present and non-empty
  - `<meta name="description">` present
  - Open Graph tags present (`og:title`, `og:description`, `og:type`, `og:url`)
- [ ] **Broken links + route coverage** passes:
  - every static page under `src/pages` is represented in `dist`
  - internal links and hash anchors resolve
- [ ] **Lighthouse budgets** pass for representative routes (`/`, `/about`, `/contact`, `/developer`):
  - Performance ≥ 0.80
  - Accessibility ≥ 0.90
  - SEO ≥ 0.90
- [ ] **Keyboard navigation + form label compliance** passes:
  - keyboard tab flow reaches multiple interactive targets per route
  - every rendered form control has an associated label (explicit label, wrapping label, or aria label)

## Deployment Safety

- [ ] Production deploy workflow is blocked on required gs-web quality checks.
- [ ] Deploy is not executed if any required gate fails.
- [ ] Post-deploy smoke test completed on homepage, contact form, and developer docs.
