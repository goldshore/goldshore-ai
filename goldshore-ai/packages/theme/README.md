# @goldshore/theme

Design tokens, base styles, and shared components for GoldShore apps.

## Usage

Import the theme in your application entry point or layout:

```astro
import '@goldshore/theme';
```

Assets such as the Penrose mark are available at:

```astro
import logo from '@goldshore/theme/assets/logo.svg';
```

## Structure

- `src/styles/tokens.css`: colors, spacing, radii, typography, and shadows.
- `src/styles/base.css`: resets, typography, links, lists, and form defaults.
- `src/styles/components.css`: buttons, cards, tables, badges, grids, and hero/section helpers.
- `src/styles/layout.css`: layout primitives for the web and admin shells.
- `src/theme-manager.ts`: helper to load, apply, and persist theme preferences.
- `assets/`: Penrose logo assets for headers and sidebars.

## Responsive Guidance

- Use `gs-section`, `gs-grid`, and `gs-card` classes for consistent spacing.
- Keep navigation + menu styling inside layouts, not individual pages.
- Templates in `apps/gs-web` and `apps/gs-admin` demonstrate recommended usage.

## Integration Notes

Theme tokens are shared by public web, admin, and Cloudflare Worker templates to ensure consistent
visual language across AI tooling, market data dashboards, and ecommerce experiences.
