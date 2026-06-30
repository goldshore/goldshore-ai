# Gold Shore Shell UI Migration Plan

## Goal

Unify the homepage and subpage experience so all public Gold Shore routes share one visual system, navigation model, footer, modal layer, interaction script, and link map.

The current homepage has the desired GS LAB identity and interaction model. Several subpages still use an older layout system. This plan outlines a safe, phased migration without losing current page content or reference assets.

## Current problem

The site currently has two UI systems.

### Homepage system

Key files:

```text
apps/gs-web/src/pages/index.astro
apps/gs-web/src/styles/home-theme.css
```

This system owns the current homepage identity:

- coordinates header
- GS LAB brand mark
- Applied Intelligence hero
- homepage cards
- telemetry sections
- marquee
- Risk Radar preview
- financial signal preview
- contact section
- homepage-specific CSS and JavaScript behavior

### Subpage system

Key files:

```text
apps/gs-web/src/layouts/WebLayout.astro
apps/gs-web/src/styles/global.css
```

Many subpages import `WebLayout`, which means they do not inherit the homepage shell, homepage CSS, modal behavior, cursor effects, reveal effects, or homepage nav/footer model.

## Non-goals

- Do not delete old static files without an archived copy.
- Do not expose secrets or platform credentials in browser code.
- Do not migrate every page in one risky PR.
- Do not weaken security headers globally just to make interactions work.
- Do not rewrite page content unless the page is intentionally being redesigned.

## Phase 0 — Inventory and guardrails

### Inspect pages still using old layout

```bash
grep -R "import WebLayout" -n apps/gs-web/src/pages apps/gs-web/src/layouts
```

### Inspect public files that may override Astro pages

```bash
find apps/gs-web/public -type f | sort
```

### Inspect build logs for route collisions

```bash
gh run view <RUN_ID> --log | grep -Ei 'Skipping src/pages|public folder|index.html'
```

### Acceptance criteria

- All layout usage is known.
- All public-file route collisions are known.
- Static files are archived before being moved out of routable paths.

## Phase 1 — Archive static route collisions

Astro can skip a source page when a matching output file exists under `public/`.

Move colliding static files into a non-routable archive folder:

```text
apps/gs-web/public/_archived-static/
```

Acceptance criteria:

- Current Astro homepage owns the root page.
- Migrated Astro routes are not skipped during build.
- Old static files remain available for reference.

## Phase 2 — Create shared shell files

Create:

```text
apps/gs-web/src/layouts/GoldShoreShell.astro
apps/gs-web/src/styles/gs-shell.css
apps/gs-web/src/scripts/gs-shell.js
```

### `GoldShoreShell.astro`

Responsibilities:

- page metadata defaults
- shared font loading
- GS LAB body class
- coordinates header
- brand mark
- primary navigation
- Access modal slot or component
- Request Briefing CTA
- shared footer
- slot for page content
- shared script include

### `gs-shell.css`

Responsibilities:

- shared CSS variables
- header and navigation
- buttons and links
- footer
- modal shell
- cards and panels
- reveal utilities
- magnetic hover utility
- responsive menu styling
- shared background/cursor treatments

### `gs-shell.js`

Responsibilities:

- mobile nav open and close
- Access modal open and close
- Escape key behavior
- click-outside behavior
- reveal-on-scroll behavior
- magnetic hover behavior
- optional cursor or starfield behavior

Acceptance criteria:

- A basic page can render through `GoldShoreShell`.
- Header, footer, nav, modal, and shared interactions work without homepage-only assumptions.
- The script is safe to run on every public page.

## Phase 3 — Refactor homepage into shared shell

Convert the homepage from a full standalone document into content rendered inside `GoldShoreShell`.

Keep homepage-only sections in `index.astro`:

- hero content
- metrics
- deployment surface
- telemetry
- marquee
- capabilities
- under-the-hood section
- Risk Radar preview
- financial signals preview
- approach section
- engage form body

Acceptance criteria:

- Homepage still visually matches the desired GS LAB design.
- Homepage title and meta still reflect Applied Intelligence.
- Hero still reads `Where Strategy Operates.`
- Access modal opens.
- Request Briefing CTA works.
- Homepage-specific styling remains available.

## Phase 4 — Migrate Risk Radar first

Target:

```text
apps/gs-web/src/pages/risk-radar.astro
```

Plan:

- Replace `WebLayout` with `GoldShoreShell`.
- Keep Risk Radar content intact.
- Add only page-specific CSS where needed.
- Confirm page CTAs use the shared link map.
- Archive any static file that overrides the Astro route.

Acceptance criteria:

- Risk Radar uses the GS LAB header and footer.
- Risk Radar content remains intact.
- Modals and navigation work.
- Build logs do not show the page being skipped due to a public-file collision.

## Phase 5 — Migrate platform and service pages

Targets:

```text
apps/gs-web/src/pages/platform/*.astro
apps/gs-web/src/pages/services/*.astro
```

Acceptance criteria:

- Migrated pages use the shared shell.
- Content is preserved.
- CTAs and links route consistently.
- Mobile navigation and modal behavior work.

## Phase 6 — Normalize link map

Create a shared navigation config:

```text
apps/gs-web/src/config/navigation.ts
```

Suggested groups:

- public pages
- platform pages
- services
- developer resources
- operational surfaces
- legal/footer links

Acceptance criteria:

- Header and footer use one source of truth.
- Homepage and subpages use the same nav labels and destinations.
- Operational links are deliberate and documented.

## Phase 7 — Add CI collision guard

Add a script that fails the build when a public static file conflicts with an Astro route.

Suggested file:

```text
apps/gs-web/scripts/check-public-route-collisions.js
```

Acceptance criteria:

- CI fails before deploy if a public file would override an Astro route.
- Error message lists conflicting files.
- Archived static files are ignored.

## Phase 8 — Security and interaction review

Review:

```text
apps/gs-web/src/security/policy.ts
apps/gs-web/src/utils/csp.ts
apps/gs-web/src/middleware.ts
apps/gs-web/public/_headers
```

Goals:

- Keep browser policy strict.
- Prefer external first-party JavaScript for shared shell behavior.
- Do not expose secrets in client code.
- Permit only required first-party connections.

Acceptance criteria:

- Shared modals and scripts work on Astro-rendered pages.
- Static routes do not require broad inline-script allowances.
- Sensitive calls remain server-side.

## Verification checklist

After each migration PR:

```bash
# Build and deploy
gh workflow run deploy-gs-web.yml --ref main
WEB=$(gh run list --workflow "Deploy gs-web" --branch main --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$WEB"

# Check build warnings
gh run view "$WEB" --log | grep -Ei 'Skipping src/pages|public folder|error|warn' | tail -120

# Check expected homepage markers
curl -sL "https://goldshore.ai/?v=$(date +%s)" \
  | grep -Ei 'Applied Intelligence|Where|Strategy|Request Briefing' \
  | head -40
```

## Rollout order

1. Repository README map PR.
2. This planning PR.
3. Public route collision guard PR.
4. Shared shell PR.
5. Homepage shell refactor PR.
6. Risk Radar migration PR.
7. Platform page migration PR.
8. Service page migration PR.
9. Link-map and security cleanup PR.

## Final success state

- All public pages use one Gold Shore shell.
- Homepage visual identity carries into subpages.
- Modals, nav, CTAs, and interactions work consistently.
- Static public files no longer override Astro pages.
- Operational links are centralized and intentional.
- Browser policy remains secure while allowing required first-party UI behavior.
