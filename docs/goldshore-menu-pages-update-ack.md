# GoldShore menu pages update acknowledgement

Date: 2026-06-30

## Acknowledged scope

This branch acknowledges the latest GitHub audit and update request for the GoldShore menu pages and related routing surfaces.

Covered menu areas:

- About
- Team
- Book Strategy Call / Intake
- Contact
- Risk Radar
- Developer Hub
- Navigation and layout shell behavior
- Footer subscribe / lead capture planning

## PR-1 implementation scope

This PR focuses on low-risk fixes that can land before the larger shell migration:

1. Refine About positioning with the requested New York digital agency language.
2. Replace broken Team social placeholders with real public links where values are known.
3. Document that the LinkedIn URL should be verified before final publishing.
4. Preserve the shell migration, Risk Radar app upgrade, and subscription workflow as follow-up PRs.

## Confirmed issues from audit

- Menu pages currently inherit `WebLayout` through `BaseLayout` / `MarketingLayout`, so they do not yet match the homepage GS LAB visual shell.
- `WebLayout.astro` still contains the older top-level `Book Strategy Call` navigation item.
- `contact.astro` contains duplicate `id="inquiry" name="inquiry"` select controls and should be cleaned in the contact bugfix path.
- `/risk-radar/` should remain the polished marketing page.
- `/apps/risk-radar/` should be treated as the interactive app/demo route and upgraded separately.
- Footer subscribe should use explicit consent and company-level / public firmographic enrichment only.

## Follow-up PR sequence

1. Contact form bugfix: remove duplicate inquiry select, expand allowed inquiry values, and confirm `/api/contact` storage behavior.
2. Navigation cleanup: rename `Book Strategy Call` to `Intake` or move it into the Contact/Intake CTA flow.
3. Shell migration: create a shared homepage-style GoldShore shell and migrate menu pages into it.
4. Risk Radar route cleanup: keep `/risk-radar/` as product page and upgrade `/apps/risk-radar/` as demo app.
5. Subscription workflow: add footer subscribe, `/api/subscribe`, consent storage, unsubscribe path, and later CRM/Zapier/Google/Meta workflows.

## Notes

- GitHub: `https://github.com/marzton`
- Website: `https://rmarston.com`
- LinkedIn: likely value noted in audit, but verify before publishing.
