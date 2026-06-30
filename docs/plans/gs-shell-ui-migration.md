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

Current subpages still render the older header pattern from `WebLayout.astro`:

```text
GOLD SHORE
Home
About
Team
Book Strategy Call
Contact
Risk Radar
Developer Hub
Log in
Get a Briefing
```

That header is not the target look for the public `goldshore.ai` website. It uses a different logo component, different nav labels, and different font loading than the homepage.

## Header and navbar parity requirement

For now, the public `goldshore.ai` site should keep the homepage header language and type direction across pages.

Target header source of truth:

```text
apps/gs-web/src/pages/index.astro
apps/gs-web/src/styles/home-theme.css
```

Target header content:

```text
40°42′45″N
74°00′21″W
GS·LAB·v2.84
Gold Shore Labs
GoldShore
Platform
Risk Radar
Services
Developer
About
Access →
Request Briefing
```

Target visual behavior:

- White `Gold Shore Labs` wordmark text, not the older SVG lockup as the main public header identity.
- Large, bold, futuristic display type from the homepage font stack.
- Homepage font loading should drive the public shell: `Syne`, `DM Sans`, and `DM Mono`.
- Header should preserve the coordinate block and `GS·LAB·v2.84` metadata.
- Header should preserve the secondary `GoldShore` line under `Gold Shore Labs`.
- `Access →` should open the shared access layer or route to the correct protected access surface while the modal is being finished.
- `Request Briefing` should use the same CTA style and route consistently.
- Mobile menu should use the same labels and visual hierarchy.

Important distinction:

- `Logo.astro` still contains a Penrose-style SVG asset and may remain useful for footer, favicon, brand package, or future controlled usage.
- It should not force the older subpage header to replace the homepage text-forward GS LAB header.

## Non-goals

- Do not delete old static files without an archived copy.
- Do not migrate every page in one risky PR.
- Do not weaken security headers globally just to make interactions work.
- Do not rewrite page content unless the page is intentionally being redesigned.
- Do not replace the homepage public header with the old `WebLayout` header.

## Phase 0 — Inventory and guardrails

### Inspect pages still using old layout

```bash
grep -R "import WebLayout" -n apps/gs-web/src/pages apps/gs-web/src/layouts
```

### Inspect current header differences

```bash
grep -nE "topbar|brand|coords|GS·LAB|nav-toggle" apps/gs-web/src/pages/index.astro apps/gs-web/src/styles/home-theme.css
grep -nE "desktop-nav|header-login|header-cta|Logo|Book Strategy Call|dashboard" apps/gs-web/src/layouts/WebLayout.astro
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
- The homepage header source and old subpage header source are explicitly identified before migration.

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
- shared font loading using the homepage stack: `Syne`, `DM Sans`, `DM Mono`
- GS LAB body class
- coordinates header
- `GS·LAB·v2.84` metadata mark
- text-forward `Gold Shore Labs` / `GoldShore` brand lockup
- primary navigation matching the homepage labels
- Access layer slot or component
- Request Briefing CTA
- shared footer
- slot for page content
- shared script include

### `gs-shell.css`

Responsibilities:

- shared CSS variables from `home-theme.css`
- white/gold header and navigation styling
- homepage-equivalent brand text treatment
- buttons and links
- footer
- modal shell
- cards and panels
- reveal utilities
- magnetic hover utility
- responsive menu styling
- shared background/cursor/starfield treatments

### `gs-shell.js`

Responsibilities:

- mobile nav open and close
- Access layer open and close
- Escape key behavior
- click-outside behavior
- reveal-on-scroll behavior
- magnetic hover behavior
- optional cursor or starfield behavior

Acceptance criteria:

- A basic page can render through `GoldShoreShell`.
- Header, footer, nav, modal, and shared interactions work without homepage-only assumptions.
- The script is safe to run on every public page.
- The shell visually matches the homepage header before any subpage content migration begins.

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
- Header still shows coordinates, `GS·LAB·v2.84`, `Gold Shore Labs`, and `GoldShore`.
- Access layer opens or routes correctly.
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
- The old `WebLayout` header no longer appears on migrated public pages unless intentionally retained for a non-public/internal surface.
