# GoldShore Website Developer Briefing

## Rollout controls

Feature toggles and CTA labels are defined in `src/data/site-config.json`.

## How to edit hero copy

Update the hero section in `src/pages/index.astro`.

- Primary statement and supporting sub-text live in the first `<section>` block.
- CTA button labels are sourced from `site-config.json`.
- `cta.primary`: primary engagement action label used in hero/footer/contact flows.
- `cta.secondary`: secondary contact action label used in navigation/footer/developer hub.
- `cta.tertiary`: tertiary docs/developer action used in the footer.

## How to edit CTA language

1. Update `src/data/site-config.json`.
2. Validate labels in `src/components/Header.astro`, `src/components/Footer.astro`, and `src/pages/index.astro`.
3. Keep primary and secondary labels action-oriented and consistent across pages.

## How to add case studies

Case studies are defined in `src/data/site-content.ts` under `caseStudies`.

Each record includes:

- `service`
- `outcome`
- `result`
- `technology`

The list renders on `src/pages/services.astro`.

## How to update services

Service panels are defined in `src/data/site-content.ts` under `services`.

Each service includes:

- `name`
- `objective`
- `deliverables[]`
- `timeframe`

The UI is rendered as expandable `<details>` panels on `src/pages/services.astro`.

## Team and credibility updates

- Team profiles are sourced from `team` in `src/data/site-content.ts`.
- Mission credibility signals are sourced from `credibility` in `src/data/site-content.ts`.
- Team cards render in both `src/pages/about.astro` and `src/pages/team.astro`.
