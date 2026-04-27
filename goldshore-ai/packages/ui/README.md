# @goldshore/ui

Reusable UI components for GoldShore applications, built with Astro.

## Installation

```bash
pnpm add @goldshore/ui @goldshore/theme
```

## Usage

Import components in your Astro files:

```astro
---
import '@goldshore/theme';
import { Button, Card } from '@goldshore/ui';
---

<Card>
  <Button kind="primary">Click me</Button>
</Card>
```

## Components

- `Button`: Primary, secondary, and ghost buttons.
- `Card`: Basic container with padding and border.
- `Panel`: Elevated container with gradient background.
- `Badge`: Status indicators.
- `Table`: Styled HTML tables.
- `Tabs`: Simple tabbed interface.
- `Skeleton`: Loading placeholder.

## Template Alignment

Use these components inside template pages so navigation, menus, and content modules stay consistent across:

- `apps/gs-web` marketing pages.
- `apps/gs-admin` operational dashboards.
- Docs and search surfaces that need shared styling.

## Integration Targets

UI components are designed to support modules for:

- AI chat + agent consoles (Gemini, ChatGPT, Jules).
- Market data dashboards (Alpaca, Thinkorswim, Polygon).
- Ecommerce + CRM workflows (Stripe, Shopify, HubSpot).
