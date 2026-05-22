# Frontend Architecture Map

## Overview
This document maps the critical rendering path for `goldshore.ai` (`apps/gs-web`).

## CSS Load Order
1.  **Theme Global**: `@goldshore/theme/styles/global.css` (Imported in `WebLayout.astro`)
    - Resets
    - Typography (Inter, JetBrains Mono)
    - Variables/Tokens
    - Base Component Styles
2.  **Local Overrides**: `apps/gs-web/src/styles/global.css` (Imported in `WebLayout.astro`)
    - Application-specific tweaks
3.  **Layout-Specific**: `apps/gs-web/src/layouts/web-layout.css` (Imported in `WebLayout.astro`)
    - Header/Footer specific styles
4.  **Page-Specific**: e.g., `apps/gs-web/src/styles/home.css` (Imported in `index.astro`)
    - Homepage specific animations/styles

## Layout Wrapping Chain
1.  **Page**: `src/pages/index.astro`
    - Uses: `MarketingLayout`
2.  **Wrapper**: `src/layouts/MarketingLayout.astro`
    - Uses: `WebLayout`
    - Passes: `title`, `description`
3.  **Root**: `src/layouts/WebLayout.astro`
    - Defines: `<html>`, `<head>`, `<body>`
    - Mounts: Header, Main Content (`<slot />`), Footer
    - Scripts: Inline scroll handling, mobile menu

## Asset Bundling
- **Build Tool**: Astro (via Vite)
- **Output**: `dist/_astro/`
- **Hashing**: Enabled (e.g., `style.XyZ123.css`)
- **Images**: Optimized by Astro Image integration

## Hero Component
- **Component**: `ParallaxHero.astro`
- **Mount**: Server-side rendering (SSR) in `index.astro`
- **Scripts**: Client-side animation scripts (if any) are bundled or inline.
